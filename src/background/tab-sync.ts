import { getStorage } from '../storage/storage-factory';
import { getProjectForWindow } from './window-tracker';
import type { TabState, TabGroupState } from '../models/project';

const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();
const windowTabCache = new Map<number, chrome.tabs.Tab[]>();
const windowActiveIndex = new Map<number, number>();
const windowGroupCache = new Map<number, chrome.tabGroups.TabGroup[]>();
const restoringWindows = new Set<number>();
const closingWindows = new Set<number>();

export function markWindowRestoring(windowId: number): void {
  restoringWindows.add(windowId);
}

export function unmarkWindowRestoring(windowId: number): void {
  restoringWindows.delete(windowId);
}

function buildTabStates(tabs: chrome.tabs.Tab[]): TabState[] {
  return tabs
    .sort((a, b) => a.index - b.index)
    .map(t => ({
      url: t.url ?? '',
      title: t.title ?? '',
      pinned: t.pinned,
      index: t.index,
      faviconUrl: t.favIconUrl,
      groupId: t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ? t.groupId : undefined,
    }))
    .filter(t => t.url !== '');
}

async function buildTabGroupStates(windowId: number): Promise<TabGroupState[]> {
  try {
    const groups = await chrome.tabGroups.query({ windowId });
    if (groups.length > 0) windowGroupCache.set(windowId, groups);
  } catch {
    // window already closed - use cache
  }
  return (windowGroupCache.get(windowId) ?? []).map(g => ({
    id: g.id,
    title: g.title ?? '',
    color: g.color,
    collapsed: g.collapsed,
  }));
}

async function persist(projectId: string, tabs: chrome.tabs.Tab[], activeIndex: number, windowId: number, groupsOverride?: TabGroupState[]): Promise<void> {
  const storage = getStorage();
  const project = await storage.getProject(projectId);
  if (!project) return;

  const tabStates = buildTabStates(tabs);

  if (tabStates.length === 0 && project.tabs.length > 0) return;

  const tabGroups = groupsOverride ?? await buildTabGroupStates(windowId);
  await storage.saveProject({ ...project, tabs: tabStates, tabGroups, activeTabIndex: activeIndex });
}

export async function saveProjectTabs(projectId: string, windowId: number): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId });
  const effectiveTabs = tabs.length > 0 ? tabs : (windowTabCache.get(windowId) ?? []);
  const activeIndex = windowActiveIndex.get(windowId) ?? 0;
  await persist(projectId, effectiveTabs, activeIndex, windowId);
}

async function saveFromCache(projectId: string, windowId: number): Promise<void> {
  const cached = windowTabCache.get(windowId);
  if (!cached || cached.length === 0) return;
  const activeIndex = windowActiveIndex.get(windowId) ?? 0;
  // Snapshot groups from cache now - before any async gap clears it
  const groupsSnapshot: TabGroupState[] = (windowGroupCache.get(windowId) ?? []).map(g => ({
    id: g.id,
    title: g.title ?? '',
    color: g.color,
    collapsed: g.collapsed,
  }));
  await persist(projectId, cached, activeIndex, windowId, groupsSnapshot);
}

async function refreshCache(windowId: number): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId });
  if (tabs.length > 0) windowTabCache.set(windowId, tabs);
}

function scheduleSave(windowId: number, delayMs?: number): void {
  void (async () => {
    if (restoringWindows.has(windowId)) return;
    if (closingWindows.has(windowId)) return;
    const projectId = await getProjectForWindow(windowId);
    if (!projectId) return;

    const existing = pendingSaves.get(projectId);
    if (existing) clearTimeout(existing);

    let ms = delayMs;
    if (ms === undefined) {
      const store = await getStorage().getProjectStore();
      ms = store.settings.autoSaveDebounceMs;
    }

    const timer = setTimeout(() => {
      pendingSaves.delete(projectId);
      void saveProjectTabs(projectId, windowId);
    }, ms);

    pendingSaves.set(projectId, timer);
  })();
}

export function registerTabListeners(): void {
  // Track active tab
  chrome.tabs.onActivated.addListener(async info => {
    const tabs = await chrome.tabs.query({ windowId: info.windowId, active: true });
    if (tabs[0]) {
      windowActiveIndex.set(info.windowId, tabs[0].index);
      windowTabCache.set(info.windowId, await chrome.tabs.query({ windowId: info.windowId }).then(t => t.length > 0 ? t : (windowTabCache.get(info.windowId) ?? [])));
    }
    scheduleSave(info.windowId, 300);
  });

  // Keep cache fresh
  chrome.tabs.onUpdated.addListener(async (_, _changeInfo, tab) => {
    if (tab.windowId) await refreshCache(tab.windowId);
  });

  chrome.tabs.onMoved.addListener(async (_, info) => {
    await refreshCache(info.windowId);
    // active index may have shifted after move - refresh it
    const active = await chrome.tabs.query({ windowId: info.windowId, active: true });
    if (active[0]) windowActiveIndex.set(info.windowId, active[0].index);
  });

  // Save triggers
  chrome.tabs.onCreated.addListener(tab => {
    scheduleSave(tab.windowId);
  });

  chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.title || changeInfo.pinned !== undefined) {
      const delay = changeInfo.pinned !== undefined ? 150 : undefined;
      scheduleSave(tab.windowId, delay);
    }
  });

  chrome.tabs.onMoved.addListener((_, info) => {
    scheduleSave(info.windowId);
  });

  chrome.tabs.onAttached.addListener((_, info) => {
    scheduleSave(info.newWindowId);
  });

  chrome.tabs.onDetached.addListener((_, info) => {
    scheduleSave(info.oldWindowId);
  });

  // Keep group cache fresh; save on create/update
  chrome.tabGroups.onCreated.addListener(group => {
    const existing = windowGroupCache.get(group.windowId) ?? [];
    windowGroupCache.set(group.windowId, [...existing.filter(g => g.id !== group.id), group]);
    scheduleSave(group.windowId, 0);
  });
  chrome.tabGroups.onUpdated.addListener(group => {
    const existing = windowGroupCache.get(group.windowId) ?? [];
    windowGroupCache.set(group.windowId, [...existing.filter(g => g.id !== group.id), group]);
    scheduleSave(group.windowId, 0);
  });
  // onRemoved: do NOT evict from cache - window may be closing and we need
  // the cached groups for saveFromCache. Cache is cleared in clearWindowCache.

  chrome.tabs.onRemoved.addListener(async (_, info) => {
    if (info.isWindowClosing) {
      closingWindows.add(info.windowId);
      const projectId = await getProjectForWindow(info.windowId);
      if (projectId) {
        const existing = pendingSaves.get(projectId);
        if (existing) { clearTimeout(existing); pendingSaves.delete(projectId); }
        await saveFromCache(projectId, info.windowId);
      }
    } else {
      scheduleSave(info.windowId);
    }
  });
}

export function clearWindowCache(windowId: number): void {
  windowTabCache.delete(windowId);
  windowActiveIndex.delete(windowId);
  windowGroupCache.delete(windowId);
  closingWindows.delete(windowId);
}

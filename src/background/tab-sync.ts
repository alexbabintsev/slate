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
  // Window ids are reused by Chrome - drop anything cached under this id from a
  // previous window so a restore never inherits stale groups or tabs.
  windowTabCache.delete(windowId);
  windowActiveIndex.delete(windowId);
  windowGroupCache.delete(windowId);
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
    // Authoritative snapshot - replace the cache instead of merging, so groups
    // from a previous restore of this window id cannot linger.
    windowGroupCache.set(windowId, groups);
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

// Chrome's group ids are volatile - they change every time a window is
// restored. Persisting them raw made each open append a fresh set of groups
// alongside the stale ones. Renumber to dense indices so the saved ids are
// stable across restores and the tabs' groupIds keep pointing at the right group.
export function normalizeGroups(
  tabStates: TabState[],
  groups: TabGroupState[],
): { tabs: TabState[]; tabGroups: TabGroupState[] } {
  // Keep every group the window reports, even one no cached tab points at.
  // Filtering on "no live tab references this group" is what wiped groups
  // outright: Chrome fires no tabs.onUpdated when a tab's groupId changes, so
  // the cached tabs still carried their pre-grouping ids, nothing matched, and
  // every group was discarded. Duplicate/stale groups - the 1.0.1 bug - are
  // kept out by the caller instead: the cache is scoped to the live window,
  // replaced wholesale by buildTabGroupStates, and evicted on tabGroups.onRemoved.
  const ordered = groups;
  const indexById = new Map(ordered.map((g, i) => [g.id, i]));

  return {
    tabs: tabStates.map(t => {
      const idx = t.groupId !== undefined ? indexById.get(t.groupId) : undefined;
      return idx === undefined ? { ...t, groupId: undefined } : { ...t, groupId: idx };
    }),
    tabGroups: ordered.map((g, i) => ({ ...g, id: i })),
  };
}

async function persist(projectId: string, tabs: chrome.tabs.Tab[], activeIndex: number, windowId: number, groupsOverride?: TabGroupState[]): Promise<void> {
  const storage = getStorage();
  const project = await storage.getProject(projectId);
  if (!project) return;

  const rawTabStates = buildTabStates(tabs);

  if (rawTabStates.length === 0 && project.tabs.length > 0) return;

  const rawGroups = groupsOverride ?? await buildTabGroupStates(windowId);

  // Last line of defence against losing groups on close. Chrome tears a window
  // down by removing its groups first, so a save can arrive with an empty group
  // list while the tabs still carry their groupIds. Believing that list would
  // persist groups:N->0. When the tabs disagree, keep what the project already
  // has rather than recording a loss the user never asked for.
  const referenced = new Set(
    rawTabStates.map(t => t.groupId).filter((id): id is number => id !== undefined),
  );
  if (rawGroups.length === 0 && referenced.size > 0 && (project.tabGroups?.length ?? 0) > 0) return;

  const { tabs: tabStates, tabGroups } = normalizeGroups(rawTabStates, rawGroups);

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
  const cacheGroup = (group: chrome.tabGroups.TabGroup): void => {
    const existing = windowGroupCache.get(group.windowId) ?? [];
    windowGroupCache.set(group.windowId, [...existing.filter(g => g.id !== group.id), group]);
  };

  chrome.tabGroups.onCreated.addListener(async group => {
    // During a restore these are the groups we are creating ourselves; caching
    // them is fine, but saving mid-restore would persist a partial window.
    cacheGroup(group);
    // Chrome does not fire tabs.onUpdated when a tab's groupId changes, so the
    // tab cache still holds pre-grouping tabs. Without this refresh a close
    // (which saves from cache only) would persist tabs with no group and
    // normalizeGroups would drop every group as unreferenced.
    await refreshCache(group.windowId);
    scheduleSave(group.windowId, 0);
  });
  chrome.tabGroups.onUpdated.addListener(async group => {
    cacheGroup(group);
    await refreshCache(group.windowId);
    scheduleSave(group.windowId, 0);
  });
  chrome.tabGroups.onRemoved.addListener(async group => {
    // Closing a window removes its groups first: Chrome fires tabGroups.onRemoved
    // BEFORE tabs.onRemoved, so closingWindows is still empty here and the
    // "window is alive" test cannot be made from our own flags. Evicting on that
    // wrong assumption emptied the group cache moments before saveFromCache read
    // it, persisting groups:1->0 - the groups vanishing on every close.
    // Ask Chrome instead: a window that is going away no longer answers.
    let windowAlive = true;
    try {
      await chrome.windows.get(group.windowId);
    } catch {
      windowAlive = false;
    }
    if (!windowAlive || closingWindows.has(group.windowId)) return;

    const existing = windowGroupCache.get(group.windowId) ?? [];
    windowGroupCache.set(group.windowId, existing.filter(g => g.id !== group.id));
    // Cached tabs still carry the removed group's id - refresh so a later save
    // does not resurrect a group that no longer exists.
    await refreshCache(group.windowId);
  });
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

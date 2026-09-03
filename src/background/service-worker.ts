import { getStorage } from '../storage/storage-factory';
import { reconcileOnStartup } from './startup-reconciler';
import { registerTabListeners, clearWindowCache, markWindowRestoring, unmarkWindowRestoring, saveProjectTabs } from './tab-sync';
import {
  associateWindow,
  dissociateWindow,
  getProjectForWindow,
  getWindowForProject,
} from './window-tracker';
import { createProject } from '../models/project';
import type { Message, MessageResponse } from '../models/messages';
import { updateToolbarIcon } from './toolbar-icon';
import { sanitizeImportedStore } from './import-sanitizer';
import { isRestorableUrl, hasFileAccess } from './restorable-url';

export async function openProject(projectId: string): Promise<number> {
  const existingWindowId = await getWindowForProject(projectId);
  if (existingWindowId !== null) {
    await chrome.windows.update(existingWindowId, { focused: true });
    return existingWindowId;
  }

  const storage = getStorage();
  const project = await storage.getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const pinnedTabs = project.tabs.filter(t => t.pinned);
  const regularTabs = project.tabs.filter(t => !t.pinned);
  const orderedTabs = [...pinnedTabs, ...regularTabs];

  // Only tabs with URLs chrome.windows.create will accept get created - track
  // which saved tabs map to which window tab. A single rejected URL (file://
  // without local file access, chrome://, etc.) fails the whole create call,
  // so these are dropped up front rather than losing the window entirely.
  const fileAccess = await hasFileAccess();
  const validTabs = orderedTabs.filter(t => t.url && isRestorableUrl(t.url, fileAccess));
  const urls = validTabs.length > 0 ? validTabs.map(t => t.url) : ['chrome://newtab/'];

  const win = await chrome.windows.create({ url: urls, focused: true });
  if (!win.id) throw new Error('Failed to create window');
  const windowId = win.id;

  markWindowRestoring(windowId);
  try {
    // chrome.windows.create resolves before the window has settled: win.tabs can
    // be short, out of order, or missing ids. Re-query and sort by index so the
    // saved tabs line up with the real tabs one-to-one.
    const createdTabs = (await chrome.tabs.query({ windowId })).sort((a, b) => a.index - b.index);

    // Bind each saved tab to a concrete tab id NOW. Pinning below reorders the
    // window (pinned tabs jump to the front), so any later positional lookup
    // would match the wrong tabs.
    const tabIdForSaved = new Map<number, number>();
    for (let i = 0; i < validTabs.length && i < createdTabs.length; i++) {
      const id = createdTabs[i].id;
      if (id !== undefined) tabIdForSaved.set(i, id);
    }

    // Pin the tabs that should be pinned
    for (const [savedIndex, tabId] of tabIdForSaved) {
      if (validTabs[savedIndex]?.pinned) {
        await chrome.tabs.update(tabId, { pinned: true }).catch(() => {});
      }
    }

    // Restore tab groups. Saved group ids are dense indices (see normalizeGroups),
    // matched against the groupId recorded on each saved tab.
    const savedGroups = project.tabGroups ?? [];
    for (const savedGroup of savedGroups) {
      try {
        const tabIds = validTabs
          .map((t, i) => (t.groupId === savedGroup.id ? tabIdForSaved.get(i) : undefined))
          .filter((id): id is number => id !== undefined);

        if (tabIds.length === 0) continue;

        // windowId is required: without it Chrome infers the target window and
        // can pull the tabs into whichever window is currently focused,
        // scattering the project across two windows.
        const newGroupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
        await chrome.tabGroups.update(newGroupId, {
          title: savedGroup.title,
          color: savedGroup.color,
          collapsed: savedGroup.collapsed,
        });
      } catch (e) {
        console.warn('[Slate] failed to restore group', savedGroup.id, e);
      }
    }

    // Activate the tab that was active when the project was last saved.
    const activeIndex = project.activeTabIndex ?? 0;
    const targetTab = createdTabs[activeIndex] ?? createdTabs[0];
    if (targetTab?.id) await chrome.tabs.update(targetTab.id, { active: true });

    await associateWindow(windowId, projectId);
  } finally {
    unmarkWindowRestoring(windowId);
  }

  return windowId;
}

async function closeProject(projectId: string): Promise<void> {
  const windowId = await getWindowForProject(projectId);
  if (windowId !== null) {
    await chrome.windows.remove(windowId);
  }
}

async function handleMessage(message: Message): Promise<MessageResponse> {
  const storage = getStorage();

  try {
    switch (message.type) {
      case 'GET_CURRENT_PROJECT': {
        const projectId = await getProjectForWindow(message.windowId);
        if (!projectId) return { ok: true, data: null };
        const project = await storage.getProject(projectId);
        return { ok: true, data: project };
      }

      case 'GET_ALL_PROJECTS': {
        const store = await storage.getProjectStore();
        const projects = Object.values(store.projects).sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );
        return { ok: true, data: projects };
      }

      case 'OPEN_PROJECT': {
        const windowId = await openProject(message.projectId);
        void updateToolbarIcon(windowId);
        return { ok: true, data: { windowId } };
      }

      case 'CLOSE_PROJECT': {
        await closeProject(message.projectId);
        return { ok: true, data: null };
      }

      case 'CREATE_PROJECT': {
        const project = createProject(message.name, message.icon);
        const store = await storage.getProjectStore();
        const maxOrder = Math.max(0, ...Object.values(store.projects).map(p => p.sortOrder));
        project.sortOrder = maxOrder + 1000;
        await storage.saveProject(project);
        return { ok: true, data: project };
      }

      case 'DELETE_PROJECT': {
        const windowId = await getWindowForProject(message.projectId);
        if (windowId !== null) {
          await dissociateWindow(windowId);
          await updateToolbarIcon(windowId);
        }
        await storage.deleteProject(message.projectId);
        return { ok: true, data: null };
      }

      case 'REORDER_PROJECTS': {
        const store = await storage.getProjectStore();
        message.orderedIds.forEach((id, index) => {
          if (store.projects[id]) store.projects[id].sortOrder = index * 1000;
        });
        await storage.saveProjectStore(store);
        return { ok: true, data: null };
      }

      case 'EXPORT_PROJECTS': {
        const store = await storage.getProjectStore();
        return { ok: true, data: store };
      }

      case 'IMPORT_PROJECTS': {
        const cleaned = sanitizeImportedStore(message.store);
        if (!cleaned) return { ok: false, error: 'Invalid import file' };
        const current = await storage.getProjectStore();
        Object.assign(current.projects, cleaned);
        await storage.saveProjectStore(current);
        return { ok: true, data: null };
      }

      case 'GET_WINDOW_FOR_PROJECT': {
        const windowId = await getWindowForProject(message.projectId);
        return { ok: true, data: windowId };
      }

      case 'CLI_COMMAND': {
        const cmd = message.command;
        if (cmd.action === 'open') {
          const store = await storage.getProjectStore();
          const project = Object.values(store.projects).find(
            p => p.name.toLowerCase() === cmd.projectName.toLowerCase(),
          );
          if (!project) return { ok: false, error: `Project "${cmd.projectName}" not found` };
          const windowId = await openProject(project.id);
          return { ok: true, data: { windowId } };
        }
        if (cmd.action === 'close') {
          const store = await storage.getProjectStore();
          const project = Object.values(store.projects).find(
            p => p.name.toLowerCase() === cmd.projectName.toLowerCase(),
          );
          if (!project) return { ok: false, error: `Project "${cmd.projectName}" not found` };
          await closeProject(project.id);
          return { ok: true, data: null };
        }
        if (cmd.action === 'list') {
          const store = await storage.getProjectStore();
          const projects = Object.values(store.projects).sort(
            (a, b) => a.sortOrder - b.sortOrder,
          );
          return { ok: true, data: projects.map(p => ({ id: p.id, name: p.name, icon: p.icon })) };
        }
        return { ok: false, error: 'Unknown CLI command' };
      }

      case 'ASSIGN_WINDOW': {
        await associateWindow(message.windowId, message.projectId);
        await saveProjectTabs(message.projectId, message.windowId);
        void updateToolbarIcon(message.windowId);
        return { ok: true, data: null };
      }

      case 'SAVE_PROJECT': {
        await storage.saveProject(message.project);
        const wid = await getWindowForProject(message.project.id);
        if (wid !== null) {
          await updateToolbarIcon(wid);
          // Restore active window's icon since Chrome badge is global
          const activeWin = await chrome.windows.getLastFocused().catch(() => null);
          if (activeWin?.id && activeWin.id !== wid) {
            void updateToolbarIcon(activeWin.id);
          }
        }
        return { ok: true, data: null };
      }

      default:
        return { ok: false, error: 'Unknown message type' };
    }
  } catch (err) {
    console.error('[Slate] message handler error', err);
    return { ok: false, error: 'Operation failed' };
  }
}

// Update toolbar icon when focus changes
chrome.windows.onFocusChanged.addListener(windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  void updateToolbarIcon(windowId);
});

chrome.windows.onRemoved.addListener(async windowId => {
  // tabs.onRemoved with isWindowClosing already handled the save from cache
  await dissociateWindow(windowId);
  clearWindowCache(windowId);
});

// Startup reconciliation
chrome.runtime.onStartup.addListener(async () => {
  await reconcileOnStartup();
});

chrome.runtime.onInstalled.addListener(async () => {
  await reconcileOnStartup();
});

// Message handler
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // keep channel open for async response
});

// Tab tracking
registerTabListeners();

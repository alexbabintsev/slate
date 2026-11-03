import { getStorage } from '../storage/storage-factory';
import { reconcileWindows, findUnassignedWindowForProject } from './startup-reconciler';
import {
  registerTabListeners,
  clearWindowCache,
  markWindowRestoring,
  unmarkWindowRestoring,
  saveProjectTabs,
  getRestoringWindows,
} from './tab-sync';
import {
  associateWindow,
  dissociateWindow,
  getProjectForWindow,
  getWindowForProject,
} from './window-tracker';
import { createProject, ensureProjectColor } from '../models/project';
import type { Message, MessageResponse } from '../models/messages';
import { updateToolbarIcon } from './toolbar-icon';
import {
  sanitizeImportedStore,
  sanitizeIcon,
  sanitizeProjectName,
  sanitizeProjectColor,
} from './import-sanitizer';
import { isRestorableUrl, hasFileAccess } from './restorable-url';

// A double click, or the popup and the CLI at once, would otherwise both see
// "no window yet" and open the project twice.
const openingProjects = new Map<string, Promise<number>>();

export function openProject(projectId: string): Promise<number> {
  const inFlight = openingProjects.get(projectId);
  if (inFlight) return inFlight;
  const run = openProjectNow(projectId).finally(() => openingProjects.delete(projectId));
  openingProjects.set(projectId, run);
  return run;
}

async function openProjectNow(projectId: string): Promise<number> {
  const existingWindowId = await getWindowForProject(projectId);
  if (existingWindowId !== null) {
    try {
      await chrome.windows.update(existingWindowId, { focused: true });
      return existingWindowId;
    } catch {
      // The window is gone but its link survived (e.g. a missed onRemoved).
      // Drop it and open the project afresh instead of failing forever.
      await dissociateWindow(existingWindowId);
    }
  }

  const storage = getStorage();
  const project = await storage.getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  // Chrome may already have reopened this project's window on its own (session
  // restore after a crash) without us knowing which project it belongs to.
  // Adopt it rather than opening a second copy of the same tabs.
  const adoptId = await findUnassignedWindowForProject(project, getRestoringWindows());
  if (adoptId !== null) {
    await associateWindow(adoptId, projectId);
    await chrome.windows.update(adoptId, { focused: true });
    return adoptId;
  }

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
    // activeTabIndex points into project.tabs; the window holds only validTabs,
    // reordered pinned-first, so translate through the saved tab itself.
    const activeSaved = project.tabs[project.activeTabIndex ?? 0];
    const activePos = activeSaved ? validTabs.indexOf(activeSaved) : -1;
    const targetId = (activePos >= 0 ? tabIdForSaved.get(activePos) : undefined) ?? createdTabs[0]?.id;
    if (targetId !== undefined) await chrome.tabs.update(targetId, { active: true });

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
        let projectId = await getProjectForWindow(message.windowId);
        if (!projectId) {
          // Last chance for a window restored after the automatic passes ran.
          await runReconcile();
          projectId = await getProjectForWindow(message.windowId);
        }
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
        const name = sanitizeProjectName(message.name);
        if (!name) return { ok: false, error: 'Project name is required' };
        const project = ensureProjectColor(createProject(name, sanitizeIcon(message.icon)));
        await storage.updateProjectStore(store => {
          const maxOrder = Math.max(0, ...Object.values(store.projects).map(p => p.sortOrder));
          project.sortOrder = maxOrder + 1000;
          store.projects[project.id] = project;
        });
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
        await storage.updateProjectStore(store => {
          message.orderedIds.forEach((id, index) => {
            if (store.projects[id]) store.projects[id].sortOrder = index * 1000;
          });
        });
        return { ok: true, data: null };
      }

      case 'EXPORT_PROJECTS': {
        const store = await storage.getProjectStore();
        return { ok: true, data: store };
      }

      case 'IMPORT_PROJECTS': {
        const cleaned = sanitizeImportedStore(message.store);
        if (!cleaned) return { ok: false, error: 'Invalid import file' };
        let replaced = 0;
        await storage.updateProjectStore(store => {
          replaced = Object.keys(cleaned).filter(id => id in store.projects).length;
          Object.assign(store.projects, cleaned);
        });
        return { ok: true, data: { imported: Object.keys(cleaned).length, replaced } };
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

      case 'UPDATE_PROJECT_META': {
        const { patch } = message;
        const name = patch.name !== undefined ? sanitizeProjectName(patch.name) : undefined;
        if (name === null) return { ok: false, error: 'Project name is required' };
        const color = patch.color !== undefined ? sanitizeProjectColor(patch.color) : undefined;
        if (patch.color !== undefined && color === undefined) return { ok: false, error: 'Invalid color' };
        const icon = patch.icon !== undefined ? sanitizeIcon(patch.icon) : undefined;

        const updated = await storage.updateProject(message.projectId, p => ({
          ...p,
          ...(name !== undefined && { name }),
          ...(icon !== undefined && { icon }),
          ...(color !== undefined && { color }),
        }));
        if (!updated) return { ok: false, error: 'Project not found' };

        const wid = await getWindowForProject(message.projectId);
        if (wid !== null) {
          await updateToolbarIcon(wid);
          // Restore active window's icon since Chrome badge is global
          const activeWin = await chrome.windows.getLastFocused().catch(() => null);
          if (activeWin?.id && activeWin.id !== wid) {
            void updateToolbarIcon(activeWin.id);
          }
        }
        return { ok: true, data: updated };
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
  recentWindows.delete(windowId);
});

// ── Window -> project reconciliation ─────────────────────────
// The window map is lost on every Chrome restart. Matching windows only at
// onStartup misses windows that come back later - after a crash Chrome restores
// them only when the user clicks "Restore". So reconcile again whenever windows
// appear, once their tabs have had a moment to arrive.

let reconcileChain: Promise<void> = Promise.resolve();

// Serialized: two overlapping passes could hand the same project to two windows.
function runReconcile(): Promise<void> {
  const run = reconcileChain.then(async () => {
    const assigned = await reconcileWindows(getRestoringWindows());
    await Promise.all(assigned.map(id => updateToolbarIcon(id)));
  });
  reconcileChain = run.catch(err => console.warn('[Slate] reconcile failed', err));
  return reconcileChain;
}

const RECONCILE_DEBOUNCE_MS = 1500;
// How long after a window appears its incoming tabs still trigger a pass.
const NEW_WINDOW_WINDOW_MS = 15_000;
const recentWindows = new Map<number, number>();
let reconcileTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleReconcile(): void {
  clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(() => { void runReconcile(); }, RECONCILE_DEBOUNCE_MS);
}

chrome.windows.onCreated.addListener(win => {
  if (win.id === undefined || win.type !== 'normal') return;
  if (getRestoringWindows().has(win.id)) return;
  recentWindows.set(win.id, Date.now());
  scheduleReconcile();
});

// A restored window fills with tabs after onCreated - keep pushing the pass back
// until they have all landed, so it scores the full set.
chrome.tabs.onCreated.addListener(tab => {
  const createdAt = recentWindows.get(tab.windowId);
  if (createdAt === undefined) return;
  if (Date.now() - createdAt > NEW_WINDOW_WINDOW_MS) {
    recentWindows.delete(tab.windowId);
    return;
  }
  scheduleReconcile();
});

chrome.runtime.onStartup.addListener(() => { void runReconcile(); });
chrome.runtime.onInstalled.addListener(() => { void runReconcile(); });

// Message handler
// Only this extension's own top-level pages may drive it. An extension page
// framed inside a website (sender.tab set, frameId !== 0) is refused: that is how
// a site could steer the extension through its pages.
export function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  const origin = `chrome-extension://${chrome.runtime.id}/`;
  if (sender.url !== undefined && !sender.url.startsWith(origin)) return false;
  if (sender.tab && sender.frameId !== undefined && sender.frameId !== 0) return false;
  return true;
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    sendResponse({ ok: false, error: 'Untrusted sender' });
    return false;
  }
  handleMessage(message).then(sendResponse);
  return true; // keep channel open for async response
});

// Tab tracking
registerTabListeners();

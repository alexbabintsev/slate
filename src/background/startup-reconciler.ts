import { getStorage } from '../storage/storage-factory';
import { associateWindow, dissociateWindow, getAllAssociations } from './window-tracker';
import type { Project } from '../models/project';

export const MATCH_THRESHOLD = 0.6;

// A tab that is still being restored has no committed url yet, only pendingUrl.
function tabUrl(tab: chrome.tabs.Tab): string | undefined {
  return tab.url || tab.pendingUrl || undefined;
}

export function scoreMatch(windowTabs: chrome.tabs.Tab[], project: Project): number {
  if (windowTabs.length === 0 && project.tabs.length === 0) return 0;
  if (project.tabs.length === 0) return 0;

  const projectUrls = new Set(project.tabs.map(t => normalizeUrl(t.url)));
  const matchCount = windowTabs.filter(t => {
    const url = tabUrl(t);
    return url !== undefined && projectUrls.has(normalizeUrl(url));
  }).length;
  return matchCount / Math.max(windowTabs.length, project.tabs.length);
}

export function normalizeUrl(url: string): string {
  try {
    const idx = url.indexOf('//');
    if (idx === -1) return url;
    const rest = url.slice(idx + 2);
    const qIdx = rest.indexOf('?');
    return qIdx === -1 ? rest : rest.slice(0, qIdx);
  } catch {
    return url;
  }
}

type Candidate = { windowId: number; projectId: string; score: number };

// Windows Chrome reports as open, mapped to their tabs.
async function liveWindows(): Promise<chrome.windows.Window[]> {
  return chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
}

/**
 * Bind windows that have no project to the project whose saved tabs they hold.
 *
 * The window->project map lives in storage.session and is wiped whenever Chrome
 * restarts. It cannot be rebuilt only once at runtime.onStartup: after a crash
 * Chrome offers a "Restore" button and brings the windows back only when the
 * user clicks it, long after onStartup fired. So this runs again whenever new
 * windows appear, and must therefore leave existing associations alone: only
 * unassigned windows are matched, and only against projects with no live window.
 *
 * Returns the ids of the windows that were assigned.
 */
export async function reconcileWindows(excludeWindowIds: ReadonlySet<number> = new Set()): Promise<number[]> {
  const store = await getStorage().getProjectStore();
  const projects = Object.values(store.projects);
  if (projects.length === 0) return [];

  const windows = await liveWindows();
  const liveIds = new Set(windows.map(w => w.id).filter((id): id is number => id !== undefined));

  // Drop associations to windows that no longer exist - otherwise their project
  // looks "open" and could never be matched or opened again.
  const map = await getAllAssociations();
  const takenProjects = new Set<string>();
  const takenWindows = new Set<number>();
  for (const [wid, pid] of Object.entries(map)) {
    const windowId = Number(wid);
    if (liveIds.has(windowId)) {
      takenWindows.add(windowId);
      takenProjects.add(pid);
    } else {
      await dissociateWindow(windowId);
    }
  }

  const candidates: Candidate[] = [];
  for (const win of windows) {
    if (win.id === undefined || takenWindows.has(win.id) || excludeWindowIds.has(win.id)) continue;
    const tabs = win.tabs ?? [];
    for (const project of projects) {
      if (takenProjects.has(project.id)) continue;
      const score = scoreMatch(tabs, project);
      if (score >= MATCH_THRESHOLD) candidates.push({ windowId: win.id, projectId: project.id, score });
    }
  }

  // Best score first; each window and each project is used at most once.
  candidates.sort((a, b) => b.score - a.score);
  const assigned: number[] = [];
  for (const { windowId, projectId } of candidates) {
    if (takenWindows.has(windowId) || takenProjects.has(projectId)) continue;
    await associateWindow(windowId, projectId);
    takenWindows.add(windowId);
    takenProjects.add(projectId);
    assigned.push(windowId);
  }
  return assigned;
}

/**
 * Find an open, unassigned window already holding this project's tabs - e.g. a
 * window Chrome restored itself after a crash. Opening the project should adopt
 * that window instead of creating a duplicate.
 */
export async function findUnassignedWindowForProject(
  project: Project,
  excludeWindowIds: ReadonlySet<number> = new Set(),
): Promise<number | null> {
  const windows = await liveWindows();
  const map = await getAllAssociations();
  let best: { windowId: number; score: number } | null = null;
  for (const win of windows) {
    if (win.id === undefined || win.id in map || excludeWindowIds.has(win.id)) continue;
    const score = scoreMatch(win.tabs ?? [], project);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { windowId: win.id, score };
  }
  return best?.windowId ?? null;
}

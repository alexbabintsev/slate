import { getStorage } from '../storage/storage-factory';
import { associateWindow } from './window-tracker';
import type { Project } from '../models/project';

export function scoreMatch(windowTabs: chrome.tabs.Tab[], project: Project): number {
  if (windowTabs.length === 0 && project.tabs.length === 0) return 0;
  if (project.tabs.length === 0) return 0;

  const projectUrls = new Set(project.tabs.map(t => normalizeUrl(t.url)));
  const matchCount = windowTabs.filter(t => t.url && projectUrls.has(normalizeUrl(t.url))).length;
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

export async function reconcileOnStartup(): Promise<void> {
  const storage = getStorage();
  const store = await storage.getProjectStore();
  const projects = Object.values(store.projects);
  if (projects.length === 0) return;

  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  const used = new Set<string>();

  const candidates: Array<{ windowId: number; projectId: string; score: number }> = [];

  for (const win of windows) {
    if (!win.id) continue;
    const tabs = win.tabs ?? [];
    for (const project of projects) {
      if (used.has(project.id)) continue;
      const score = scoreMatch(tabs, project);
      if (score >= 0.6) candidates.push({ windowId: win.id, projectId: project.id, score });
    }
  }

  // Sort descending by score, pick best non-conflicting match per window and project
  candidates.sort((a, b) => b.score - a.score);
  const assignedWindows = new Set<number>();

  for (const { windowId, projectId } of candidates) {
    if (assignedWindows.has(windowId) || used.has(projectId)) continue;
    await associateWindow(windowId, projectId);
    assignedWindows.add(windowId);
    used.add(projectId);
  }
}

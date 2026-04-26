import { getProjectForWindow } from './window-tracker';
import { getStorage } from '../storage/storage-factory';
import { projectColorFromSeed } from '../models/project';

const DEFAULT_ICON_PATH = {
  16: 'assets/icons/icon16.png',
  32: 'assets/icons/icon32.png',
  48: 'assets/icons/icon48.png',
  128: 'assets/icons/icon128.png',
};
const DEFAULT_TITLE = 'Slate - No project';

type WindowScopedIconDetails = chrome.action.TabIconDetails & { windowId?: number };
type WindowScopedTitleDetails = chrome.action.TitleDetails & { windowId?: number };
type WindowScopedBadgeTextDetails = chrome.action.BadgeTextDetails & { windowId?: number };
type WindowScopedBadgeColorDetails = chrome.action.BadgeColorDetails & { windowId?: number };

// windowId param for action.setIcon/setTitle requires Chrome 119+
// Try per-window first, fall back to global
async function setIcon(details: WindowScopedIconDetails): Promise<void> {
  try {
    await chrome.action.setIcon(details as chrome.action.TabIconDetails);
  } catch {
    const { windowId: _w, ...global } = details;
    await chrome.action.setIcon(global).catch(() => {});
  }
}

async function setActionTitle(details: WindowScopedTitleDetails): Promise<void> {
  try {
    await chrome.action.setTitle(details as chrome.action.TitleDetails);
  } catch {
    await chrome.action.setTitle({ title: details.title }).catch(() => {});
  }
}

async function setBadgeText(details: WindowScopedBadgeTextDetails): Promise<void> {
  try {
    await chrome.action.setBadgeText(details as chrome.action.BadgeTextDetails);
  } catch {
    const { windowId: _w, ...global } = details;
    await chrome.action.setBadgeText(global).catch(() => {});
  }
}

async function setBadgeBackgroundColor(details: WindowScopedBadgeColorDetails): Promise<void> {
  try {
    await chrome.action.setBadgeBackgroundColor(details as chrome.action.BadgeColorDetails);
  } catch {
    const { windowId: _w, ...global } = details;
    await chrome.action.setBadgeBackgroundColor(global).catch(() => {});
  }
}

async function setBadgeTextColor(details: WindowScopedBadgeColorDetails): Promise<void> {
  try {
    await chrome.action.setBadgeTextColor(details as chrome.action.BadgeColorDetails);
  } catch {
    const { windowId: _w, ...global } = details;
    await chrome.action.setBadgeTextColor(global).catch(() => {});
  }
}

function makeBadgeText(projectName: string): string {
  const words = projectName
    .trim()
    .split(/[\s._/-]+/)
    .filter(Boolean);

  const text = words.length > 1
    ? words.slice(0, 2).map(word => Array.from(word)[0]).join('')
    : Array.from(words[0] ?? projectName)[0] ?? '';

  return text.toUpperCase();
}

export async function updateToolbarIcon(windowId: number): Promise<void> {
  await setIcon({ path: DEFAULT_ICON_PATH, windowId });

  const projectId = await getProjectForWindow(windowId);
  if (!projectId) {
    await setActionTitle({ title: DEFAULT_TITLE, windowId });
    await setBadgeText({ text: '', windowId });
    return;
  }

  const project = await getStorage().getProject(projectId);
  if (!project) {
    await setActionTitle({ title: DEFAULT_TITLE, windowId });
    await setBadgeText({ text: '', windowId });
    return;
  }

  await setActionTitle({ title: `Slate - ${project.name}`, windowId });
  await setBadgeBackgroundColor({
    color: project.color ?? projectColorFromSeed(project.id || project.name),
    windowId,
  });
  await setBadgeTextColor({ color: '#ffffff', windowId });
  await setBadgeText({ text: makeBadgeText(project.name), windowId });
}

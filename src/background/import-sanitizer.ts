import type { Project, ProjectStore, TabState, TabGroupState } from '../models/project';

const VALID_TAB_GROUP_COLORS = new Set<chrome.tabGroups.ColorEnum>([
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange',
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sanitizeTab(raw: unknown): TabState | null {
  if (!isObject(raw)) return null;
  const url = typeof raw.url === 'string' ? raw.url : '';
  if (!url) return null;
  return {
    url,
    title: typeof raw.title === 'string' ? raw.title : '',
    pinned: !!raw.pinned,
    index: typeof raw.index === 'number' ? raw.index : 0,
    faviconUrl: typeof raw.faviconUrl === 'string' ? raw.faviconUrl : undefined,
    groupId: typeof raw.groupId === 'number' ? raw.groupId : undefined,
  };
}

function sanitizeGroup(raw: unknown): TabGroupState | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== 'number') return null;
  const color = raw.color as chrome.tabGroups.ColorEnum;
  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    color: VALID_TAB_GROUP_COLORS.has(color) ? color : 'grey',
    collapsed: !!raw.collapsed,
  };
}

export function sanitizeProject(raw: unknown): Project | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.name !== 'string' || !raw.name) return null;
  const tabs = Array.isArray(raw.tabs)
    ? raw.tabs.map(sanitizeTab).filter((t): t is TabState => t !== null)
    : [];
  const tabGroups = Array.isArray(raw.tabGroups)
    ? raw.tabGroups.map(sanitizeGroup).filter((g): g is TabGroupState => g !== null)
    : [];
  return {
    id: raw.id,
    name: raw.name,
    icon: typeof raw.icon === 'string' ? raw.icon : '',
    color: typeof raw.color === 'string' ? raw.color : undefined,
    tabs,
    tabGroups,
    activeTabIndex: typeof raw.activeTabIndex === 'number' ? raw.activeTabIndex : 0,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : Date.now(),
  };
}

export function sanitizeImportedStore(
  store: Partial<ProjectStore> | undefined,
): Record<string, Project> | null {
  if (!isObject(store)) return null;
  const projects = store.projects;
  if (!isObject(projects)) return null;
  const out: Record<string, Project> = {};
  for (const [id, raw] of Object.entries(projects)) {
    const p = sanitizeProject(raw);
    if (p && p.id === id) out[id] = p;
  }
  return out;
}

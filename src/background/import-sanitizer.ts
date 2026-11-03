import type { Project, ProjectStore, TabState, TabGroupState } from '../models/project';
import { isImportableUrl } from './restorable-url';

const VALID_TAB_GROUP_COLORS = new Set<chrome.tabGroups.ColorEnum>([
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange',
]);

// Caps keep a crafted file from filling chrome.storage.local (10 MB quota):
// once full, every autosave fails silently.
export const IMPORT_LIMITS = {
  nameLength: 200,
  titleLength: 1000,
  urlLength: 8192,
  tabsPerProject: 500,
  groupsPerProject: 100,
  // The icon upload allows 512 KB files; base64 inflates that by 4/3.
  dataIconLength: 700 * 1024,
  textIconLength: 16,
  lucideNameLength: 64,
} as const;

const DATA_ICON_RE = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const LUCIDE_ICON_RE = /^lucide:[A-Za-z0-9]+$/;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

export function sanitizeIcon(v: unknown): string {
  if (typeof v !== 'string' || v === '') return '';
  if (v.startsWith('lucide:')) {
    return v.length <= IMPORT_LIMITS.lucideNameLength && LUCIDE_ICON_RE.test(v) ? v : '';
  }
  if (v.startsWith('data:')) {
    return v.length <= IMPORT_LIMITS.dataIconLength && DATA_ICON_RE.test(v) ? v : '';
  }
  return Array.from(v).slice(0, IMPORT_LIMITS.textIconLength).join('');
}

/** A trimmed, length-capped project name, or null when there is none. */
export function sanitizeProjectName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const name = v.trim().slice(0, IMPORT_LIMITS.nameLength);
  return name || null;
}

export function sanitizeProjectColor(v: unknown): string | undefined {
  return typeof v === 'string' && HEX_COLOR_RE.test(v) ? v : undefined;
}

function sanitizeFavicon(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > IMPORT_LIMITS.urlLength) return undefined;
  return /^https?:\/\//i.test(v) ? v : undefined;
}

function sanitizeTab(raw: unknown): TabState | null {
  if (!isObject(raw)) return null;
  const url = typeof raw.url === 'string' ? raw.url : '';
  if (!url || url.length > IMPORT_LIMITS.urlLength || !isImportableUrl(url)) return null;
  return {
    url,
    title: str(raw.title, IMPORT_LIMITS.titleLength),
    pinned: !!raw.pinned,
    index: typeof raw.index === 'number' ? raw.index : 0,
    faviconUrl: sanitizeFavicon(raw.faviconUrl),
    groupId: typeof raw.groupId === 'number' ? raw.groupId : undefined,
  };
}

function sanitizeGroup(raw: unknown): TabGroupState | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== 'number') return null;
  const color = raw.color as chrome.tabGroups.ColorEnum;
  return {
    id: raw.id,
    title: str(raw.title, IMPORT_LIMITS.titleLength),
    color: VALID_TAB_GROUP_COLORS.has(color) ? color : 'grey',
    collapsed: !!raw.collapsed,
  };
}

export function sanitizeProject(raw: unknown): Project | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  const name = sanitizeProjectName(raw.name);
  if (!name) return null;
  const tabs = Array.isArray(raw.tabs)
    ? raw.tabs
      .map(sanitizeTab)
      .filter((t): t is TabState => t !== null)
      .slice(0, IMPORT_LIMITS.tabsPerProject)
    : [];
  const tabGroups = Array.isArray(raw.tabGroups)
    ? raw.tabGroups
      .map(sanitizeGroup)
      .filter((g): g is TabGroupState => g !== null)
      .slice(0, IMPORT_LIMITS.groupsPerProject)
    : [];
  return {
    id: raw.id,
    name,
    icon: sanitizeIcon(raw.icon),
    color: sanitizeProjectColor(raw.color),
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
  const out: Record<string, Project> = Object.create(null);
  for (const [id, raw] of Object.entries(projects)) {
    const p = sanitizeProject(raw);
    if (p && p.id === id) out[id] = p;
  }
  return out;
}

export type TabState = {
  url: string;
  title: string;
  pinned: boolean;
  index: number;
  faviconUrl?: string;
  groupId?: number; // saved group index (not chrome's volatile id)
};

export type TabGroupState = {
  id: number; // index used to match tabs, not chrome's volatile id
  title: string;
  color: chrome.tabGroups.ColorEnum;
  collapsed: boolean;
};

// icon: empty string for project initial, lucide icon name prefixed with "lucide:", data URL, or legacy text
export type IconType = string;

export type Project = {
  id: string;
  name: string;
  icon: IconType;
  color?: string;
  tabs: TabState[];
  tabGroups: TabGroupState[];
  activeTabIndex: number;
  createdAt: number;
  updatedAt: number;
  sortOrder: number;
};

export type AppSettings = {
  autoSaveDebounceMs: number;
  storageBackend: 'local' | 'cloud';
  cloudProvider?: string;
  syncEnabled: boolean;
};

export type ProjectStore = {
  projects: Record<string, Project>;
  settings: AppSettings;
};

export const DEFAULT_SETTINGS: AppSettings = {
  autoSaveDebounceMs: 1500,
  storageBackend: 'local',
  syncEnabled: false,
};

export const PROJECT_BADGE_COLORS = [
  '#e76f51',
  '#2a9d8f',
  '#6d5dfc',
  '#d99a13',
  '#27b4c9',
  '#4f86e8',
  '#8b5cf6',
  '#43a047',
  '#d64f8a',
  '#64748b',
] as const;

function randomIndex(max: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

export function randomProjectColor(): string {
  return PROJECT_BADGE_COLORS[randomIndex(PROJECT_BADGE_COLORS.length)];
}

export function projectColorFromSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PROJECT_BADGE_COLORS.length;
  return PROJECT_BADGE_COLORS[index];
}

export function ensureProjectColor(project: Project): Project {
  return project.color
    ? project
    : { ...project, color: projectColorFromSeed(project.id || project.name) };
}

export function createProject(name: string, icon = ''): Project {
  return {
    id: crypto.randomUUID(),
    name,
    icon,
    color: randomProjectColor(),
    tabs: [],
    tabGroups: [],
    activeTabIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sortOrder: Date.now(),
  };
}

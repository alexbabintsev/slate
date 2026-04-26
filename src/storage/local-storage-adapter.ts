import type { IStorage } from './storage-interface';
import type { Project, ProjectStore } from '../models/project';
import { DEFAULT_SETTINGS, ensureProjectColor } from '../models/project';

const STORE_KEY = 'projectStore';

function emptyStore(): ProjectStore {
  return { projects: {}, settings: DEFAULT_SETTINGS };
}

export class LocalStorageAdapter implements IStorage {
  readonly backendType = 'local' as const;

  // Serialize all read-modify-write operations so concurrent saves don't clobber each other.
  private writeQueue: Promise<unknown> = Promise.resolve();

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(fn, fn);
    this.writeQueue = next.catch(() => undefined);
    return next;
  }

  async getProjectStore(): Promise<ProjectStore> {
    const result = await chrome.storage.local.get(STORE_KEY);
    if (!result[STORE_KEY]) return emptyStore();
    return result[STORE_KEY] as ProjectStore;
  }

  async saveProjectStore(store: ProjectStore): Promise<void> {
    return this.enqueue(() => chrome.storage.local.set({ [STORE_KEY]: store }));
  }

  async getProject(id: string): Promise<Project | null> {
    const store = await this.getProjectStore();
    return store.projects[id] ?? null;
  }

  async saveProject(project: Project): Promise<void> {
    return this.enqueue(async () => {
      const store = await this.getProjectStore();
      store.projects[project.id] = ensureProjectColor({ ...project, updatedAt: Date.now() });
      await chrome.storage.local.set({ [STORE_KEY]: store });
    });
  }

  async deleteProject(id: string): Promise<void> {
    return this.enqueue(async () => {
      const store = await this.getProjectStore();
      delete store.projects[id];
      await chrome.storage.local.set({ [STORE_KEY]: store });
    });
  }

  onExternalChange(callback: (store: ProjectStore) => void): () => void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[STORE_KEY]?.newValue) {
        callback(changes[STORE_KEY].newValue as ProjectStore);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }
}

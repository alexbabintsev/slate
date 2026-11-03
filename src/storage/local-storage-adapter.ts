import type { IStorage } from './storage-interface';
import type { AppSettings, Project, ProjectStore, Tombstone } from '../models/project';
import { DEFAULT_SETTINGS, ensureProjectColor } from '../models/project';

/*
 * Storage layout (schema 2), all in chrome.storage.local:
 *
 *   schemaVersion      2
 *   deviceId           random id of this installation
 *   settings           AppSettings
 *   project:<id>       one Project per key
 *   tombstone:<id>     { id, deletedAt, deletedBy } for deleted projects
 *
 * Schema 1 kept everything - every project, every uploaded icon - in a single
 * `projectStore` key, so each tab change rewrote the whole store. One key per
 * project makes autosave write only the project that changed, and gives a
 * future sync per-record timestamps and deletions to work with.
 */
export const SCHEMA_VERSION = 2;

const SCHEMA_KEY = 'schemaVersion';
const DEVICE_KEY = 'deviceId';
const SETTINGS_KEY = 'settings';
const LEGACY_KEY = 'projectStore';
const PROJECT_PREFIX = 'project:';
const TOMBSTONE_PREFIX = 'tombstone:';

const projectKey = (id: string) => PROJECT_PREFIX + id;
const tombstoneKey = (id: string) => TOMBSTONE_PREFIX + id;

type Snapshot = {
  projects: Record<string, Project>;
  tombstones: Record<string, Tombstone>;
  settings: AppSettings;
};

function withDefaults(settings: unknown): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<AppSettings> | undefined) };
}

/**
 * A project and its tombstone can coexist only if a delete was interrupted
 * between its two writes (the tombstone goes first). The newer record wins.
 */
function isLive(project: Project, tombstone: Tombstone | undefined): boolean {
  return !tombstone || project.updatedAt > tombstone.deletedAt;
}

export class LocalStorageAdapter implements IStorage {
  readonly backendType = 'local' as const;

  // Serialize all read-modify-write operations so concurrent saves don't clobber each other.
  private writeQueue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void> | null = null;
  private deviceId = '';

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = async () => {
      await this.ensureReady();
      return fn();
    };
    const next = this.writeQueue.then(run, run);
    this.writeQueue = next.catch(() => undefined);
    return next;
  }

  /** Migrate once per adapter; every read and write waits for it. A failure is retried next call. */
  private ensureReady(): Promise<void> {
    this.ready ??= this.migrate().catch(err => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  private async migrate(): Promise<void> {
    const local = chrome.storage.local;
    const found = await local.get([SCHEMA_KEY, DEVICE_KEY, LEGACY_KEY]);
    const writes: Record<string, unknown> = {};

    this.deviceId = (found[DEVICE_KEY] as string | undefined) ?? '';
    if (!this.deviceId) {
      this.deviceId = crypto.randomUUID();
      writes[DEVICE_KEY] = this.deviceId;
    }

    const legacy = found[LEGACY_KEY] as Partial<ProjectStore> | undefined;
    const version = (found[SCHEMA_KEY] as number | undefined) ?? 1;

    if (version < SCHEMA_VERSION) {
      const projects = legacy?.projects ?? {};
      for (const [id, project] of Object.entries(projects)) writes[projectKey(id)] = project;
      writes[SETTINGS_KEY] = withDefaults(legacy?.settings);
      await local.set(writes);

      // The version is the commit point: written only once every project is
      // confirmed in its new key, and the legacy copy is dropped only after it.
      // Writing it together with the copy would let a partly lost batch mark
      // the migration done, and the next start would delete the only full copy.
      const ids = Object.keys(projects);
      if (ids.length > 0) {
        const copied = await local.get(ids.map(projectKey));
        const missing = ids.filter(id => !copied[projectKey(id)]);
        if (missing.length > 0) {
          throw new Error(`[Slate] storage migration incomplete, kept legacy store: ${missing.join(', ')}`);
        }
      }
      await local.set({ [SCHEMA_KEY]: SCHEMA_VERSION });
      if (legacy) await local.remove(LEGACY_KEY);
      return;
    }

    if (Object.keys(writes).length > 0) await local.set(writes);
    // Interrupted after copying but before removing the legacy key: the copy is done.
    if (legacy) await local.remove(LEGACY_KEY);
  }

  private stamp(project: Project): Project {
    return ensureProjectColor({ ...project, updatedAt: Date.now(), updatedBy: this.deviceId });
  }

  private async readSnapshot(): Promise<Snapshot> {
    const all = await chrome.storage.local.get(null);
    const projects: Record<string, Project> = {};
    const tombstones: Record<string, Tombstone> = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(TOMBSTONE_PREFIX)) tombstones[key.slice(TOMBSTONE_PREFIX.length)] = value as Tombstone;
    }
    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith(PROJECT_PREFIX)) continue;
      const id = key.slice(PROJECT_PREFIX.length);
      if (isLive(value as Project, tombstones[id])) projects[id] = value as Project;
    }
    return { projects, tombstones, settings: withDefaults(all[SETTINGS_KEY]) };
  }

  /** Write the difference between `before` and `after`: changed projects, deletions, settings. */
  private async writeDiff(before: Snapshot, after: ProjectStore): Promise<void> {
    const local = chrome.storage.local;
    const writes: Record<string, unknown> = {};
    const restored: string[] = [];
    const deleted: string[] = [];

    for (const [id, project] of Object.entries(after.projects)) {
      const old = before.projects[id];
      if (old && JSON.stringify(old) === JSON.stringify(project)) continue;
      writes[projectKey(id)] = this.stamp({ ...project, id });
      if (before.tombstones[id]) restored.push(tombstoneKey(id));
    }
    for (const id of Object.keys(before.projects)) {
      if (after.projects[id]) continue;
      writes[tombstoneKey(id)] = this.tombstone(id);
      deleted.push(projectKey(id));
    }
    if (JSON.stringify(withDefaults(after.settings)) !== JSON.stringify(before.settings)) {
      writes[SETTINGS_KEY] = withDefaults(after.settings);
    }

    if (Object.keys(writes).length > 0) await local.set(writes);
    if (restored.length + deleted.length > 0) await local.remove([...restored, ...deleted]);
  }

  private tombstone(id: string): Tombstone {
    return { id, deletedAt: Date.now(), deletedBy: this.deviceId };
  }

  async getProjectStore(): Promise<ProjectStore> {
    await this.ensureReady();
    const { projects, settings } = await this.readSnapshot();
    return { projects, settings };
  }

  async saveProjectStore(store: ProjectStore): Promise<void> {
    return this.enqueue(async () => this.writeDiff(await this.readSnapshot(), store));
  }

  async updateProjectStore(fn: (store: ProjectStore) => void): Promise<void> {
    return this.enqueue(async () => {
      const before = await this.readSnapshot();
      const draft: ProjectStore = structuredClone({ projects: before.projects, settings: before.settings });
      fn(draft);
      await this.writeDiff(before, draft);
    });
  }

  async getSettings(): Promise<AppSettings> {
    await this.ensureReady();
    const found = await chrome.storage.local.get(SETTINGS_KEY);
    return withDefaults(found[SETTINGS_KEY]);
  }

  async getProject(id: string): Promise<Project | null> {
    await this.ensureReady();
    const found = await chrome.storage.local.get([projectKey(id), tombstoneKey(id)]);
    const project = found[projectKey(id)] as Project | undefined;
    if (!project) return null;
    return isLive(project, found[tombstoneKey(id)] as Tombstone | undefined) ? project : null;
  }

  async saveProject(project: Project): Promise<void> {
    return this.enqueue(async () => {
      await chrome.storage.local.set({ [projectKey(project.id)]: this.stamp(project) });
      await chrome.storage.local.remove(tombstoneKey(project.id));
    });
  }

  async updateProject(id: string, fn: (project: Project) => Project | null): Promise<Project | null> {
    return this.enqueue(async () => {
      const current = await this.getProject(id);
      if (!current) return null;
      const next = fn(current);
      if (!next) return null;
      const saved = this.stamp({ ...next, id });
      await chrome.storage.local.set({ [projectKey(id)]: saved });
      return saved;
    });
  }

  async deleteProject(id: string): Promise<void> {
    return this.enqueue(async () => {
      // Tombstone first: if the second write never happens, the tombstone still
      // marks the project deleted (see isLive).
      await chrome.storage.local.set({ [tombstoneKey(id)]: this.tombstone(id) });
      await chrome.storage.local.remove(projectKey(id));
    });
  }

  async getTombstones(): Promise<Tombstone[]> {
    await this.ensureReady();
    return Object.values((await this.readSnapshot()).tombstones);
  }

  async getDeviceId(): Promise<string> {
    await this.ensureReady();
    return this.deviceId;
  }
}

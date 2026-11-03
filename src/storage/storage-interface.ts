import type { AppSettings, Project, ProjectStore, Tombstone } from '../models/project';

export interface IStorage {
  /** Every live project plus settings, assembled from the per-project records. */
  getProjectStore(): Promise<ProjectStore>;
  /** Replace all projects and settings; projects missing from `store` are deleted. */
  saveProjectStore(store: ProjectStore): Promise<void>;
  /**
   * Read-modify-write the whole store atomically with respect to every other
   * write. `fn` mutates the store it is given in place; only the projects it
   * actually changed are written, and the ones it removed are deleted.
   */
  updateProjectStore(fn: (store: ProjectStore) => void): Promise<void>;
  getSettings(): Promise<AppSettings>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  /**
   * Atomically update one project from its latest stored state. `fn` returns
   * the new project, or null to leave it unchanged. A project that does not
   * exist (e.g. deleted meanwhile) is never recreated. Resolves to the stored
   * project, or null when nothing was written.
   */
  updateProject(id: string, fn: (project: Project) => Project | null): Promise<Project | null>;
  /** Delete a project and leave a tombstone for it. */
  deleteProject(id: string): Promise<void>;
  getTombstones(): Promise<Tombstone[]>;
  /** Stable random id of this installation, stamped on every write. */
  getDeviceId(): Promise<string>;
  readonly backendType: 'local' | 'cloud';
}

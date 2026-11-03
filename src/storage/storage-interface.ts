import type { Project, ProjectStore } from '../models/project';

export interface IStorage {
  getProjectStore(): Promise<ProjectStore>;
  saveProjectStore(store: ProjectStore): Promise<void>;
  /**
   * Read-modify-write the whole store atomically with respect to every other
   * write. `fn` mutates the store it is given in place.
   */
  updateProjectStore(fn: (store: ProjectStore) => void): Promise<void>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  /**
   * Atomically update one project from its latest stored state. `fn` returns
   * the new project, or null to leave it unchanged. A project that does not
   * exist (e.g. deleted meanwhile) is never recreated. Resolves to the stored
   * project, or null when nothing was written.
   */
  updateProject(id: string, fn: (project: Project) => Project | null): Promise<Project | null>;
  deleteProject(id: string): Promise<void>;
  onExternalChange(callback: (store: ProjectStore) => void): () => void;
  readonly backendType: 'local' | 'cloud';
}

import type { Project, ProjectStore } from '../models/project';

export interface IStorage {
  getProjectStore(): Promise<ProjectStore>;
  saveProjectStore(store: ProjectStore): Promise<void>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  onExternalChange(callback: (store: ProjectStore) => void): () => void;
  readonly backendType: 'local' | 'cloud';
}

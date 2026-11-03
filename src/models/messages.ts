import type { Project, ProjectStore } from './project';

export type CLICommand =
  | { action: 'open'; projectName: string }
  | { action: 'close'; projectName: string }
  | { action: 'list' };

export type ProjectMetaPatch = Partial<Pick<Project, 'name' | 'icon' | 'color'>>;

export type Message =
  | { type: 'GET_CURRENT_PROJECT'; windowId: number }
  | { type: 'GET_ALL_PROJECTS' }
  | { type: 'OPEN_PROJECT'; projectId: string }
  | { type: 'CLOSE_PROJECT'; projectId: string }
  | { type: 'CREATE_PROJECT'; name: string; icon?: string }
  | { type: 'DELETE_PROJECT'; projectId: string }
  // Only the user-editable fields: the UI's copy of the tabs may be stale, and
  // sending a whole project used to overwrite newer autosaved tabs with it.
  | { type: 'UPDATE_PROJECT_META'; projectId: string; patch: ProjectMetaPatch }
  | { type: 'REORDER_PROJECTS'; orderedIds: string[] }
  | { type: 'EXPORT_PROJECTS' }
  | { type: 'IMPORT_PROJECTS'; store: Partial<ProjectStore> }
  | { type: 'GET_WINDOW_FOR_PROJECT'; projectId: string }
  | { type: 'ASSIGN_WINDOW'; windowId: number; projectId: string }
  | { type: 'CLI_COMMAND'; command: CLICommand };

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

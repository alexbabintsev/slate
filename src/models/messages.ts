import type { Project, ProjectStore } from './project';

export type CLICommand =
  | { action: 'open'; projectName: string }
  | { action: 'close'; projectName: string }
  | { action: 'list' };

export type Message =
  | { type: 'GET_CURRENT_PROJECT'; windowId: number }
  | { type: 'GET_ALL_PROJECTS' }
  | { type: 'OPEN_PROJECT'; projectId: string }
  | { type: 'CLOSE_PROJECT'; projectId: string }
  | { type: 'CREATE_PROJECT'; name: string; icon?: string }
  | { type: 'DELETE_PROJECT'; projectId: string }
  | { type: 'SAVE_PROJECT'; project: Project }
  | { type: 'REORDER_PROJECTS'; orderedIds: string[] }
  | { type: 'EXPORT_PROJECTS' }
  | { type: 'IMPORT_PROJECTS'; store: Partial<ProjectStore> }
  | { type: 'GET_WINDOW_FOR_PROJECT'; projectId: string }
  | { type: 'ASSIGN_WINDOW'; windowId: number; projectId: string }
  | { type: 'CLI_COMMAND'; command: CLICommand };

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

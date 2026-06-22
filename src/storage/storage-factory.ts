import type { IStorage } from './storage-interface';
import { LocalStorageAdapter } from './local-storage-adapter';

let instance: IStorage | null = null;

export function getStorage(): IStorage {
  if (!instance) instance = new LocalStorageAdapter();
  return instance;
}

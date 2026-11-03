// Minimal chrome.storage mock for unit tests.
// Each operation has a configurable async delay so tests can simulate races.
import { createFakeArea } from './fake-storage-area';

export type MockStorage = {
  store: Record<string, unknown>;
  getDelayMs: number;
  setDelayMs: number;
};

export function installChromeStorageMock(): MockStorage {
  const local = createFakeArea();
  const session = createFakeArea();

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: local.area, session: session.area },
  };

  // Delays and data are read live from the area, so writes through this
  // handle (mock.setDelayMs = 5, mock.store) reach it.
  return {
    get store() { return local.data; },
    set store(v) { local.data = v; },
    get getDelayMs() { return local.getDelayMs; },
    set getDelayMs(v) { local.getDelayMs = v; },
    get setDelayMs() { return local.setDelayMs; },
    set setDelayMs(v) { local.setDelayMs = v; },
  };
}

export function clearChromeStorageMock(state: MockStorage): void {
  state.store = {};
  state.getDelayMs = 0;
  state.setDelayMs = 0;
}

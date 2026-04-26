// Minimal chrome.storage.local mock for unit tests.
// Each operation has a configurable async delay so tests can simulate races.

export type MockStorage = {
  store: Record<string, unknown>;
  getDelayMs: number;
  setDelayMs: number;
};

export function installChromeStorageMock(): MockStorage {
  const state: MockStorage = {
    store: {},
    getDelayMs: 0,
    setDelayMs: 0,
  };

  const wait = (ms: number) =>
    ms > 0 ? new Promise<void>(r => setTimeout(r, ms)) : Promise.resolve();

  const local = {
    get: async (key: string) => {
      await wait(state.getDelayMs);
      return key in state.store
        ? { [key]: structuredClone(state.store[key]) }
        : {};
    },
    set: async (entry: Record<string, unknown>) => {
      await wait(state.setDelayMs);
      for (const [k, v] of Object.entries(entry)) {
        state.store[k] = structuredClone(v);
      }
    },
    onChanged: { addListener: () => {}, removeListener: () => {} },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local, session: { ...local } },
  };

  return state;
}

export function clearChromeStorageMock(state: MockStorage): void {
  state.store = {};
  state.getDelayMs = 0;
  state.setDelayMs = 0;
}

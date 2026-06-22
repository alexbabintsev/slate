import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeStorageMock, clearChromeStorageMock, type MockStorage } from './setup-chrome-mock';

let mock: MockStorage;
let LocalStorageAdapter: typeof import('../src/storage/local-storage-adapter').LocalStorageAdapter;

beforeEach(async () => {
  mock = installChromeStorageMock();
  // Re-import each test to get a fresh adapter instance with a clean queue
  ({ LocalStorageAdapter } = await import('../src/storage/local-storage-adapter'));
});

function makeProject(id: string, name = id) {
  return {
    id,
    name,
    icon: '',
    tabs: [],
    tabGroups: [],
    activeTabIndex: 0,
    createdAt: 1,
    updatedAt: 1,
    sortOrder: 1,
  };
}

describe('LocalStorageAdapter', () => {
  it('round-trips a project store', async () => {
    const adapter = new LocalStorageAdapter();
    const store = {
      projects: { p1: makeProject('p1') },
      settings: { autoSaveDebounceMs: 1500, storageBackend: 'local' as const, syncEnabled: false },
    };
    await adapter.saveProjectStore(store);
    const loaded = await adapter.getProjectStore();
    expect(loaded.projects.p1.name).toBe('p1');
  });

  it('returns empty store when nothing saved', async () => {
    const adapter = new LocalStorageAdapter();
    const loaded = await adapter.getProjectStore();
    expect(loaded.projects).toEqual({});
    expect(loaded.settings).toBeDefined();
  });

  it('saveProject ensures color is set', async () => {
    const adapter = new LocalStorageAdapter();
    const project = makeProject('p1');
    await adapter.saveProject(project);
    const loaded = await adapter.getProject('p1');
    expect(loaded!.color).toBeDefined();
    expect(loaded!.color!.startsWith('#')).toBe(true);
  });

  it('deleteProject removes the project', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProject(makeProject('p1'));
    await adapter.saveProject(makeProject('p2'));
    await adapter.deleteProject('p1');
    expect(await adapter.getProject('p1')).toBeNull();
    expect(await adapter.getProject('p2')).not.toBeNull();
  });

  it('serializes concurrent saves: no project is lost', async () => {
    const adapter = new LocalStorageAdapter();
    // Make set() slow so a naive implementation would race
    mock.setDelayMs = 10;
    mock.getDelayMs = 5;

    const ops = Array.from({ length: 20 }, (_, i) =>
      adapter.saveProject(makeProject(`p${i}`)),
    );
    await Promise.all(ops);

    const store = await adapter.getProjectStore();
    expect(Object.keys(store.projects).sort()).toEqual(
      Array.from({ length: 20 }, (_, i) => `p${i}`).sort(),
    );
  });

  it('serializes concurrent save + delete', async () => {
    const adapter = new LocalStorageAdapter();
    mock.setDelayMs = 5;

    await adapter.saveProject(makeProject('keep'));
    await Promise.all([
      adapter.saveProject(makeProject('p1')),
      adapter.saveProject(makeProject('p2')),
      adapter.deleteProject('p1'),
      adapter.saveProject(makeProject('p3')),
    ]);

    const store = await adapter.getProjectStore();
    expect(Object.keys(store.projects).sort()).toEqual(['keep', 'p2', 'p3']);
  });

  it('queue continues after a failed write', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProject(makeProject('first'));

    // Inject one failing set, then restore
    const realChrome = (globalThis as unknown as { chrome: { storage: { local: { set: typeof chrome.storage.local.set } } } }).chrome;
    const realSet = realChrome.storage.local.set;
    let failedOnce = false;
    realChrome.storage.local.set = async (entry: Record<string, unknown>) => {
      if (!failedOnce) { failedOnce = true; throw new Error('disk full'); }
      return realSet(entry);
    };

    await expect(adapter.saveProject(makeProject('boom'))).rejects.toThrow('disk full');
    // Subsequent save must still go through
    await adapter.saveProject(makeProject('after'));
    const store = await adapter.getProjectStore();
    expect(store.projects.first).toBeDefined();
    expect(store.projects.after).toBeDefined();
  });

  it('reflects backendType', () => {
    expect(new LocalStorageAdapter().backendType).toBe('local');
  });
});

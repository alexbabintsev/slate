import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeStorageMock, type MockStorage } from './setup-chrome-mock';
import type { Project } from '../src/models/project';
import { DEFAULT_SETTINGS } from '../src/models/project';

let mock: MockStorage;
let LocalStorageAdapter: typeof import('../src/storage/local-storage-adapter').LocalStorageAdapter;

beforeEach(async () => {
  mock = installChromeStorageMock();
  ({ LocalStorageAdapter } = await import('../src/storage/local-storage-adapter'));
});

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: id,
    icon: '',
    color: '#4f86e8',
    tabs: [{ url: `https://${id}.example/`, title: id, pinned: false, index: 0 }],
    tabGroups: [],
    activeTabIndex: 0,
    createdAt: 1,
    updatedAt: 1,
    sortOrder: 1,
    ...overrides,
  };
}

function seedLegacy(projects: Project[], settings = { ...DEFAULT_SETTINGS, autoSaveDebounceMs: 900 }) {
  mock.store.projectStore = { projects: Object.fromEntries(projects.map(p => [p.id, p])), settings };
}

/** Record the keys every set() call writes. */
function spyOnWrites(): string[][] {
  const calls: string[][] = [];
  const area = (globalThis as unknown as { chrome: { storage: { local: { set: (i: Record<string, unknown>) => Promise<void> } } } }).chrome.storage.local;
  const realSet = area.set;
  area.set = async items => { calls.push(Object.keys(items)); return realSet(items); };
  return calls;
}

describe('migration from the single-key store', () => {
  it('moves every project to its own key and drops the legacy store', async () => {
    seedLegacy([project('a'), project('b', { icon: 'data:image/png;base64,AAAA' })]);

    const store = await new LocalStorageAdapter().getProjectStore();

    expect(Object.keys(store.projects).sort()).toEqual(['a', 'b']);
    expect(store.projects.b.icon).toBe('data:image/png;base64,AAAA');
    expect(store.settings.autoSaveDebounceMs).toBe(900);
    expect(mock.store.projectStore).toBeUndefined();
    expect(mock.store.schemaVersion).toBe(2);
    expect(mock.store['project:a']).toEqual(project('a'));
    expect(typeof mock.store.deviceId).toBe('string');
  });

  it('runs once: a second start changes nothing and keeps the device id', async () => {
    seedLegacy([project('a')]);
    await new LocalStorageAdapter().getProjectStore();
    const after = structuredClone(mock.store);

    await new LocalStorageAdapter().getProjectStore();

    expect(mock.store).toEqual(after);
  });

  it('sets up a fresh install without a legacy store', async () => {
    const store = await new LocalStorageAdapter().getProjectStore();
    expect(store.projects).toEqual({});
    expect(mock.store.schemaVersion).toBe(2);
    expect(mock.store.deviceId).toBeTruthy();
  });

  it('finishes an interrupted migration without overwriting newer per-project data', async () => {
    // Crashed after the copy, before removing the legacy key; then the project
    // was edited. The stale legacy copy must not come back.
    mock.store.schemaVersion = 2;
    mock.store.deviceId = 'dev-1';
    mock.store['project:a'] = project('a', { name: 'Renamed later', updatedAt: 50 });
    seedLegacy([project('a', { name: 'Old' })]);

    const store = await new LocalStorageAdapter().getProjectStore();

    expect(store.projects.a.name).toBe('Renamed later');
    expect(mock.store.projectStore).toBeUndefined();
  });

  it('keeps the legacy store when the copy cannot be confirmed, and retries', async () => {
    seedLegacy([project('a')]);
    const area = (globalThis as unknown as { chrome: { storage: { local: { set: (i: Record<string, unknown>) => Promise<void> } } } }).chrome.storage.local;
    const realSet = area.set;
    let dropped = false;
    area.set = async items => {
      // Simulate a write that silently loses the project key once.
      if (!dropped && 'project:a' in items) { dropped = true; const { ['project:a']: _, ...rest } = items; return realSet(rest); }
      return realSet(items);
    };

    const adapter = new LocalStorageAdapter();
    await expect(adapter.getProjectStore()).rejects.toThrow(/migration incomplete/);
    // Not committed: no version, and the legacy store - the only full copy - kept.
    expect(mock.store.schemaVersion).toBeUndefined();
    expect(mock.store.projectStore).toBeDefined();

    // The next call retries and completes.
    const store = await adapter.getProjectStore();
    expect(store.projects.a).toBeDefined();
    expect(mock.store.projectStore).toBeUndefined();
  });
});

describe('per-project records', () => {
  it('autosave writes only the project that changed', async () => {
    seedLegacy([project('a'), project('b', { icon: 'data:image/png;base64,' + 'A'.repeat(1000) })]);
    const adapter = new LocalStorageAdapter();
    await adapter.getProjectStore();
    const writes = spyOnWrites();

    await adapter.updateProject('a', p => ({ ...p, tabs: [] }));

    expect(writes).toEqual([['project:a']]);
  });

  it('a whole-store update writes only what it changed', async () => {
    seedLegacy([project('a'), project('b'), project('c')]);
    const adapter = new LocalStorageAdapter();
    await adapter.getProjectStore();
    const writes = spyOnWrites();

    await adapter.updateProjectStore(store => { store.projects.b.sortOrder = 99; });

    expect(writes).toEqual([['project:b']]);
  });

  it('stamps every write with the time and this device', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProject(project('a'));
    const saved = await adapter.getProject('a');
    expect(saved!.updatedBy).toBe(await adapter.getDeviceId());
    expect(saved!.updatedAt).toBeGreaterThan(1);
  });
});

describe('tombstones', () => {
  it('deleting leaves a tombstone and hides the project', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProject(project('a'));

    await adapter.deleteProject('a');

    expect(await adapter.getProject('a')).toBeNull();
    expect((await adapter.getProjectStore()).projects.a).toBeUndefined();
    const [tomb] = await adapter.getTombstones();
    expect(tomb).toMatchObject({ id: 'a', deletedBy: await adapter.getDeviceId() });
  });

  it('removing a project inside a store update leaves a tombstone too', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProject(project('a'));
    await adapter.updateProjectStore(store => { delete store.projects.a; });
    expect((await adapter.getTombstones()).map(t => t.id)).toEqual(['a']);
  });

  it('a project deleted mid-write (tombstone newer) stays hidden', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.getProjectStore();
    mock.store['project:a'] = project('a', { updatedAt: 10 });
    mock.store['tombstone:a'] = { id: 'a', deletedAt: 20, deletedBy: 'x' };

    expect(await adapter.getProject('a')).toBeNull();
    expect((await adapter.getProjectStore()).projects.a).toBeUndefined();
  });

  it('re-importing a deleted project brings it back and clears its tombstone', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProject(project('a'));
    await adapter.deleteProject('a');

    await adapter.updateProjectStore(store => { store.projects.a = project('a'); });

    expect(await adapter.getProject('a')).not.toBeNull();
    expect(await adapter.getTombstones()).toEqual([]);
  });

  it('updateProject never revives a deleted project', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProject(project('a'));
    await adapter.deleteProject('a');
    expect(await adapter.updateProject('a', p => p)).toBeNull();
    expect(mock.store['project:a']).toBeUndefined();
  });
});

describe('settings', () => {
  it('are read from their own key with defaults filled in', async () => {
    seedLegacy([], { autoSaveDebounceMs: 700 } as typeof DEFAULT_SETTINGS);
    const settings = await new LocalStorageAdapter().getSettings();
    expect(settings.autoSaveDebounceMs).toBe(700);
    expect(settings.storageBackend).toBe(DEFAULT_SETTINGS.storageBackend);
  });
});


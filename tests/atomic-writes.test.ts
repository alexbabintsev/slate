import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeStorageMock, type MockStorage } from './setup-chrome-mock';
import type { Project } from '../src/models/project';

function makeProject(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: id,
    icon: '',
    tabs: [],
    tabGroups: [],
    activeTabIndex: 0,
    createdAt: 1,
    updatedAt: 1,
    sortOrder: 1,
    ...overrides,
  };
}

describe('LocalStorageAdapter atomic updates', () => {
  let mock: MockStorage;
  let LocalStorageAdapter: typeof import('../src/storage/local-storage-adapter').LocalStorageAdapter;

  beforeEach(async () => {
    mock = installChromeStorageMock();
    ({ LocalStorageAdapter } = await import('../src/storage/local-storage-adapter'));
  });

  it('updateProject never recreates a deleted project', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProject(makeProject('p1'));
    await adapter.deleteProject('p1');
    const result = await adapter.updateProject('p1', p => ({ ...p, name: 'back' }));
    expect(result).toBeNull();
    expect(await adapter.getProject('p1')).toBeNull();
  });

  it('updateProject leaves storage alone when fn returns null', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProject(makeProject('p1'));
    const before = structuredClone(mock.store);
    expect(await adapter.updateProject('p1', () => null)).toBeNull();
    expect(mock.store).toEqual(before);
  });

  it('concurrent store and project updates do not lose each other', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProject(makeProject('a', { sortOrder: 1 }));
    await adapter.saveProject(makeProject('b', { sortOrder: 2 }));
    mock.getDelayMs = 5;
    mock.setDelayMs = 5;

    // A reorder and an autosave of tabs racing each other - the old
    // read-outside-the-queue reorder wrote back a store without the new tabs.
    await Promise.all([
      adapter.updateProjectStore(store => {
        store.projects.a.sortOrder = 2000;
        store.projects.b.sortOrder = 1000;
      }),
      adapter.updateProject('a', p => ({ ...p, tabs: [{ url: 'https://new.example/', title: '', pinned: false, index: 0 }] })),
    ]);

    const a = await adapter.getProject('a');
    expect(a!.sortOrder).toBe(2000);
    expect(a!.tabs.map(t => t.url)).toEqual(['https://new.example/']);
  });
});

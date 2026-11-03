import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installFakeChrome } from './fake-chrome-windows';
import type { Project, ProjectStore } from '../src/models/project';
import { DEFAULT_SETTINGS } from '../src/models/project';

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

describe('UPDATE_PROJECT_META', () => {
  let fake: ReturnType<typeof installFakeChrome>;

  beforeEach(async () => {
    fake = installFakeChrome();
    const stale = makeProject('p1', { tabs: [{ url: 'https://new.example/', title: '', pinned: false, index: 0 }] });
    fake.setLocal('projectStore', { projects: { p1: stale }, settings: DEFAULT_SETTINGS });
    vi.resetModules();
    await import('../src/background/service-worker');
  });

  const stored = () => (fake.getLocal('projectStore') as ProjectStore).projects.p1;

  it('renames without touching the autosaved tabs', async () => {
    const res = await fake.sendMessage({ type: 'UPDATE_PROJECT_META', projectId: 'p1', patch: { name: '  Renamed  ' } });
    expect(res.ok).toBe(true);
    expect(stored().name).toBe('Renamed');
    expect(stored().tabs.map(t => t.url)).toEqual(['https://new.example/']);
  });

  it('rejects an empty name and an invalid color', async () => {
    expect((await fake.sendMessage({ type: 'UPDATE_PROJECT_META', projectId: 'p1', patch: { name: '  ' } })).ok).toBe(false);
    expect((await fake.sendMessage({ type: 'UPDATE_PROJECT_META', projectId: 'p1', patch: { color: 'red;x' } })).ok).toBe(false);
    expect(stored().name).toBe('p1');
  });

  it('drops an unsafe icon', async () => {
    await fake.sendMessage({ type: 'UPDATE_PROJECT_META', projectId: 'p1', patch: { icon: 'data:text/html;base64,PGgxPg==' } });
    expect(stored().icon).toBe('');
  });

  it('reports a missing project instead of creating it', async () => {
    const res = await fake.sendMessage({ type: 'UPDATE_PROJECT_META', projectId: 'nope', patch: { name: 'x' } });
    expect(res.ok).toBe(false);
    expect((fake.getLocal('projectStore') as ProjectStore).projects.nope).toBeUndefined();
  });
});

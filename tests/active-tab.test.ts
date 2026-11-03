import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installFakeChrome } from './fake-chrome-windows';
import type { Project, ProjectStore } from '../src/models/project';
import { DEFAULT_SETTINGS } from '../src/models/project';

type Fake = ReturnType<typeof installFakeChrome>;

function project(tabs: Array<{ url: string; pinned?: boolean }>, activeTabIndex: number): Project {
  return {
    id: 'p1',
    name: 'Work',
    icon: '',
    tabs: tabs.map((t, index) => ({ url: t.url, title: '', pinned: !!t.pinned, index })),
    tabGroups: [],
    activeTabIndex,
    createdAt: 0,
    updatedAt: 0,
    sortOrder: 0,
  };
}

async function load(fake: Fake, p: Project) {
  fake.setLocal('projectStore', { projects: { [p.id]: p }, settings: DEFAULT_SETTINGS });
  vi.resetModules();
  const sw = await import('../src/background/service-worker');
  const sync = await import('../src/background/tab-sync');
  return { openProject: sw.openProject, saveProjectTabs: sync.saveProjectTabs };
}

const stored = (fake: Fake) => fake.getProject('p1')!;

describe('active tab', () => {
  let fake: Fake;
  beforeEach(() => { fake = installFakeChrome(); });

  it('is saved from the tabs themselves, not from in-memory state lost on worker restart', async () => {
    const { saveProjectTabs } = await load(fake, project([{ url: 'https://a.example/' }], 0));
    const windowId = fake.addWindow(['https://a.example/', 'https://b.example/', 'https://c.example/']);
    const b = fake.tabsIn(windowId)[1];
    await fake.chrome.tabs.update(b.id, { active: true });

    // Fresh module = a restarted service worker: windowActiveIndex is empty.
    await saveProjectTabs('p1', windowId);

    expect(stored(fake).activeTabIndex).toBe(1);
  });

  it('is restored onto the right tab when unrestorable tabs are skipped and pinned tabs move', async () => {
    // chrome://settings is dropped on restore and the pinned tab jumps to the
    // front, so a raw index lookup lands on the wrong tab.
    const p = project([
      { url: 'chrome://settings/' },
      { url: 'https://a.example/' },
      { url: 'https://b.example/' },
      { url: 'https://pinned.example/', pinned: true },
    ], 2);
    const { openProject } = await load(fake, p);

    const windowId = await openProject('p1');
    const active = fake.tabsIn(windowId).find(t => t.active)!;

    expect(active.url).toBe('https://b.example/');
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installFakeChrome, NO_GROUP } from './fake-chrome-windows';
import type { Project } from '../src/models/project';
import { DEFAULT_SETTINGS } from '../src/models/project';

// Bug report (post Chrome update): tab groups stopped being restored, and
// opening a project scattered its tabs between the current window and the
// project's new window.

type Fake = ReturnType<typeof installFakeChrome>;

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Work',
    icon: '',
    tabs: [],
    tabGroups: [],
    activeTabIndex: 0,
    createdAt: 0,
    updatedAt: 0,
    sortOrder: 0,
    ...overrides,
  };
}

function tab(url: string, index: number, groupId?: number, pinned = false) {
  return { url, title: url, pinned, index, groupId };
}

async function loadOpenProject(fake: Fake, p: Project) {
  fake.setLocal('projectStore', { projects: { [p.id]: p }, settings: DEFAULT_SETTINGS });
  vi.resetModules();
  const mod = await import('../src/background/service-worker');
  return mod.openProject;
}

describe('openProject tab group restore', () => {
  let fake: Fake;

  beforeEach(() => {
    fake = installFakeChrome({ focusedWindowId: 1 });
  });

  it('restores a saved group with its title, color and members', async () => {
    const p = project({
      tabs: [tab('https://a.example/', 0, 0), tab('https://b.example/', 1, 0), tab('https://c.example/', 2)],
      tabGroups: [{ id: 0, title: 'Docs', color: 'blue', collapsed: false }],
    });
    const openProject = await loadOpenProject(fake, p);

    const windowId = await openProject('p1');
    const tabs = fake.tabsIn(windowId);

    expect(tabs).toHaveLength(3);
    const grouped = tabs.filter(t => t.groupId !== NO_GROUP);
    expect(grouped.map(t => t.url)).toEqual(['https://a.example/', 'https://b.example/']);

    const g = fake.group(grouped[0].groupId)!;
    expect(g.title).toBe('Docs');
    expect(g.color).toBe('blue');
    expect(g.windowId).toBe(windowId);
  });

  it('keeps every tab in the project window - none leak into the focused window', async () => {
    const p = project({
      tabs: [tab('https://a.example/', 0, 0), tab('https://b.example/', 1, 0), tab('https://c.example/', 2, 1)],
      tabGroups: [
        { id: 0, title: 'Docs', color: 'blue', collapsed: false },
        { id: 1, title: 'Refs', color: 'red', collapsed: false },
      ],
    });
    const openProject = await loadOpenProject(fake, p);

    const windowId = await openProject('p1');

    expect(fake.tabsIn(windowId)).toHaveLength(3);
    // The previously focused window still holds only its own original tab.
    expect(fake.tabsIn(fake.focusedWindowId).map(t => t.url)).toEqual(['https://focused.example/']);
  });

  it('groups the correct tabs even when pinning reorders the window', async () => {
    // The pinned tab is saved last but jumps to index 0 once pinned, which
    // invalidates any positional saved-tab -> live-tab mapping.
    const p = project({
      tabs: [
        tab('https://a.example/', 0, 0),
        tab('https://b.example/', 1, 0),
        tab('https://pinned.example/', 2, undefined, true),
      ],
      tabGroups: [{ id: 0, title: 'Docs', color: 'blue', collapsed: false }],
    });
    const openProject = await loadOpenProject(fake, p);

    const windowId = await openProject('p1');
    const tabs = fake.tabsIn(windowId);

    const pinned = tabs.find(t => t.pinned)!;
    expect(pinned.url).toBe('https://pinned.example/');
    expect(pinned.groupId).toBe(NO_GROUP);

    const grouped = tabs.filter(t => t.groupId !== NO_GROUP).map(t => t.url).sort();
    expect(grouped).toEqual(['https://a.example/', 'https://b.example/']);
  });

  it('restores multiple groups as distinct groups', async () => {
    const p = project({
      tabs: [tab('https://a.example/', 0, 0), tab('https://b.example/', 1, 1)],
      tabGroups: [
        { id: 0, title: 'Docs', color: 'blue', collapsed: false },
        { id: 1, title: 'Refs', color: 'red', collapsed: true },
      ],
    });
    const openProject = await loadOpenProject(fake, p);

    const windowId = await openProject('p1');
    const groups = fake.groups().filter(g => g.windowId === windowId);

    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.title).sort()).toEqual(['Docs', 'Refs']);
    expect(groups.find(g => g.title === 'Refs')!.collapsed).toBe(true);
  });

  it('still restores groups when windows.create reports a partial tab list', async () => {
    fake = installFakeChrome({ focusedWindowId: 1, createReturnsSettledTabs: false });
    const p = project({
      tabs: [tab('https://a.example/', 0, 0), tab('https://b.example/', 1, 0), tab('https://c.example/', 2)],
      tabGroups: [{ id: 0, title: 'Docs', color: 'blue', collapsed: false }],
    });
    const openProject = await loadOpenProject(fake, p);

    const windowId = await openProject('p1');
    const tabs = fake.tabsIn(windowId);

    expect(tabs).toHaveLength(3);
    expect(tabs.filter(t => t.groupId !== NO_GROUP).map(t => t.url).sort())
      .toEqual(['https://a.example/', 'https://b.example/']);
    expect(fake.tabsIn(fake.focusedWindowId)).toHaveLength(1);
  });

  it('activates the saved active tab', async () => {
    const p = project({
      tabs: [tab('https://a.example/', 0), tab('https://b.example/', 1), tab('https://c.example/', 2)],
      activeTabIndex: 2,
    });
    const openProject = await loadOpenProject(fake, p);

    const windowId = await openProject('p1');
    const active = fake.tabsIn(windowId).find(t => t.active)!;

    expect(active.url).toBe('https://c.example/');
  });
});

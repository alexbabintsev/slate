import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installFakeChrome } from './fake-chrome-windows';
import type { Project } from '../src/models/project';
import { DEFAULT_SETTINGS } from '../src/models/project';

type Fake = ReturnType<typeof installFakeChrome>;
const MAP_KEY = 'windowProjectMap';

const work: Project = {
  id: 'p1',
  name: 'Work',
  icon: '',
  tabs: [{ url: 'https://a.example/', title: '', pinned: false, index: 0 }],
  tabGroups: [],
  activeTabIndex: 0,
  createdAt: 0,
  updatedAt: 0,
  sortOrder: 0,
};

async function load(fake: Fake) {
  fake.setLocal('projectStore', { projects: { p1: work }, settings: DEFAULT_SETTINGS });
  vi.resetModules();
  const sw = await import('../src/background/service-worker');
  const tracker = await import('../src/background/window-tracker');
  return { openProject: sw.openProject, ...tracker };
}

const windowCount = (fake: Fake) => new Set(fake.allTabs().map(t => t.windowId)).size;

describe('openProject races', () => {
  let fake: Fake;
  beforeEach(() => { fake = installFakeChrome(); });

  it('two simultaneous opens create one window', async () => {
    const { openProject } = await load(fake);
    const before = windowCount(fake);

    const [a, b] = await Promise.all([openProject('p1'), openProject('p1')]);

    expect(a).toBe(b);
    expect(windowCount(fake)).toBe(before + 1);
  });

  it('a link to a window that no longer exists does not block opening', async () => {
    const { openProject } = await load(fake);
    fake.setSession(MAP_KEY, { 4242: 'p1' });

    const windowId = await openProject('p1');

    expect(windowId).not.toBe(4242);
    expect(fake.getSession(MAP_KEY)).toEqual({ [windowId]: 'p1' });
  });
});

describe('window map', () => {
  let fake: Fake;
  beforeEach(() => { fake = installFakeChrome(); });

  it('concurrent changes do not drop each other', async () => {
    const { associateWindow, dissociateWindow, getAllAssociations } = await load(fake);
    fake.setSession(MAP_KEY, { 1: 'x', 2: 'y' });

    await Promise.all([dissociateWindow(1), dissociateWindow(2), associateWindow(3, 'z')]);

    expect(await getAllAssociations()).toEqual({ 3: 'z' });
  });

  it('keeps a project bound to one window only', async () => {
    const { associateWindow, getAllAssociations } = await load(fake);
    await associateWindow(1, 'p1');
    await associateWindow(2, 'p1');
    expect(await getAllAssociations()).toEqual({ 2: 'p1' });
  });
});

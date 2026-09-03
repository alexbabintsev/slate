import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/models/project';
import type { Project } from '../src/models/project';

// Reported: group a few tabs, close the project window, reopen -> the group is
// gone. Chrome does NOT fire tabs.onUpdated when a tab's groupId changes, so the
// tab cache used by the close-time save still holds pre-grouping tabs.

const NO_GROUP = -1;

type Listener = (...args: any[]) => void;

function installChrome() {
  const listeners: Record<string, Listener[]> = {};
  const on = (name: string) => ({
    addListener: (fn: Listener) => { (listeners[name] ??= []).push(fn); },
  });
  const fire = async (name: string, ...args: any[]) => {
    for (const fn of listeners[name] ?? []) await fn(...args);
  };

  const tabs: any[] = [];
  const groups = new Map<number, any>();
  const openWindows = new Set<number>([WIN]);
  const local: Record<string, any> = {};
  const session: Record<string, any> = {};

  const chromeMock = {
    tabs: {
      query: async (q: any) => {
        let out = tabs;
        if (q.windowId !== undefined) out = out.filter(t => t.windowId === q.windowId);
        if (q.active !== undefined) out = out.filter(t => t.active === q.active);
        return out.map(t => ({ ...t }));
      },
      onActivated: on('tabs.onActivated'),
      onUpdated: on('tabs.onUpdated'),
      onMoved: on('tabs.onMoved'),
      onCreated: on('tabs.onCreated'),
      onAttached: on('tabs.onAttached'),
      onDetached: on('tabs.onDetached'),
      onRemoved: on('tabs.onRemoved'),
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: NO_GROUP,
      query: async ({ windowId }: any) => [...groups.values()].filter(g => g.windowId === windowId),
      onCreated: on('tabGroups.onCreated'),
      onUpdated: on('tabGroups.onUpdated'),
      onRemoved: on('tabGroups.onRemoved'),
    },
    windows: {
      WINDOW_ID_NONE: -1,
      // Chrome rejects for a window that is going away; the fake keeps the
      // window alive unless a test removes it.
      get: async (id: number) => {
        if (!openWindows.has(id)) throw new Error('No window with id ' + id);
        return { id };
      },
      onFocusChanged: on('windows.onFocusChanged'),
      onRemoved: on('windows.onRemoved'),
    },
    runtime: {
      onStartup: on('runtime.onStartup'),
      onInstalled: on('runtime.onInstalled'),
      onMessage: on('runtime.onMessage'),
    },
    storage: {
      local: {
        get: async (k: string) => (k in local ? { [k]: structuredClone(local[k]) } : {}),
        set: async (e: any) => { Object.assign(local, structuredClone(e)); },
        onChanged: { addListener: () => {} },
      },
      session: {
        get: async (k: string) => (k in session ? { [k]: structuredClone(session[k]) } : {}),
        set: async (e: any) => { Object.assign(session, structuredClone(e)); },
        onChanged: { addListener: () => {} },
      },
    },
  };
  (globalThis as any).chrome = chromeMock;
  return { fire, tabs, groups, local, session, openWindows };
}

const WIN = 10;

function project(): Project {
  return {
    id: 'p1', name: 'Work', icon: '',
    tabs: [
      { url: 'https://a.example/', title: 'a', pinned: false, index: 0 },
      { url: 'https://b.example/', title: 'b', pinned: false, index: 1 },
    ],
    tabGroups: [], activeTabIndex: 0, createdAt: 0, updatedAt: 0, sortOrder: 0,
  };
}

describe('grouping then closing the window', () => {
  let env: ReturnType<typeof installChrome>;

  beforeEach(() => { env = installChrome(); });

  it('persists the group the user created before closing', async () => {
    env.local.projectStore = { projects: { p1: project() }, settings: DEFAULT_SETTINGS };
    env.session.windowProjectMap = { [WIN]: 'p1' };

    env.tabs.push(
      { id: 1, windowId: WIN, index: 0, url: 'https://a.example/', title: 'a', pinned: false, active: true, groupId: NO_GROUP },
      { id: 2, windowId: WIN, index: 1, url: 'https://b.example/', title: 'b', pinned: false, active: false, groupId: NO_GROUP },
    );

    vi.resetModules();
    const { registerTabListeners } = await import('../src/background/tab-sync');
    registerTabListeners();

    // Warm the cache the way normal browsing does.
    await env.fire('tabs.onUpdated', 1, {}, env.tabs[0]);
    await new Promise(r => setTimeout(r, 10));

    // User groups both tabs. Chrome fires tabGroups.onCreated and mutates
    // tab.groupId, but sends NO tabs.onUpdated for the groupId change.
    const g = { id: 777, windowId: WIN, title: 'Shop', color: 'grey', collapsed: true };
    env.groups.set(777, g);
    env.tabs[0].groupId = 777;
    env.tabs[1].groupId = 777;
    await env.fire('tabGroups.onCreated', g);
    await new Promise(r => setTimeout(r, 50));

    // User closes the window.
    await env.fire('tabs.onRemoved', 1, { windowId: WIN, isWindowClosing: true });
    await new Promise(r => setTimeout(r, 50));

    const saved = env.local.projectStore.projects.p1;
    expect(saved.tabGroups).toHaveLength(1);
    expect(saved.tabGroups[0].title).toBe('Shop');
    expect(saved.tabs.map((t: any) => t.groupId)).toEqual([0, 0]);
  });
});

describe('group edits after the initial grouping', () => {
  let env: ReturnType<typeof installChrome>;
  beforeEach(() => { env = installChrome(); });

  it('persists a rename/collapse made after grouping', async () => {
    env.local.projectStore = { projects: { p1: project() }, settings: DEFAULT_SETTINGS };
    env.session.windowProjectMap = { [WIN]: 'p1' };
    env.tabs.push(
      { id: 1, windowId: WIN, index: 0, url: 'https://a.example/', title: 'a', pinned: false, active: true, groupId: NO_GROUP },
      { id: 2, windowId: WIN, index: 1, url: 'https://b.example/', title: 'b', pinned: false, active: false, groupId: NO_GROUP },
    );

    vi.resetModules();
    const { registerTabListeners } = await import('../src/background/tab-sync');
    registerTabListeners();

    const g: any = { id: 777, windowId: WIN, title: '', color: 'grey', collapsed: false };
    env.groups.set(777, g);
    env.tabs[0].groupId = 777;
    env.tabs[1].groupId = 777;
    await env.fire('tabGroups.onCreated', g);
    await new Promise(r => setTimeout(r, 30));

    // User names the group and collapses it.
    g.title = 'Shop';
    g.collapsed = true;
    await env.fire('tabGroups.onUpdated', { ...g });
    await new Promise(r => setTimeout(r, 30));

    await env.fire('tabs.onRemoved', 1, { windowId: WIN, isWindowClosing: true });
    await new Promise(r => setTimeout(r, 50));

    const saved = env.local.projectStore.projects.p1;
    expect(saved.tabGroups).toHaveLength(1);
    expect(saved.tabGroups[0].title).toBe('Shop');
    expect(saved.tabGroups[0].collapsed).toBe(true);
  });

  it('drops the group again once the user ungroups the tabs', async () => {
    env.local.projectStore = { projects: { p1: project() }, settings: DEFAULT_SETTINGS };
    env.session.windowProjectMap = { [WIN]: 'p1' };
    env.tabs.push(
      { id: 1, windowId: WIN, index: 0, url: 'https://a.example/', title: 'a', pinned: false, active: true, groupId: NO_GROUP },
      { id: 2, windowId: WIN, index: 1, url: 'https://b.example/', title: 'b', pinned: false, active: false, groupId: NO_GROUP },
    );

    vi.resetModules();
    const { registerTabListeners } = await import('../src/background/tab-sync');
    registerTabListeners();

    const g: any = { id: 777, windowId: WIN, title: 'Shop', color: 'grey', collapsed: false };
    env.groups.set(777, g);
    env.tabs[0].groupId = 777;
    env.tabs[1].groupId = 777;
    await env.fire('tabGroups.onCreated', g);
    await new Promise(r => setTimeout(r, 30));

    // Ungroup: chrome clears groupId on the tabs and removes the group.
    env.tabs[0].groupId = NO_GROUP;
    env.tabs[1].groupId = NO_GROUP;
    env.groups.delete(777);
    await env.fire('tabGroups.onRemoved', g);
    await new Promise(r => setTimeout(r, 30));

    await env.fire('tabs.onRemoved', 1, { windowId: WIN, isWindowClosing: true });
    await new Promise(r => setTimeout(r, 50));

    const saved = env.local.projectStore.projects.p1;
    expect(saved.tabGroups).toEqual([]);
    expect(saved.tabs.every((t: any) => t.groupId === undefined)).toBe(true);
  });
});

describe('window close event ordering', () => {
  let env: ReturnType<typeof installChrome>;
  beforeEach(() => { env = installChrome(); });

  it('keeps the group when tabGroups.onRemoved arrives before tabs.onRemoved', async () => {
    // Observed in the real browser: closing a window tears down its groups
    // first, so tabGroups.onRemoved fires while closingWindows is still empty.
    // Evicting the group there emptied the cache moments before the close-time
    // save read it, persisting groups:1->0.
    env.local.projectStore = { projects: { p1: project() }, settings: DEFAULT_SETTINGS };
    env.session.windowProjectMap = { [WIN]: 'p1' };
    env.tabs.push(
      { id: 1, windowId: WIN, index: 0, url: 'https://a.example/', title: 'a', pinned: false, active: true, groupId: NO_GROUP },
      { id: 2, windowId: WIN, index: 1, url: 'https://b.example/', title: 'b', pinned: false, active: false, groupId: NO_GROUP },
    );

    vi.resetModules();
    const { registerTabListeners } = await import('../src/background/tab-sync');
    registerTabListeners();

    const g: any = { id: 777, windowId: WIN, title: 'Shop', color: 'grey', collapsed: false };
    env.groups.set(777, g);
    env.tabs[0].groupId = 777;
    env.tabs[1].groupId = 777;
    await env.fire('tabGroups.onCreated', g);
    await new Promise(r => setTimeout(r, 40));

    expect(env.local.projectStore.projects.p1.tabGroups).toHaveLength(1);

    // Window closes: it stops answering, its group goes, THEN the tabs go.
    // The tabs still carry groupId 777 throughout.
    env.openWindows.delete(WIN);
    env.groups.delete(777);
    await env.fire('tabGroups.onRemoved', g);
    await env.fire('tabs.onRemoved', 1, { windowId: WIN, isWindowClosing: true });
    await new Promise(r => setTimeout(r, 60));

    const saved = env.local.projectStore.projects.p1;
    expect(saved.tabGroups).toHaveLength(1);
    expect(saved.tabGroups[0].title).toBe('Shop');
  });
});

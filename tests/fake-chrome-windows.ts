// A fake of the slice of the chrome API openProject touches. It models the two
// behaviours that broke restore in recent Chrome versions:
//   1. pinning a tab moves it to the front of the window (indices shift), and
//      windows.create resolves before the window has settled, so the tab list
//      it returns is incomplete and unordered.
//   2. chrome.tabs.group without createProperties.windowId puts the tabs into
//      the currently focused window rather than the tabs' own window.

export type FakeTab = {
  id: number;
  windowId: number;
  index: number;
  url: string;
  pinned: boolean;
  active: boolean;
  groupId: number;
};

export const NO_GROUP = -1;

export type FakeChromeOptions = {
  /** Window that is focused when openProject runs - the group-theft target. */
  focusedWindowId?: number;
  /** Emulate windows.create resolving with a partial, shuffled tab list. */
  createReturnsSettledTabs?: boolean;
};

export function installFakeChrome(opts: FakeChromeOptions = {}) {
  const focusedWindowId = opts.focusedWindowId ?? 1;
  const tabs: FakeTab[] = [];
  const groups = new Map<number, { id: number; windowId: number; title: string; color: string; collapsed: boolean }>();
  const session: Record<string, unknown> = {};
  const local: Record<string, unknown> = {};
  let nextTabId = 100;
  let nextWindowId = 10;
  let nextGroupId = 900;

  // A pre-existing window that is focused - tabs must never leak into it.
  tabs.push({ id: 1, windowId: focusedWindowId, index: 0, url: 'https://focused.example/', pinned: false, active: true, groupId: NO_GROUP });

  const inWindow = (windowId: number) =>
    tabs.filter(t => t.windowId === windowId).sort((a, b) => a.index - b.index);

  // Chrome keeps pinned tabs ahead of unpinned ones and renumbers indices.
  function reindex(windowId: number): void {
    const list = inWindow(windowId);
    const ordered = [...list.filter(t => t.pinned), ...list.filter(t => !t.pinned)];
    ordered.forEach((t, i) => { t.index = i; });
  }

  const chromeMock = {
    windows: {
      WINDOW_ID_NONE: -1,
      create: async ({ url }: { url: string[] }) => {
        const windowId = nextWindowId++;
        url.forEach((u, i) => {
          tabs.push({ id: nextTabId++, windowId, index: i, url: u, pinned: false, active: i === 0, groupId: NO_GROUP });
        });
        const created = inWindow(windowId);
        // Real Chrome may resolve early: report a truncated, shuffled list.
        const reported = opts.createReturnsSettledTabs === false
          ? [...created].reverse().slice(0, Math.max(1, created.length - 1))
          : created;
        return { id: windowId, tabs: reported.map(t => ({ ...t })) };
      },
      update: async () => ({}),
      remove: async () => {},
      getLastFocused: async () => ({ id: focusedWindowId }),
      onFocusChanged: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
    },
    tabs: {
      query: async (q: { windowId?: number; active?: boolean }) => {
        let out = tabs;
        if (q.windowId !== undefined) out = out.filter(t => t.windowId === q.windowId);
        if (q.active !== undefined) out = out.filter(t => t.active === q.active);
        return out.sort((a, b) => a.index - b.index).map(t => ({ ...t }));
      },
      update: async (tabId: number, props: { pinned?: boolean; active?: boolean }) => {
        const tab = tabs.find(t => t.id === tabId);
        if (!tab) throw new Error(`No tab ${tabId}`);
        if (props.pinned !== undefined) {
          tab.pinned = props.pinned;
          reindex(tab.windowId);
        }
        if (props.active) {
          inWindow(tab.windowId).forEach(t => { t.active = false; });
          tab.active = true;
        }
        return { ...tab };
      },
      group: async ({ tabIds, createProperties }: { tabIds: number[]; createProperties?: { windowId?: number } }) => {
        const targets = tabIds.map(id => tabs.find(t => t.id === id)).filter((t): t is FakeTab => !!t);
        if (targets.length === 0) throw new Error('No tabs to group');
        // Without an explicit windowId Chrome resolves the group into the
        // focused window and drags the tabs along with it.
        const windowId = createProperties?.windowId ?? focusedWindowId;
        const groupId = nextGroupId++;
        groups.set(groupId, { id: groupId, windowId, title: '', color: 'grey', collapsed: false });
        const touched = new Set<number>();
        for (const t of targets) {
          touched.add(t.windowId);
          t.windowId = windowId;
          t.groupId = groupId;
        }
        touched.add(windowId);
        touched.forEach(reindex);
        return groupId;
      },
      onActivated: { addListener: () => {} },
      onUpdated: { addListener: () => {} },
      onMoved: { addListener: () => {} },
      onCreated: { addListener: () => {} },
      onAttached: { addListener: () => {} },
      onDetached: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: NO_GROUP,
      query: async ({ windowId }: { windowId: number }) =>
        [...groups.values()].filter(g => g.windowId === windowId),
      update: async (groupId: number, props: { title?: string; color?: string; collapsed?: boolean }) => {
        const g = groups.get(groupId);
        if (g) Object.assign(g, props);
        return g;
      },
      onCreated: { addListener: () => {} },
      onUpdated: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
    },
    extension: { isAllowedFileSchemeAccess: async () => false },
    runtime: {
      onStartup: { addListener: () => {} },
      onInstalled: { addListener: () => {} },
      onMessage: { addListener: () => {} },
      lastError: undefined,
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
      setTitle: async () => {},
    },
    storage: {
      session: {
        get: async (k: string) => (k in session ? { [k]: structuredClone(session[k]) } : {}),
        set: async (e: Record<string, unknown>) => { Object.assign(session, structuredClone(e)); },
        onChanged: { addListener: () => {} },
      },
      local: {
        get: async (k: string) => (k in local ? { [k]: structuredClone(local[k]) } : {}),
        set: async (e: Record<string, unknown>) => { Object.assign(local, structuredClone(e)); },
        onChanged: { addListener: () => {} },
      },
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = chromeMock;

  return {
    chrome: chromeMock,
    focusedWindowId,
    tabsIn: (windowId: number) => inWindow(windowId),
    allTabs: () => tabs,
    group: (groupId: number) => groups.get(groupId),
    groups: () => [...groups.values()],
    setLocal: (k: string, v: unknown) => { local[k] = structuredClone(v); },
  };
}

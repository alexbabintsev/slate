import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installFakeChrome } from './fake-chrome-windows';
import type { Project } from '../src/models/project';
import { DEFAULT_SETTINGS } from '../src/models/project';

// Bug report: after Chrome was killed (power loss) and its windows were brought
// back, a project window showed "no project", and opening the project from Slate
// created a second window with the same tabs.
//
// Cause: the window->project map lives in storage.session (wiped on restart)
// and was rebuilt only once, at runtime.onStartup. After a crash Chrome restores
// windows only when the user clicks "Restore" - after onStartup already ran.

type Fake = ReturnType<typeof installFakeChrome>;
const MAP_KEY = 'windowProjectMap';

function project(id: string, urls: string[]): Project {
  return {
    id,
    name: id,
    icon: '',
    tabs: urls.map((url, index) => ({ url, title: url, pinned: false, index })),
    tabGroups: [],
    activeTabIndex: 0,
    createdAt: 0,
    updatedAt: 0,
    sortOrder: 0,
  };
}

async function load(fake: Fake, projects: Project[]) {
  fake.setLocal('projectStore', {
    projects: Object.fromEntries(projects.map(p => [p.id, p])),
    settings: DEFAULT_SETTINGS,
  });
  vi.resetModules();
  const reconciler = await import('../src/background/startup-reconciler');
  const sw = await import('../src/background/service-worker');
  return { ...reconciler, openProject: sw.openProject };
}

const WORK = ['https://a.example/', 'https://b.example/', 'https://c.example/'];

describe('reconcile windows restored after startup', () => {
  let fake: Fake;

  beforeEach(() => {
    fake = installFakeChrome({ focusedWindowId: 1 });
  });

  it('binds a window that appears after the startup pass', async () => {
    const { reconcileWindows } = await load(fake, [project('work', WORK)]);

    // onStartup: only the crash-recovery window exists, nothing matches.
    expect(await reconcileWindows()).toEqual([]);

    // User clicks "Restore": the project window comes back.
    const restored = fake.addWindow(WORK);
    expect(await reconcileWindows()).toEqual([restored]);
    expect(fake.getSession(MAP_KEY)).toEqual({ [restored]: 'work' });
  });

  it('opening the project adopts the restored window instead of duplicating it', async () => {
    const { openProject } = await load(fake, [project('work', WORK)]);
    const restored = fake.addWindow(WORK);
    const windowsBefore = new Set(fake.allTabs().map(t => t.windowId)).size;

    const windowId = await openProject('work');

    expect(windowId).toBe(restored);
    expect(new Set(fake.allTabs().map(t => t.windowId)).size).toBe(windowsBefore);
    expect(fake.getSession(MAP_KEY)).toEqual({ [restored]: 'work' });
  });

  it('a repeat pass never reassigns an already-bound window or project', async () => {
    const { reconcileWindows } = await load(fake, [project('work', WORK), project('copy', WORK)]);
    const first = fake.addWindow(WORK);
    fake.setSession(MAP_KEY, { [first]: 'copy' });

    const second = fake.addWindow(WORK);
    await reconcileWindows();

    // "copy" keeps its window; the new one goes to the still-unbound project.
    expect(fake.getSession(MAP_KEY)).toEqual({ [first]: 'copy', [second]: 'work' });
  });

  it('drops associations to windows that no longer exist', async () => {
    const { reconcileWindows } = await load(fake, [project('work', WORK)]);
    fake.setSession(MAP_KEY, { 999: 'work' });

    const restored = fake.addWindow(WORK);
    await reconcileWindows();

    expect(fake.getSession(MAP_KEY)).toEqual({ [restored]: 'work' });
  });

  it('skips windows that openProject is still building', async () => {
    const { reconcileWindows } = await load(fake, [project('work', WORK)]);
    const building = fake.addWindow(WORK);

    expect(await reconcileWindows(new Set([building]))).toEqual([]);
  });

  it('matches tabs that only have a pendingUrl while still restoring', async () => {
    const { scoreMatch } = await load(fake, []);
    const tabs = WORK.map((pendingUrl, index) => ({ url: '', pendingUrl, index }) as chrome.tabs.Tab);
    expect(scoreMatch(tabs, project('work', WORK))).toBe(1);
  });
});

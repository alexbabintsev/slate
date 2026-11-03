const SESSION_MAP_KEY = 'windowProjectMap';

type WindowProjectMap = Record<number, string>;

async function getMap(): Promise<WindowProjectMap> {
  const result = await chrome.storage.session.get(SESSION_MAP_KEY);
  return (result[SESSION_MAP_KEY] as WindowProjectMap) ?? {};
}

async function setMap(map: WindowProjectMap): Promise<void> {
  await chrome.storage.session.set({ [SESSION_MAP_KEY]: map });
}

// Every change is a read-modify-write of one session key. Run them one at a
// time: two overlapping changes (two windows closing at once, a restore racing
// a reconcile) would otherwise each write back their own copy and drop the
// other's - leaving a link to a dead window that blocks reopening the project.
let writeQueue: Promise<unknown> = Promise.resolve();

function updateMap(fn: (map: WindowProjectMap) => void): Promise<void> {
  const run = writeQueue.then(async () => {
    const map = await getMap();
    fn(map);
    await setMap(map);
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

export function associateWindow(windowId: number, projectId: string): Promise<void> {
  return updateMap(map => {
    // A project has at most one window.
    for (const [wid, pid] of Object.entries(map)) {
      if (pid === projectId && Number(wid) !== windowId) delete map[Number(wid)];
    }
    map[windowId] = projectId;
  });
}

export function dissociateWindow(windowId: number): Promise<void> {
  return updateMap(map => { delete map[windowId]; });
}

export async function getProjectForWindow(windowId: number): Promise<string | null> {
  const map = await getMap();
  return map[windowId] ?? null;
}

export async function getWindowForProject(projectId: string): Promise<number | null> {
  const map = await getMap();
  const entry = Object.entries(map).find(([, pid]) => pid === projectId);
  return entry ? Number(entry[0]) : null;
}

export async function getAllAssociations(): Promise<WindowProjectMap> {
  return getMap();
}

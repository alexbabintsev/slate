const SESSION_MAP_KEY = 'windowProjectMap';

type WindowProjectMap = Record<number, string>;

async function getMap(): Promise<WindowProjectMap> {
  const result = await chrome.storage.session.get(SESSION_MAP_KEY);
  return (result[SESSION_MAP_KEY] as WindowProjectMap) ?? {};
}

async function setMap(map: WindowProjectMap): Promise<void> {
  await chrome.storage.session.set({ [SESSION_MAP_KEY]: map });
}

export async function associateWindow(windowId: number, projectId: string): Promise<void> {
  const map = await getMap();
  map[windowId] = projectId;
  await setMap(map);
}

export async function dissociateWindow(windowId: number): Promise<void> {
  const map = await getMap();
  delete map[windowId];
  await setMap(map);
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

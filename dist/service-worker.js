// src/models/project.ts
var DEFAULT_SETTINGS = {
  autoSaveDebounceMs: 1500,
  storageBackend: "local",
  syncEnabled: false
};
var PROJECT_BADGE_COLORS = [
  "#e76f51",
  "#2a9d8f",
  "#6d5dfc",
  "#d99a13",
  "#27b4c9",
  "#4f86e8",
  "#8b5cf6",
  "#43a047",
  "#d64f8a",
  "#64748b"
];
function randomIndex(max) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}
function randomProjectColor() {
  return PROJECT_BADGE_COLORS[randomIndex(PROJECT_BADGE_COLORS.length)];
}
function projectColorFromSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i) | 0;
  }
  const index = Math.abs(hash) % PROJECT_BADGE_COLORS.length;
  return PROJECT_BADGE_COLORS[index];
}
function ensureProjectColor(project) {
  return project.color ? project : { ...project, color: projectColorFromSeed(project.id || project.name) };
}
function createProject(name, icon = "") {
  return {
    id: crypto.randomUUID(),
    name,
    icon,
    color: randomProjectColor(),
    tabs: [],
    tabGroups: [],
    activeTabIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sortOrder: Date.now()
  };
}

// src/storage/local-storage-adapter.ts
var STORE_KEY = "projectStore";
function emptyStore() {
  return { projects: {}, settings: DEFAULT_SETTINGS };
}
var LocalStorageAdapter = class {
  backendType = "local";
  // Serialize all read-modify-write operations so concurrent saves don't clobber each other.
  writeQueue = Promise.resolve();
  enqueue(fn) {
    const next = this.writeQueue.then(fn, fn);
    this.writeQueue = next.catch(() => void 0);
    return next;
  }
  async getProjectStore() {
    const result = await chrome.storage.local.get(STORE_KEY);
    if (!result[STORE_KEY])
      return emptyStore();
    return result[STORE_KEY];
  }
  async saveProjectStore(store) {
    return this.enqueue(() => chrome.storage.local.set({ [STORE_KEY]: store }));
  }
  async getProject(id) {
    const store = await this.getProjectStore();
    return store.projects[id] ?? null;
  }
  async saveProject(project) {
    return this.enqueue(async () => {
      const store = await this.getProjectStore();
      store.projects[project.id] = ensureProjectColor({ ...project, updatedAt: Date.now() });
      await chrome.storage.local.set({ [STORE_KEY]: store });
    });
  }
  async deleteProject(id) {
    return this.enqueue(async () => {
      const store = await this.getProjectStore();
      delete store.projects[id];
      await chrome.storage.local.set({ [STORE_KEY]: store });
    });
  }
  onExternalChange(callback) {
    const listener = (changes) => {
      if (changes[STORE_KEY]?.newValue) {
        callback(changes[STORE_KEY].newValue);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }
};

// src/storage/storage-factory.ts
var instance = null;
function getStorage() {
  if (!instance)
    instance = new LocalStorageAdapter();
  return instance;
}

// src/background/window-tracker.ts
var SESSION_MAP_KEY = "windowProjectMap";
async function getMap() {
  const result = await chrome.storage.session.get(SESSION_MAP_KEY);
  return result[SESSION_MAP_KEY] ?? {};
}
async function setMap(map) {
  await chrome.storage.session.set({ [SESSION_MAP_KEY]: map });
}
async function associateWindow(windowId, projectId) {
  const map = await getMap();
  map[windowId] = projectId;
  await setMap(map);
}
async function dissociateWindow(windowId) {
  const map = await getMap();
  delete map[windowId];
  await setMap(map);
}
async function getProjectForWindow(windowId) {
  const map = await getMap();
  return map[windowId] ?? null;
}
async function getWindowForProject(projectId) {
  const map = await getMap();
  const entry = Object.entries(map).find(([, pid]) => pid === projectId);
  return entry ? Number(entry[0]) : null;
}

// src/background/startup-reconciler.ts
function scoreMatch(windowTabs, project) {
  if (windowTabs.length === 0 && project.tabs.length === 0)
    return 0;
  if (project.tabs.length === 0)
    return 0;
  const projectUrls = new Set(project.tabs.map((t) => normalizeUrl(t.url)));
  const matchCount = windowTabs.filter((t) => t.url && projectUrls.has(normalizeUrl(t.url))).length;
  return matchCount / Math.max(windowTabs.length, project.tabs.length);
}
function normalizeUrl(url) {
  try {
    const idx = url.indexOf("//");
    if (idx === -1)
      return url;
    const rest = url.slice(idx + 2);
    const qIdx = rest.indexOf("?");
    return qIdx === -1 ? rest : rest.slice(0, qIdx);
  } catch {
    return url;
  }
}
async function reconcileOnStartup() {
  const storage = getStorage();
  const store = await storage.getProjectStore();
  const projects = Object.values(store.projects);
  if (projects.length === 0)
    return;
  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
  const used = /* @__PURE__ */ new Set();
  const candidates = [];
  for (const win of windows) {
    if (!win.id)
      continue;
    const tabs = win.tabs ?? [];
    for (const project of projects) {
      if (used.has(project.id))
        continue;
      const score = scoreMatch(tabs, project);
      if (score >= 0.6)
        candidates.push({ windowId: win.id, projectId: project.id, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const assignedWindows = /* @__PURE__ */ new Set();
  for (const { windowId, projectId } of candidates) {
    if (assignedWindows.has(windowId) || used.has(projectId))
      continue;
    await associateWindow(windowId, projectId);
    assignedWindows.add(windowId);
    used.add(projectId);
  }
}

// src/background/tab-sync.ts
var pendingSaves = /* @__PURE__ */ new Map();
var windowTabCache = /* @__PURE__ */ new Map();
var windowActiveIndex = /* @__PURE__ */ new Map();
var windowGroupCache = /* @__PURE__ */ new Map();
var restoringWindows = /* @__PURE__ */ new Set();
var closingWindows = /* @__PURE__ */ new Set();
function markWindowRestoring(windowId) {
  restoringWindows.add(windowId);
}
function unmarkWindowRestoring(windowId) {
  restoringWindows.delete(windowId);
}
function buildTabStates(tabs) {
  return tabs.sort((a, b) => a.index - b.index).map((t) => ({
    url: t.url ?? "",
    title: t.title ?? "",
    pinned: t.pinned,
    index: t.index,
    faviconUrl: t.favIconUrl,
    groupId: t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ? t.groupId : void 0
  })).filter((t) => t.url !== "");
}
async function buildTabGroupStates(windowId) {
  try {
    const groups = await chrome.tabGroups.query({ windowId });
    if (groups.length > 0)
      windowGroupCache.set(windowId, groups);
  } catch {
  }
  return (windowGroupCache.get(windowId) ?? []).map((g) => ({
    id: g.id,
    title: g.title ?? "",
    color: g.color,
    collapsed: g.collapsed
  }));
}
async function persist(projectId, tabs, activeIndex, windowId, groupsOverride) {
  const storage = getStorage();
  const project = await storage.getProject(projectId);
  if (!project)
    return;
  const tabStates = buildTabStates(tabs);
  if (tabStates.length === 0 && project.tabs.length > 0)
    return;
  const tabGroups = groupsOverride ?? await buildTabGroupStates(windowId);
  await storage.saveProject({ ...project, tabs: tabStates, tabGroups, activeTabIndex: activeIndex });
}
async function saveProjectTabs(projectId, windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  const effectiveTabs = tabs.length > 0 ? tabs : windowTabCache.get(windowId) ?? [];
  const activeIndex = windowActiveIndex.get(windowId) ?? 0;
  await persist(projectId, effectiveTabs, activeIndex, windowId);
}
async function saveFromCache(projectId, windowId) {
  const cached = windowTabCache.get(windowId);
  if (!cached || cached.length === 0)
    return;
  const activeIndex = windowActiveIndex.get(windowId) ?? 0;
  const groupsSnapshot = (windowGroupCache.get(windowId) ?? []).map((g) => ({
    id: g.id,
    title: g.title ?? "",
    color: g.color,
    collapsed: g.collapsed
  }));
  await persist(projectId, cached, activeIndex, windowId, groupsSnapshot);
}
async function refreshCache(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  if (tabs.length > 0)
    windowTabCache.set(windowId, tabs);
}
function scheduleSave(windowId, delayMs) {
  void (async () => {
    if (restoringWindows.has(windowId))
      return;
    if (closingWindows.has(windowId))
      return;
    const projectId = await getProjectForWindow(windowId);
    if (!projectId)
      return;
    const existing = pendingSaves.get(projectId);
    if (existing)
      clearTimeout(existing);
    let ms = delayMs;
    if (ms === void 0) {
      const store = await getStorage().getProjectStore();
      ms = store.settings.autoSaveDebounceMs;
    }
    const timer = setTimeout(() => {
      pendingSaves.delete(projectId);
      void saveProjectTabs(projectId, windowId);
    }, ms);
    pendingSaves.set(projectId, timer);
  })();
}
function registerTabListeners() {
  chrome.tabs.onActivated.addListener(async (info) => {
    const tabs = await chrome.tabs.query({ windowId: info.windowId, active: true });
    if (tabs[0]) {
      windowActiveIndex.set(info.windowId, tabs[0].index);
      windowTabCache.set(info.windowId, await chrome.tabs.query({ windowId: info.windowId }).then((t) => t.length > 0 ? t : windowTabCache.get(info.windowId) ?? []));
    }
    scheduleSave(info.windowId, 300);
  });
  chrome.tabs.onUpdated.addListener(async (_, _changeInfo, tab) => {
    if (tab.windowId)
      await refreshCache(tab.windowId);
  });
  chrome.tabs.onMoved.addListener(async (_, info) => {
    await refreshCache(info.windowId);
    const active = await chrome.tabs.query({ windowId: info.windowId, active: true });
    if (active[0])
      windowActiveIndex.set(info.windowId, active[0].index);
  });
  chrome.tabs.onCreated.addListener((tab) => {
    scheduleSave(tab.windowId);
  });
  chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.title || changeInfo.pinned !== void 0) {
      const delay = changeInfo.pinned !== void 0 ? 150 : void 0;
      scheduleSave(tab.windowId, delay);
    }
  });
  chrome.tabs.onMoved.addListener((_, info) => {
    scheduleSave(info.windowId);
  });
  chrome.tabs.onAttached.addListener((_, info) => {
    scheduleSave(info.newWindowId);
  });
  chrome.tabs.onDetached.addListener((_, info) => {
    scheduleSave(info.oldWindowId);
  });
  chrome.tabGroups.onCreated.addListener((group) => {
    const existing = windowGroupCache.get(group.windowId) ?? [];
    windowGroupCache.set(group.windowId, [...existing.filter((g) => g.id !== group.id), group]);
    scheduleSave(group.windowId, 0);
  });
  chrome.tabGroups.onUpdated.addListener((group) => {
    const existing = windowGroupCache.get(group.windowId) ?? [];
    windowGroupCache.set(group.windowId, [...existing.filter((g) => g.id !== group.id), group]);
    scheduleSave(group.windowId, 0);
  });
  chrome.tabs.onRemoved.addListener(async (_, info) => {
    if (info.isWindowClosing) {
      closingWindows.add(info.windowId);
      const projectId = await getProjectForWindow(info.windowId);
      if (projectId) {
        const existing = pendingSaves.get(projectId);
        if (existing) {
          clearTimeout(existing);
          pendingSaves.delete(projectId);
        }
        await saveFromCache(projectId, info.windowId);
      }
    } else {
      scheduleSave(info.windowId);
    }
  });
}
function clearWindowCache(windowId) {
  windowTabCache.delete(windowId);
  windowActiveIndex.delete(windowId);
  windowGroupCache.delete(windowId);
  closingWindows.delete(windowId);
}

// src/background/toolbar-icon.ts
var DEFAULT_ICON_PATH = {
  16: "assets/icons/icon16.png",
  32: "assets/icons/icon32.png",
  48: "assets/icons/icon48.png",
  128: "assets/icons/icon128.png"
};
var DEFAULT_TITLE = "Slate - No project";
async function setIcon(details) {
  try {
    await chrome.action.setIcon(details);
  } catch {
    const { windowId: _w, ...global } = details;
    await chrome.action.setIcon(global).catch(() => {
    });
  }
}
async function setActionTitle(details) {
  try {
    await chrome.action.setTitle(details);
  } catch {
    await chrome.action.setTitle({ title: details.title }).catch(() => {
    });
  }
}
async function setBadgeText(details) {
  try {
    await chrome.action.setBadgeText(details);
  } catch {
    const { windowId: _w, ...global } = details;
    await chrome.action.setBadgeText(global).catch(() => {
    });
  }
}
async function setBadgeBackgroundColor(details) {
  try {
    await chrome.action.setBadgeBackgroundColor(details);
  } catch {
    const { windowId: _w, ...global } = details;
    await chrome.action.setBadgeBackgroundColor(global).catch(() => {
    });
  }
}
async function setBadgeTextColor(details) {
  try {
    await chrome.action.setBadgeTextColor(details);
  } catch {
    const { windowId: _w, ...global } = details;
    await chrome.action.setBadgeTextColor(global).catch(() => {
    });
  }
}
function makeBadgeText(projectName) {
  const words = projectName.trim().split(/[\s._/-]+/).filter(Boolean);
  const text = words.length > 1 ? words.slice(0, 2).map((word) => Array.from(word)[0]).join("") : Array.from(words[0] ?? projectName)[0] ?? "";
  return text.toUpperCase();
}
async function updateToolbarIcon(windowId) {
  await setIcon({ path: DEFAULT_ICON_PATH, windowId });
  const projectId = await getProjectForWindow(windowId);
  if (!projectId) {
    await setActionTitle({ title: DEFAULT_TITLE, windowId });
    await setBadgeText({ text: "", windowId });
    return;
  }
  const project = await getStorage().getProject(projectId);
  if (!project) {
    await setActionTitle({ title: DEFAULT_TITLE, windowId });
    await setBadgeText({ text: "", windowId });
    return;
  }
  await setActionTitle({ title: `Slate - ${project.name}`, windowId });
  await setBadgeBackgroundColor({
    color: project.color ?? projectColorFromSeed(project.id || project.name),
    windowId
  });
  await setBadgeTextColor({ color: "#ffffff", windowId });
  await setBadgeText({ text: makeBadgeText(project.name), windowId });
}

// src/background/import-sanitizer.ts
var VALID_TAB_GROUP_COLORS = /* @__PURE__ */ new Set([
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange"
]);
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function sanitizeTab(raw) {
  if (!isObject(raw))
    return null;
  const url = typeof raw.url === "string" ? raw.url : "";
  if (!url)
    return null;
  return {
    url,
    title: typeof raw.title === "string" ? raw.title : "",
    pinned: !!raw.pinned,
    index: typeof raw.index === "number" ? raw.index : 0,
    faviconUrl: typeof raw.faviconUrl === "string" ? raw.faviconUrl : void 0,
    groupId: typeof raw.groupId === "number" ? raw.groupId : void 0
  };
}
function sanitizeGroup(raw) {
  if (!isObject(raw))
    return null;
  if (typeof raw.id !== "number")
    return null;
  const color = raw.color;
  return {
    id: raw.id,
    title: typeof raw.title === "string" ? raw.title : "",
    color: VALID_TAB_GROUP_COLORS.has(color) ? color : "grey",
    collapsed: !!raw.collapsed
  };
}
function sanitizeProject(raw) {
  if (!isObject(raw))
    return null;
  if (typeof raw.id !== "string" || !raw.id)
    return null;
  if (typeof raw.name !== "string" || !raw.name)
    return null;
  const tabs = Array.isArray(raw.tabs) ? raw.tabs.map(sanitizeTab).filter((t) => t !== null) : [];
  const tabGroups = Array.isArray(raw.tabGroups) ? raw.tabGroups.map(sanitizeGroup).filter((g) => g !== null) : [];
  return {
    id: raw.id,
    name: raw.name,
    icon: typeof raw.icon === "string" ? raw.icon : "",
    color: typeof raw.color === "string" ? raw.color : void 0,
    tabs,
    tabGroups,
    activeTabIndex: typeof raw.activeTabIndex === "number" ? raw.activeTabIndex : 0,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : Date.now()
  };
}
function sanitizeImportedStore(store) {
  if (!isObject(store))
    return null;
  const projects = store.projects;
  if (!isObject(projects))
    return null;
  const out = {};
  for (const [id, raw] of Object.entries(projects)) {
    const p = sanitizeProject(raw);
    if (p && p.id === id)
      out[id] = p;
  }
  return out;
}

// src/background/service-worker.ts
async function openProject(projectId) {
  const existingWindowId = await getWindowForProject(projectId);
  if (existingWindowId !== null) {
    await chrome.windows.update(existingWindowId, { focused: true });
    return existingWindowId;
  }
  const storage = getStorage();
  const project = await storage.getProject(projectId);
  if (!project)
    throw new Error(`Project ${projectId} not found`);
  const pinnedTabs = project.tabs.filter((t) => t.pinned);
  const regularTabs = project.tabs.filter((t) => !t.pinned);
  const orderedTabs = [...pinnedTabs, ...regularTabs];
  const validTabs = orderedTabs.filter((t) => t.url && !t.url.startsWith("chrome://"));
  const urls = validTabs.length > 0 ? validTabs.map((t) => t.url) : ["chrome://newtab/"];
  const win = await chrome.windows.create({ url: urls, focused: true });
  if (!win.id)
    throw new Error("Failed to create window");
  markWindowRestoring(win.id);
  try {
    if (win.tabs) {
      for (let i = 0; i < win.tabs.length; i++) {
        if (validTabs[i]?.pinned) {
          const tabId = win.tabs[i].id;
          if (tabId)
            await chrome.tabs.update(tabId, { pinned: true });
        }
      }
      const savedGroups = project.tabGroups ?? [];
      for (const savedGroup of savedGroups) {
        try {
          const tabIds = win.tabs.filter((_, i) => validTabs[i]?.groupId === savedGroup.id).map((t) => t.id).filter((id) => id !== void 0);
          if (tabIds.length === 0)
            continue;
          const newGroupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(newGroupId, {
            title: savedGroup.title,
            color: savedGroup.color,
            collapsed: savedGroup.collapsed
          });
        } catch (e) {
          console.warn("[Slate] failed to restore group", savedGroup.id, e);
        }
      }
      const activeIndex = project.activeTabIndex ?? 0;
      const targetTab = win.tabs.find((t) => t.index === activeIndex) ?? win.tabs[0];
      if (targetTab?.id)
        await chrome.tabs.update(targetTab.id, { active: true });
    }
    await associateWindow(win.id, projectId);
  } finally {
    unmarkWindowRestoring(win.id);
  }
  return win.id;
}
async function closeProject(projectId) {
  const windowId = await getWindowForProject(projectId);
  if (windowId !== null) {
    await chrome.windows.remove(windowId);
  }
}
async function handleMessage(message) {
  const storage = getStorage();
  try {
    switch (message.type) {
      case "GET_CURRENT_PROJECT": {
        const projectId = await getProjectForWindow(message.windowId);
        if (!projectId)
          return { ok: true, data: null };
        const project = await storage.getProject(projectId);
        return { ok: true, data: project };
      }
      case "GET_ALL_PROJECTS": {
        const store = await storage.getProjectStore();
        const projects = Object.values(store.projects).sort(
          (a, b) => a.sortOrder - b.sortOrder
        );
        return { ok: true, data: projects };
      }
      case "OPEN_PROJECT": {
        const windowId = await openProject(message.projectId);
        void updateToolbarIcon(windowId);
        return { ok: true, data: { windowId } };
      }
      case "CLOSE_PROJECT": {
        await closeProject(message.projectId);
        return { ok: true, data: null };
      }
      case "CREATE_PROJECT": {
        const project = createProject(message.name, message.icon);
        const store = await storage.getProjectStore();
        const maxOrder = Math.max(0, ...Object.values(store.projects).map((p) => p.sortOrder));
        project.sortOrder = maxOrder + 1e3;
        await storage.saveProject(project);
        return { ok: true, data: project };
      }
      case "DELETE_PROJECT": {
        await closeProject(message.projectId);
        await storage.deleteProject(message.projectId);
        return { ok: true, data: null };
      }
      case "REORDER_PROJECTS": {
        const store = await storage.getProjectStore();
        message.orderedIds.forEach((id, index) => {
          if (store.projects[id])
            store.projects[id].sortOrder = index * 1e3;
        });
        await storage.saveProjectStore(store);
        return { ok: true, data: null };
      }
      case "EXPORT_PROJECTS": {
        const store = await storage.getProjectStore();
        return { ok: true, data: store };
      }
      case "IMPORT_PROJECTS": {
        const cleaned = sanitizeImportedStore(message.store);
        if (!cleaned)
          return { ok: false, error: "Invalid import file" };
        const current = await storage.getProjectStore();
        Object.assign(current.projects, cleaned);
        await storage.saveProjectStore(current);
        return { ok: true, data: null };
      }
      case "GET_WINDOW_FOR_PROJECT": {
        const windowId = await getWindowForProject(message.projectId);
        return { ok: true, data: windowId };
      }
      case "CLI_COMMAND": {
        const cmd = message.command;
        if (cmd.action === "open") {
          const store = await storage.getProjectStore();
          const project = Object.values(store.projects).find(
            (p) => p.name.toLowerCase() === cmd.projectName.toLowerCase()
          );
          if (!project)
            return { ok: false, error: `Project "${cmd.projectName}" not found` };
          const windowId = await openProject(project.id);
          return { ok: true, data: { windowId } };
        }
        if (cmd.action === "close") {
          const store = await storage.getProjectStore();
          const project = Object.values(store.projects).find(
            (p) => p.name.toLowerCase() === cmd.projectName.toLowerCase()
          );
          if (!project)
            return { ok: false, error: `Project "${cmd.projectName}" not found` };
          await closeProject(project.id);
          return { ok: true, data: null };
        }
        if (cmd.action === "list") {
          const store = await storage.getProjectStore();
          const projects = Object.values(store.projects).sort(
            (a, b) => a.sortOrder - b.sortOrder
          );
          return { ok: true, data: projects.map((p) => ({ id: p.id, name: p.name, icon: p.icon })) };
        }
        return { ok: false, error: "Unknown CLI command" };
      }
      case "ASSIGN_WINDOW": {
        await associateWindow(message.windowId, message.projectId);
        await saveProjectTabs(message.projectId, message.windowId);
        void updateToolbarIcon(message.windowId);
        return { ok: true, data: null };
      }
      case "SAVE_PROJECT": {
        await storage.saveProject(message.project);
        const wid = await getWindowForProject(message.project.id);
        if (wid !== null) {
          await updateToolbarIcon(wid);
          const activeWin = await chrome.windows.getLastFocused().catch(() => null);
          if (activeWin?.id && activeWin.id !== wid) {
            void updateToolbarIcon(activeWin.id);
          }
        }
        return { ok: true, data: null };
      }
      default:
        return { ok: false, error: "Unknown message type" };
    }
  } catch (err) {
    console.error("[Slate] message handler error", err);
    return { ok: false, error: "Operation failed" };
  }
}
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE)
    return;
  void updateToolbarIcon(windowId);
});
chrome.windows.onRemoved.addListener(async (windowId) => {
  await dissociateWindow(windowId);
  clearWindowCache(windowId);
});
chrome.runtime.onStartup.addListener(async () => {
  await reconcileOnStartup();
});
chrome.runtime.onInstalled.addListener(async () => {
  await reconcileOnStartup();
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});
registerTabListeners();

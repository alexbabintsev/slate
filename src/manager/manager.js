// node_modules/lucide/dist/esm/icons/download.mjs
var Download = [
  ["path", { d: "M12 15V3" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
  ["path", { d: "m7 10 5 5 5-5" }]
];

// node_modules/lucide/dist/esm/icons/external-link.mjs
var ExternalLink = [
  ["path", { d: "M15 3h6v6" }],
  ["path", { d: "M10 14 21 3" }],
  ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }]
];

// node_modules/lucide/dist/esm/icons/grip-vertical.mjs
var GripVertical = [
  ["circle", { cx: "9", cy: "12", r: "1" }],
  ["circle", { cx: "9", cy: "5", r: "1" }],
  ["circle", { cx: "9", cy: "19", r: "1" }],
  ["circle", { cx: "15", cy: "12", r: "1" }],
  ["circle", { cx: "15", cy: "5", r: "1" }],
  ["circle", { cx: "15", cy: "19", r: "1" }]
];

// node_modules/lucide/dist/esm/icons/image.mjs
var Image = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }],
  ["circle", { cx: "9", cy: "9", r: "2" }],
  ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }]
];

// node_modules/lucide/dist/esm/icons/pencil.mjs
var Pencil = [
  [
    "path",
    {
      d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
    }
  ],
  ["path", { d: "m15 5 4 4" }]
];

// node_modules/lucide/dist/esm/icons/plus.mjs
var Plus = [
  ["path", { d: "M5 12h14" }],
  ["path", { d: "M12 5v14" }]
];

// node_modules/lucide/dist/esm/icons/trash-2.mjs
var Trash2 = [
  ["path", { d: "M10 11v6" }],
  ["path", { d: "M14 11v6" }],
  ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
  ["path", { d: "M3 6h18" }],
  ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }]
];

// node_modules/lucide/dist/esm/icons/upload.mjs
var Upload = [
  ["path", { d: "M12 3v12" }],
  ["path", { d: "m17 8-5-5-5 5" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }]
];

// node_modules/lucide/dist/esm/icons/x.mjs
var X = [
  ["path", { d: "M18 6 6 18" }],
  ["path", { d: "m6 6 12 12" }]
];

// src/models/project.ts
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
function projectColorFromSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i) | 0;
  }
  const index = Math.abs(hash) % PROJECT_BADGE_COLORS.length;
  return PROJECT_BADGE_COLORS[index];
}

// src/manager/manager.ts
function svgEl(node, size = 16) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const [tag, attrs] of node) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs))
      el.setAttribute(k, String(v));
    svg.appendChild(el);
  }
  return svg;
}
var allIcons = null;
var iconsLoadPromise = null;
async function loadAllIcons() {
  if (allIcons)
    return allIcons;
  if (!iconsLoadPromise) {
    iconsLoadPromise = fetch(chrome.runtime.getURL("assets/lucide-icons.json")).then((r) => r.json()).then((data) => {
      allIcons = data;
      return data;
    });
  }
  return iconsLoadPromise;
}
var DEFAULT_ICONS = [
  "Folder",
  "FolderOpen",
  "Briefcase",
  "Home",
  "Globe",
  "Rocket",
  "Zap",
  "Target",
  "Lightbulb",
  "Flame",
  "Heart",
  "Star",
  "Trophy",
  "Bookmark",
  "Monitor",
  "Smartphone",
  "Code2",
  "Terminal",
  "Database",
  "Server",
  "Cloud",
  "Shield",
  "Lock",
  "Key",
  "Settings",
  "Wrench",
  "GitBranch",
  "BarChart2",
  "TrendingUp",
  "DollarSign",
  "Mail",
  "Bell",
  "Palette",
  "Music",
  "Coffee"
];
function projectInitial(name) {
  const words = name.trim().split(/[\s._/-]+/).filter(Boolean);
  if (words.length > 1) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return words[0]?.[0]?.toUpperCase() || "?";
}
function renderIcon(iconVal, size = 18, projectName = "") {
  if (iconVal.startsWith("lucide:")) {
    const name = iconVal.slice(7);
    const cached = allIcons?.[name];
    if (cached)
      return svgEl(cached, size);
    const wrap = document.createElement("span");
    wrap.style.cssText = `width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center`;
    loadAllIcons().then((icons) => {
      if (icons[name])
        wrap.replaceWith(svgEl(icons[name], size));
    });
    return wrap;
  }
  if (iconVal.startsWith("data:")) {
    const img = document.createElement("img");
    img.src = iconVal;
    img.className = "project-icon-img";
    return img;
  }
  const span = document.createElement("span");
  span.textContent = iconVal || projectInitial(projectName);
  return span;
}
function projectIconColor(project) {
  return project.color ?? projectColorFromSeed(project.id || project.name);
}
function applyProjectIconStyle(container, project) {
  if (project.icon.startsWith("data:"))
    return;
  container.classList.add("project-icon-colored");
  container.style.backgroundColor = projectIconColor(project);
}
var COLS = 7;
var VISIBLE_ROWS = 5;
var BUFFER_ROWS = 2;
var IconGridRenderer = class {
  container;
  items = [];
  renderCell;
  // virtual scroll state
  spacer = null;
  canvas = null;
  cellSize = 0;
  visibleStart = -1;
  isVirtual = false;
  constructor(containerId, renderCell) {
    this.container = document.getElementById(containerId);
    this.renderCell = renderCell;
  }
  setItems(items) {
    this.items = items;
    this.visibleStart = -1;
    this.container.scrollTop = 0;
    this.container.innerHTML = "";
    this.spacer = null;
    this.canvas = null;
    this.isVirtual = items.length > 35;
    if (this.isVirtual) {
      this.setupVirtual();
    } else {
      this.setupPlain();
    }
  }
  setupPlain() {
    this.container.style.cssText = `
      display:grid;
      grid-template-columns:repeat(${COLS},1fr);
      gap:2px;
      padding:6px 10px 10px;
      overflow:visible;
    `;
    for (const item of this.items) {
      this.container.appendChild(this.renderCell(item));
    }
  }
  setupVirtual() {
    const availW = this.container.parentElement.clientWidth - 20;
    this.cellSize = Math.floor(availW / COLS);
    const rowH = this.cellSize + 2;
    const viewH = VISIBLE_ROWS * rowH + 10;
    this.container.style.cssText = `
      position:relative;
      overflow-y:auto;
      overflow-x:hidden;
      height:${viewH}px;
      scrollbar-width:thin;
      scrollbar-color:var(--border) transparent;
    `;
    this.spacer = document.createElement("div");
    this.spacer.style.cssText = "position:absolute;top:0;left:0;width:1px;pointer-events:none";
    const totalH = Math.ceil(this.items.length / COLS) * rowH + 10;
    this.spacer.style.height = `${totalH}px`;
    this.container.appendChild(this.spacer);
    this.canvas = document.createElement("div");
    this.canvas.style.cssText = `display:grid;grid-template-columns:repeat(${COLS},1fr);gap:2px;padding:0 10px;position:absolute;left:0;right:0;box-sizing:border-box`;
    this.container.appendChild(this.canvas);
    this.container.addEventListener("scroll", () => this.renderVirtual(), { passive: true });
    this.renderVirtual();
  }
  renderVirtual() {
    if (!this.canvas)
      return;
    const rowH = this.cellSize + 2;
    const scrollTop = this.container.scrollTop;
    const viewH = this.container.clientHeight;
    const firstRow = Math.max(0, Math.floor(scrollTop / rowH) - BUFFER_ROWS);
    const lastRow = Math.min(
      Math.ceil(this.items.length / COLS) - 1,
      Math.ceil((scrollTop + viewH) / rowH) + BUFFER_ROWS
    );
    if (firstRow === this.visibleStart)
      return;
    this.visibleStart = firstRow;
    this.canvas.style.top = `${firstRow * rowH + 6}px`;
    this.canvas.innerHTML = "";
    const start = firstRow * COLS;
    const end = Math.min(this.items.length, (lastRow + 1) * COLS);
    for (let i = start; i < end; i++) {
      const cell = this.renderCell(this.items[i]);
      cell.style.aspectRatio = "1";
      this.canvas.appendChild(cell);
    }
  }
  refresh() {
    if (this.isVirtual)
      this.renderVirtual();
  }
};
function send(msg) {
  return chrome.runtime.sendMessage(msg);
}
function promptDialog(title) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("prompt-dialog");
    const titleEl = document.getElementById("prompt-title");
    const input = document.getElementById("prompt-input");
    const okBtn = document.getElementById("prompt-ok");
    const cancelBtn = document.getElementById("prompt-cancel");
    titleEl.textContent = title;
    input.value = "";
    overlay.style.display = "flex";
    setTimeout(() => input.focus(), 0);
    const cleanup = () => {
      overlay.style.display = "none";
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKey);
      overlay.removeEventListener("click", onBackdrop);
    };
    const onOk = () => {
      const v = input.value.trim();
      cleanup();
      resolve(v || null);
    };
    const onCancel = () => {
      cleanup();
      resolve(null);
    };
    const onKey = (e) => {
      if (e.key === "Enter")
        onOk();
      else if (e.key === "Escape")
        onCancel();
    };
    const onBackdrop = (e) => {
      if (e.target === overlay)
        onCancel();
    };
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    input.addEventListener("keydown", onKey);
    overlay.addEventListener("click", onBackdrop);
  });
}
function alertDialog(message, title = "Notice") {
  return new Promise((resolve) => {
    const overlay = document.getElementById("alert-dialog");
    const titleEl = document.getElementById("alert-title");
    const msgEl = document.getElementById("alert-message");
    const okBtn = document.getElementById("alert-ok");
    titleEl.textContent = title;
    msgEl.textContent = message;
    overlay.style.display = "flex";
    const cleanup = () => {
      overlay.style.display = "none";
      okBtn.removeEventListener("click", onOk);
      overlay.removeEventListener("click", onBackdrop);
    };
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onBackdrop = (e) => {
      if (e.target === overlay)
        onOk();
    };
    okBtn.addEventListener("click", onOk);
    overlay.addEventListener("click", onBackdrop);
  });
}
var projects = [];
var openIds = /* @__PURE__ */ new Set();
var currentWindowId = 0;
var currentProjectId = null;
var pendingIconId = null;
var pendingDeleteId = null;
var dragSrcId = null;
var uploadDataUrl = null;
document.getElementById("btn-new-icon").appendChild(svgEl(Plus, 14));
document.getElementById("btn-import").appendChild(svgEl(Download, 15));
document.getElementById("btn-export").appendChild(svgEl(Upload, 15));
document.getElementById("icon-dialog-close").appendChild(svgEl(X, 14));
document.getElementById("btn-clear-icon").prepend(svgEl(X, 12));
document.getElementById("assign-dialog-close").appendChild(svgEl(X, 14));
document.getElementById("upload-area-icon").appendChild(svgEl(Image, 28));
var manifest = chrome.runtime.getManifest();
document.getElementById("footer-version").textContent = `v${manifest.version}`;
var author = manifest.author;
var authorText = typeof author === "string" ? author : author?.email ?? "";
document.getElementById("footer-author").textContent = authorText;
var lucideGrid = new IconGridRenderer("lucide-grid", (name) => {
  const btn = document.createElement("button");
  btn.className = "lucide-btn";
  btn.title = name;
  const data = allIcons?.[name];
  if (data) {
    btn.appendChild(svgEl(data, 18));
  } else {
    const ph = document.createElement("span");
    ph.style.cssText = "width:18px;height:18px;display:block";
    btn.appendChild(ph);
    loadAllIcons().then((all) => {
      if (all[name])
        ph.replaceWith(svgEl(all[name], 18));
    });
  }
  btn.addEventListener("click", () => applyIcon(`lucide:${name}`));
  return btn;
});
async function loadAll() {
  const win = await chrome.windows.getCurrent();
  currentWindowId = win.id;
  const [allRes, currentRes] = await Promise.all([
    send({ type: "GET_ALL_PROJECTS" }),
    send({ type: "GET_CURRENT_PROJECT", windowId: currentWindowId })
  ]);
  projects = allRes.ok ? allRes.data : [];
  currentProjectId = currentRes.ok && currentRes.data ? currentRes.data.id : null;
  const checks = await Promise.all(
    projects.map((p) => send({ type: "GET_WINDOW_FOR_PROJECT", projectId: p.id }))
  );
  openIds = new Set(
    projects.filter((_, i) => checks[i].ok && checks[i].data !== null).map((p) => p.id)
  );
}
function renderAll() {
  renderBanner();
  renderProjects();
}
function renderBanner() {
  const banner = document.getElementById("assign-banner");
  if (currentProjectId) {
    banner.style.display = "none";
  } else {
    banner.style.display = "flex";
  }
}
function renderProjects() {
  const list = document.getElementById("project-list");
  if (projects.length === 0) {
    list.innerHTML = '<div class="empty-state">No projects yet.<br>Hit "New Project" to get started.</div>';
    return;
  }
  list.innerHTML = "";
  for (const p of projects)
    list.appendChild(makeCard(p));
}
function makeCard(project) {
  const isOpen = openIds.has(project.id);
  const isCurrent = project.id === currentProjectId;
  const card = document.createElement("div");
  card.className = "project-card" + (isCurrent ? " current" : "");
  card.dataset.id = project.id;
  card.draggable = true;
  const handle = document.createElement("div");
  handle.className = "drag-handle";
  handle.appendChild(svgEl(GripVertical, 14));
  const cardIcon = document.createElement("div");
  cardIcon.className = "card-icon";
  cardIcon.title = "Change icon";
  applyProjectIconStyle(cardIcon, project);
  cardIcon.appendChild(renderIcon(project.icon, 18, project.name));
  const iconOverlay = document.createElement("div");
  iconOverlay.className = "card-icon-overlay";
  iconOverlay.appendChild(svgEl(Pencil, 13));
  cardIcon.appendChild(iconOverlay);
  cardIcon.addEventListener("click", () => openIconDialog(project.id));
  const body = document.createElement("div");
  body.className = "card-body";
  const nameInput = document.createElement("input");
  nameInput.className = "card-name-input";
  nameInput.value = project.name;
  nameInput.spellcheck = false;
  nameInput.addEventListener("change", async () => {
    const v = nameInput.value.trim();
    if (!v) {
      nameInput.value = project.name;
      return;
    }
    project.name = v;
    await send({ type: "SAVE_PROJECT", project });
  });
  const meta = document.createElement("div");
  meta.className = "card-meta";
  const tabCount = project.tabs.length;
  meta.appendChild(document.createTextNode(`${tabCount} tab${tabCount !== 1 ? "s" : ""}`));
  body.appendChild(nameInput);
  body.appendChild(meta);
  const status = document.createElement("div");
  status.className = "card-status";
  if (isOpen) {
    const dot = document.createElement("span");
    dot.className = "dot-open";
    dot.title = "Window is open";
    status.appendChild(dot);
  }
  const actions = document.createElement("div");
  actions.className = "card-actions";
  const openBtn = document.createElement("button");
  openBtn.className = "card-btn";
  openBtn.title = isOpen ? "Focus window" : "Open project";
  openBtn.appendChild(svgEl(ExternalLink, 14));
  openBtn.addEventListener("click", async () => {
    await send({ type: "OPEN_PROJECT", projectId: project.id });
    await refresh();
  });
  const delBtn = document.createElement("button");
  delBtn.className = "card-btn danger";
  delBtn.title = "Delete project";
  delBtn.appendChild(svgEl(Trash2, 14));
  delBtn.addEventListener("click", () => openDeleteDialog(project.id, project.name));
  actions.appendChild(openBtn);
  actions.appendChild(delBtn);
  card.appendChild(handle);
  card.appendChild(cardIcon);
  card.appendChild(body);
  card.appendChild(status);
  card.appendChild(actions);
  setupDrag(card);
  return card;
}
function setupDrag(card) {
  card.addEventListener("dragstart", (e) => {
    dragSrcId = card.dataset.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
  });
  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (card.dataset.id !== dragSrcId)
      card.classList.add("drag-over");
    e.dataTransfer.dropEffect = "move";
  });
  card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
  card.addEventListener("drop", async (e) => {
    e.preventDefault();
    card.classList.remove("drag-over");
    if (!dragSrcId || dragSrcId === card.dataset.id)
      return;
    const si = projects.findIndex((p) => p.id === dragSrcId);
    const di = projects.findIndex((p) => p.id === card.dataset.id);
    if (si === -1 || di === -1)
      return;
    const [moved] = projects.splice(si, 1);
    projects.splice(di, 0, moved);
    await send({ type: "REORDER_PROJECTS", orderedIds: projects.map((p) => p.id) });
    renderProjects();
  });
}
function openIconDialog(projectId) {
  pendingIconId = projectId;
  uploadDataUrl = null;
  renderColorSwatches();
  switchIconTab("lucide");
  document.getElementById("icon-search").value = "";
  resetUploadUI();
  buildLucideGrid("");
  void loadAllIcons();
  document.getElementById("icon-dialog").style.display = "flex";
  requestAnimationFrame(() => lucideGrid.refresh());
}
function renderColorSwatches() {
  const container = document.getElementById("project-color-swatches");
  const project = projects.find((p) => p.id === pendingIconId);
  if (!project)
    return;
  const activeColor = project.color ?? projectColorFromSeed(project.id || project.name);
  container.innerHTML = "";
  const saveColor = async (color) => {
    project.color = color;
    await send({ type: "SAVE_PROJECT", project });
    renderColorSwatches();
    renderProjects();
  };
  for (const color of PROJECT_BADGE_COLORS) {
    const btn = document.createElement("button");
    btn.className = "project-color-swatch" + (color === activeColor ? " active" : "");
    btn.style.background = color;
    btn.title = color;
    btn.type = "button";
    btn.addEventListener("click", () => {
      void saveColor(color);
    });
    container.appendChild(btn);
  }
  const customBtn = document.createElement("button");
  customBtn.className = "project-color-swatch custom" + (PROJECT_BADGE_COLORS.includes(activeColor) ? "" : " active");
  customBtn.type = "button";
  customBtn.title = "Choose custom color";
  customBtn.textContent = "+";
  if (!PROJECT_BADGE_COLORS.includes(activeColor)) {
    customBtn.style.background = activeColor;
    customBtn.style.color = "#fff";
  }
  const input = document.createElement("input");
  input.type = "color";
  input.value = /^#[0-9a-f]{6}$/i.test(activeColor) ? activeColor : "#4f86e8";
  input.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none";
  input.addEventListener("input", () => {
    customBtn.style.background = input.value;
    customBtn.style.color = "#fff";
  });
  input.addEventListener("change", () => {
    void saveColor(input.value);
  });
  customBtn.addEventListener("click", () => input.click());
  customBtn.appendChild(input);
  container.appendChild(customBtn);
}
async function buildLucideGrid(filter) {
  let names;
  if (!filter) {
    names = DEFAULT_ICONS;
  } else {
    const icons = await loadAllIcons();
    const q = filter.toLowerCase();
    names = Object.keys(icons).filter((n) => n.toLowerCase().includes(q));
  }
  lucideGrid.setItems(names);
}
function switchIconTab(tab) {
  document.querySelectorAll(".icon-tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });
  document.getElementById("icon-tab-lucide").style.display = tab === "lucide" ? "" : "none";
  document.getElementById("icon-tab-upload").style.display = tab === "upload" ? "" : "none";
  requestAnimationFrame(() => {
    if (tab === "lucide")
      lucideGrid.refresh();
  });
}
document.querySelectorAll(".icon-tab").forEach((el) => {
  el.addEventListener("click", () => {
    switchIconTab(el.dataset.tab);
  });
});
document.getElementById("icon-search").addEventListener("input", (e) => {
  void buildLucideGrid(e.target.value);
});
document.getElementById("icon-dialog-close").addEventListener("click", () => closeDialog("icon-dialog"));
document.getElementById("icon-dialog").addEventListener("click", (e) => {
  if (e.target === e.currentTarget)
    closeDialog("icon-dialog");
});
var uploadArea = document.getElementById("upload-area");
var uploadInput = document.getElementById("icon-upload-input");
uploadArea.addEventListener("click", () => uploadInput.click());
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("drag-over-upload");
});
uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("drag-over-upload"));
uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("drag-over-upload");
  const file = e.dataTransfer?.files[0];
  if (file)
    handleUploadFile(file);
});
uploadInput.addEventListener("change", () => {
  const file = uploadInput.files?.[0];
  if (file)
    handleUploadFile(file);
  uploadInput.value = "";
});
function handleUploadFile(file) {
  if (file.size > 512 * 1024) {
    void alertDialog("Image must be under 512 KB");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    uploadDataUrl = reader.result;
    const img = document.getElementById("upload-preview-img");
    img.src = uploadDataUrl;
    document.getElementById("upload-area").style.display = "none";
    document.getElementById("upload-preview").style.display = "flex";
  };
  reader.readAsDataURL(file);
}
function resetUploadUI() {
  uploadDataUrl = null;
  document.getElementById("upload-area").style.display = "flex";
  document.getElementById("upload-preview").style.display = "none";
  document.getElementById("upload-preview-img").src = "";
}
document.getElementById("upload-use").addEventListener("click", () => {
  if (uploadDataUrl)
    applyIcon(uploadDataUrl);
});
document.getElementById("upload-clear").addEventListener("click", resetUploadUI);
document.getElementById("btn-clear-icon").addEventListener("click", () => {
  void applyIcon("");
});
async function applyIcon(iconVal) {
  if (!pendingIconId)
    return;
  const p = projects.find((p2) => p2.id === pendingIconId);
  if (!p)
    return;
  p.icon = iconVal;
  await send({ type: "SAVE_PROJECT", project: p });
  closeDialog("icon-dialog");
  renderProjects();
}
function openDeleteDialog(projectId, name) {
  pendingDeleteId = projectId;
  document.getElementById("delete-message").textContent = `"${name}" will be permanently deleted and its window closed.`;
  document.getElementById("delete-dialog").style.display = "flex";
}
document.getElementById("delete-dialog").addEventListener("click", (e) => {
  if (e.target === e.currentTarget)
    closeDialog("delete-dialog");
});
document.getElementById("delete-cancel").addEventListener("click", () => closeDialog("delete-dialog"));
document.getElementById("delete-confirm").addEventListener("click", async () => {
  if (!pendingDeleteId)
    return;
  await send({ type: "DELETE_PROJECT", projectId: pendingDeleteId });
  closeDialog("delete-dialog");
  await refresh();
});
document.getElementById("btn-assign").addEventListener("click", async () => {
  const name = await promptDialog("Project name");
  if (!name)
    return;
  const res = await send({ type: "CREATE_PROJECT", name });
  if (!res.ok)
    return;
  await send({ type: "ASSIGN_WINDOW", windowId: currentWindowId, projectId: res.data.id });
  await refresh();
});
document.getElementById("assign-dialog-close").addEventListener("click", () => closeDialog("assign-dialog"));
document.getElementById("assign-dialog").addEventListener("click", (e) => {
  if (e.target === e.currentTarget)
    closeDialog("assign-dialog");
});
document.getElementById("btn-new").addEventListener("click", async () => {
  const name = await promptDialog("Project name");
  if (!name)
    return;
  const res = await send({ type: "CREATE_PROJECT", name });
  if (!res.ok)
    return;
  await send({ type: "OPEN_PROJECT", projectId: res.data.id });
  await refresh();
});
document.getElementById("btn-export").addEventListener("click", async () => {
  const res = await send({ type: "EXPORT_PROJECTS" });
  if (!res.ok)
    return;
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chrome-projects-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("import-input").click();
});
document.getElementById("import-input").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file)
    return;
  try {
    const store = JSON.parse(await file.text());
    await send({ type: "IMPORT_PROJECTS", store });
    await refresh();
  } catch {
    await alertDialog("Invalid JSON file");
  }
  e.target.value = "";
});
function closeDialog(id) {
  document.getElementById(id).style.display = "none";
}
async function refresh() {
  await loadAll();
  renderAll();
}
refresh().catch(console.error);
/*! Bundled license information:

lucide/dist/esm/icons/download.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/external-link.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/grip-vertical.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/image.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/pencil.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/plus.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/trash-2.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/upload.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/x.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/lucide.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/

// node_modules/lucide/dist/esm/icons/chevron-right.mjs
var ChevronRight = [["path", { d: "m9 18 6-6-6-6" }]];

// node_modules/lucide/dist/esm/icons/folder-plus.mjs
var FolderPlus = [
  ["path", { d: "M12 10v6" }],
  ["path", { d: "M9 13h6" }],
  [
    "path",
    {
      d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
    }
  ]
];

// node_modules/lucide/dist/esm/icons/globe.mjs
var Globe = [
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }],
  ["path", { d: "M2 12h20" }]
];

// node_modules/lucide/dist/esm/icons/plus.mjs
var Plus = [
  ["path", { d: "M5 12h14" }],
  ["path", { d: "M12 5v14" }]
];

// node_modules/lucide/dist/esm/icons/settings.mjs
var Settings = [
  [
    "path",
    {
      d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
    }
  ],
  ["circle", { cx: "12", cy: "12", r: "3" }]
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

// src/popup/popup.ts
var allIcons = null;
var iconsLoadPromise = null;
function loadAllIcons() {
  if (allIcons)
    return Promise.resolve(allIcons);
  if (!iconsLoadPromise) {
    iconsLoadPromise = fetch(chrome.runtime.getURL("assets/lucide-icons.json")).then((r) => r.json()).then((data) => {
      allIcons = data;
      return data;
    });
  }
  return iconsLoadPromise;
}
function svgFromNode(node, size) {
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
function icon(node, size = 16) {
  return svgFromNode(node, size);
}
function projectInitial(name) {
  const words = name.trim().split(/[\s._/-]+/).filter(Boolean);
  if (words.length > 1) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return words[0]?.[0]?.toUpperCase() || "?";
}
function renderProjectIcon(iconVal, size = 18, projectName = "") {
  if (iconVal.startsWith("lucide:")) {
    const name = iconVal.slice(7);
    const cached = allIcons?.[name];
    if (cached)
      return svgFromNode(cached, size);
    const wrap = document.createElement("span");
    wrap.style.cssText = `width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center`;
    loadAllIcons().then((icons) => {
      if (icons[name])
        wrap.replaceWith(svgFromNode(icons[name], size));
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
function tabLabel(count) {
  return count === 0 ? "No tabs" : count === 1 ? "1 tab" : `${count} tabs`;
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
async function init() {
  document.getElementById("open-manager").appendChild(icon(Settings, 16));
  document.getElementById("btn-new-icon").appendChild(icon(Plus, 14));
  document.getElementById("btn-create-from-window").appendChild(icon(FolderPlus, 16));
  const win = await chrome.windows.getCurrent();
  const windowId = win.id;
  const [currentRes, allRes] = await Promise.all([
    send({ type: "GET_CURRENT_PROJECT", windowId }),
    send({ type: "GET_ALL_PROJECTS" }),
    loadAllIcons()
  ]);
  const currentProject = currentRes.ok ? currentRes.data : null;
  const allProjects = allRes.ok ? allRes.data : [];
  if (!currentProject) {
    const btn = document.getElementById("btn-create-from-window");
    btn.style.display = "flex";
    btn.addEventListener("click", async () => {
      const name = await promptDialog("Project name");
      if (!name)
        return;
      const res = await send({ type: "CREATE_PROJECT", name });
      if (!res.ok)
        return;
      await send({ type: "ASSIGN_WINDOW", windowId, projectId: res.data.id });
      window.close();
    });
  }
  renderHeader(currentProject);
  await renderList(allProjects, currentProject);
}
function renderHeader(project) {
  const iconEl = document.getElementById("current-icon");
  const nameEl = document.getElementById("current-name");
  const tabsEl = document.getElementById("current-tabs");
  iconEl.innerHTML = "";
  iconEl.classList.remove("project-icon-colored");
  iconEl.style.backgroundColor = "";
  if (project) {
    applyProjectIconStyle(iconEl, project);
    iconEl.appendChild(renderProjectIcon(project.icon, 24, project.name));
    nameEl.textContent = project.name;
    tabsEl.textContent = tabLabel(project.tabs.length);
  } else {
    iconEl.appendChild(icon(Globe, 22));
    nameEl.textContent = "No Project";
    tabsEl.textContent = "";
  }
}
async function renderList(projects, current) {
  const container = document.getElementById("projects-container");
  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No projects yet.<br>Create one to get started.
      </div>`;
    return;
  }
  const filtered = projects.filter((p) => p.id !== current?.id);
  const windowChecks = await Promise.all(
    filtered.map((p) => send({ type: "GET_WINDOW_FOR_PROJECT", projectId: p.id }))
  );
  const openSet = new Set(
    filtered.filter((_, i) => windowChecks[i].ok && windowChecks[i].data !== null).map((p) => p.id)
  );
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No other projects.</div>';
    return;
  }
  container.innerHTML = "";
  for (const project of filtered) {
    const isOpen = openSet.has(project.id);
    const item = document.createElement("div");
    item.className = "project-item";
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    const projectIconEl = document.createElement("div");
    projectIconEl.className = "project-icon";
    applyProjectIconStyle(projectIconEl, project);
    projectIconEl.appendChild(renderProjectIcon(project.icon, 16, project.name));
    const body = document.createElement("div");
    body.className = "project-body";
    const nameEl = document.createElement("div");
    nameEl.className = "project-name";
    nameEl.textContent = project.name;
    const metaEl = document.createElement("div");
    metaEl.className = "project-meta";
    metaEl.textContent = tabLabel(project.tabs.length);
    body.appendChild(nameEl);
    body.appendChild(metaEl);
    const right = document.createElement("div");
    right.className = "project-right";
    if (isOpen) {
      const dot = document.createElement("div");
      dot.className = "dot-open";
      dot.title = "Window is open";
      right.appendChild(dot);
    }
    const arrow = document.createElement("div");
    arrow.className = "project-arrow";
    arrow.appendChild(icon(ChevronRight, 14));
    right.appendChild(arrow);
    item.appendChild(projectIconEl);
    item.appendChild(body);
    item.appendChild(right);
    const activate = async () => {
      await send({ type: "OPEN_PROJECT", projectId: project.id });
      window.close();
    };
    item.addEventListener("click", activate);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ")
        activate();
    });
    container.appendChild(item);
  }
}
document.getElementById("open-manager").addEventListener("click", async () => {
  const win = await chrome.windows.getCurrent();
  await chrome.sidePanel.open({ windowId: win.id });
  window.close();
});
document.getElementById("btn-new-project").addEventListener("click", async () => {
  const name = await promptDialog("Project name");
  if (!name)
    return;
  const res = await send({ type: "CREATE_PROJECT", name });
  if (res.ok) {
    await send({ type: "OPEN_PROJECT", projectId: res.data.id });
    window.close();
  }
});
init().catch(console.error);
/*! Bundled license information:

lucide/dist/esm/icons/chevron-right.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/folder-plus.mjs:
  (**
   * @license lucide v1.11.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/globe.mjs:
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

lucide/dist/esm/icons/settings.mjs:
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

import {
  Settings,
  Globe,
  ChevronRight, Plus, FolderPlus,
  type IconNode,
} from 'lucide';
import type { Message, MessageResponse } from '../models/messages';
import { projectColorFromSeed, type Project } from '../models/project';

// Project icons are loaded lazily from the bundled curated lucide JSON.
type LucideData = Array<[string, Record<string, string>]>;
let allIcons: Record<string, LucideData> | null = null;
let iconsLoadPromise: Promise<Record<string, LucideData>> | null = null;

function loadAllIcons(): Promise<Record<string, LucideData>> {
  if (allIcons) return Promise.resolve(allIcons);
  if (!iconsLoadPromise) {
    iconsLoadPromise = fetch(chrome.runtime.getURL('assets/lucide-icons.json'))
      .then(r => r.json())
      .then(data => { allIcons = data; return data; });
  }
  return iconsLoadPromise;
}

function svgFromNode(node: IconNode | LucideData, size: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const [tag, attrs] of node as LucideData) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs))
      el.setAttribute(k, String(v));
    svg.appendChild(el);
  }
  return svg;
}

function icon(node: IconNode, size = 16): SVGSVGElement {
  return svgFromNode(node, size);
}

function projectInitial(name: string): string {
  const words = name.trim().split(/[\s._/-]+/).filter(Boolean);
  if (words.length > 1) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return words[0]?.[0]?.toUpperCase() || '?';
}

function renderProjectIcon(iconVal: string, size = 18, projectName = ''): HTMLElement | SVGSVGElement {
  if (iconVal.startsWith('lucide:')) {
    const name = iconVal.slice(7);
    const cached = allIcons?.[name];
    if (cached) return svgFromNode(cached, size);
    // Async render: placeholder span replaced once JSON loads
    const wrap = document.createElement('span');
    wrap.style.cssText = `width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center`;
    loadAllIcons().then(icons => {
      if (icons[name]) wrap.replaceWith(svgFromNode(icons[name], size));
    });
    return wrap;
  }
  if (iconVal.startsWith('data:')) {
    const img = document.createElement('img');
    img.src = iconVal;
    img.className = 'project-icon-img';
    return img;
  }
  const span = document.createElement('span');
  span.textContent = iconVal || projectInitial(projectName);
  return span;
}

function send<T>(msg: Message): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(msg);
}

function promptDialog(title: string): Promise<string | null> {
  return new Promise(resolve => {
    const overlay = document.getElementById('prompt-dialog')!;
    const titleEl = document.getElementById('prompt-title')!;
    const input = document.getElementById('prompt-input') as HTMLInputElement;
    const okBtn = document.getElementById('prompt-ok')!;
    const cancelBtn = document.getElementById('prompt-cancel')!;

    titleEl.textContent = title;
    input.value = '';
    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 0);

    const cleanup = () => {
      overlay.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', onBackdrop);
    };
    const onOk = () => { const v = input.value.trim(); cleanup(); resolve(v || null); };
    const onCancel = () => { cleanup(); resolve(null); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onOk();
      else if (e.key === 'Escape') onCancel();
    };
    const onBackdrop = (e: MouseEvent) => { if (e.target === overlay) onCancel(); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
    overlay.addEventListener('click', onBackdrop);
  });
}

function tabLabel(count: number): string {
  return count === 0 ? 'No tabs' : count === 1 ? '1 tab' : `${count} tabs`;
}

function projectIconColor(project: Project): string {
  return project.color ?? projectColorFromSeed(project.id || project.name);
}

function applyProjectIconStyle(container: HTMLElement, project: Project): void {
  if (project.icon.startsWith('data:')) return;
  container.classList.add('project-icon-colored');
  container.style.backgroundColor = projectIconColor(project);
}

async function init() {
  document.getElementById('open-manager')!.appendChild(icon(Settings, 16));
  document.getElementById('btn-new-icon')!.appendChild(icon(Plus, 14));
  document.getElementById('btn-create-from-window')!.appendChild(icon(FolderPlus, 16));

  const win = await chrome.windows.getCurrent();
  const windowId = win.id!;

  const [currentRes, allRes] = await Promise.all([
    send<Project | null>({ type: 'GET_CURRENT_PROJECT', windowId }),
    send<Project[]>({ type: 'GET_ALL_PROJECTS' }),
    loadAllIcons(),
  ]);

  const currentProject = currentRes.ok ? currentRes.data : null;
  const allProjects = allRes.ok ? allRes.data : [];

  // Show "create from window" button only when no project is assigned
  if (!currentProject) {
    const btn = document.getElementById('btn-create-from-window')!;
    btn.style.display = 'flex';
    btn.addEventListener('click', async () => {
      const name = await promptDialog('Project name');
      if (!name) return;
      const res = await send<Project>({ type: 'CREATE_PROJECT', name });
      if (!res.ok) return;
      await send({ type: 'ASSIGN_WINDOW', windowId, projectId: res.data.id });
      window.close();
    });
  }

  renderHeader(currentProject);
  await renderList(allProjects, currentProject);
}

function renderHeader(project: Project | null) {
  const iconEl = document.getElementById('current-icon')!;
  const nameEl = document.getElementById('current-name')!;
  const tabsEl = document.getElementById('current-tabs')!;

  iconEl.innerHTML = '';
  iconEl.classList.remove('project-icon-colored');
  iconEl.style.backgroundColor = '';

  if (project) {
    applyProjectIconStyle(iconEl, project);
    iconEl.appendChild(renderProjectIcon(project.icon, 24, project.name));
    nameEl.textContent = project.name;
    tabsEl.textContent = tabLabel(project.tabs.length);
  } else {
    iconEl.appendChild(icon(Globe, 22));
    nameEl.textContent = 'No Project';
    tabsEl.textContent = '';
  }
}

async function renderList(projects: Project[], current: Project | null) {
  const container = document.getElementById('projects-container')!;

  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No projects yet.<br>Create one to get started.
      </div>`;
    return;
  }

  const filtered = projects.filter(p => p.id !== current?.id);

  const windowChecks = await Promise.all(
    filtered.map(p => send<number | null>({ type: 'GET_WINDOW_FOR_PROJECT', projectId: p.id })),
  );
  const openSet = new Set(
    filtered
      .filter((_, i) => windowChecks[i].ok && windowChecks[i].data !== null)
      .map(p => p.id),
  );

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No other projects.</div>';
    return;
  }

  container.innerHTML = '';

  for (const project of filtered) {
    const isOpen = openSet.has(project.id);

    const item = document.createElement('div');
    item.className = 'project-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');

    const projectIconEl = document.createElement('div');
    projectIconEl.className = 'project-icon';
    applyProjectIconStyle(projectIconEl, project);
    projectIconEl.appendChild(renderProjectIcon(project.icon, 16, project.name));

    const body = document.createElement('div');
    body.className = 'project-body';
    const nameEl = document.createElement('div');
    nameEl.className = 'project-name';
    nameEl.textContent = project.name;
    const metaEl = document.createElement('div');
    metaEl.className = 'project-meta';
    metaEl.textContent = tabLabel(project.tabs.length);
    body.appendChild(nameEl);
    body.appendChild(metaEl);

    const right = document.createElement('div');
    right.className = 'project-right';
    if (isOpen) {
      const dot = document.createElement('div');
      dot.className = 'dot-open';
      dot.title = 'Window is open';
      right.appendChild(dot);
    }
    const arrow = document.createElement('div');
    arrow.className = 'project-arrow';
    arrow.appendChild(icon(ChevronRight, 14));
    right.appendChild(arrow);

    item.appendChild(projectIconEl);
    item.appendChild(body);
    item.appendChild(right);

    const activate = async () => {
      await send({ type: 'OPEN_PROJECT', projectId: project.id });
      window.close();
    };

    item.addEventListener('click', activate);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });

    container.appendChild(item);
  }
}

// Manager button - open as side panel
document.getElementById('open-manager')!.addEventListener('click', async () => {
  const win = await chrome.windows.getCurrent();
  await chrome.sidePanel.open({ windowId: win.id! });
  window.close();
});

// New project button
document.getElementById('btn-new-project')!.addEventListener('click', async () => {
  const name = await promptDialog('Project name');
  if (!name) return;
  const res = await send<Project>({ type: 'CREATE_PROJECT', name });
  if (res.ok) {
    await send({ type: 'OPEN_PROJECT', projectId: res.data.id });
    window.close();
  }
});

init().catch(console.error);

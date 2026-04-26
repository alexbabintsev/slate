import {
  Layers, Upload, Download, Plus, ExternalLink, Trash2, X, GripVertical, Image, Pencil,
  type IconNode,
} from 'lucide';
import type { Message, MessageResponse } from '../models/messages';
import {
  PROJECT_BADGE_COLORS,
  projectColorFromSeed,
  type Project,
  type ProjectStore,
} from '../models/project';

// ── Lucide helper ─────────────────────────────────────────
type LucideData = Array<[string, Record<string, string>]>;

function svgEl(node: IconNode | LucideData, size = 16): SVGSVGElement {
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
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    svg.appendChild(el);
  }
  return svg;
}

// All 1943 icons loaded lazily on first picker open
let allIcons: Record<string, LucideData> | null = null;
let iconsLoadPromise: Promise<Record<string, LucideData>> | null = null;

async function loadAllIcons(): Promise<Record<string, LucideData>> {
  if (allIcons) return allIcons;
  if (!iconsLoadPromise) {
    iconsLoadPromise = fetch(chrome.runtime.getURL('assets/lucide-icons.json'))
      .then(r => r.json())
      .then(data => { allIcons = data; return data; });
  }
  return iconsLoadPromise;
}

// Default 35 icons shown before search
const DEFAULT_ICONS = [
  'Folder','FolderOpen','Briefcase','Home','Globe','Rocket','Zap',
  'Target','Lightbulb','Flame','Heart','Star','Trophy','Bookmark',
  'Monitor','Smartphone','Code2','Terminal','Database','Server',
  'Cloud','Shield','Lock','Key','Settings','Wrench','GitBranch',
  'BarChart2','TrendingUp','DollarSign','Mail','Bell','Palette','Music','Coffee',
];

function projectInitial(name: string): string {
  const words = name.trim().split(/[\s._/-]+/).filter(Boolean);
  if (words.length > 1) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return words[0]?.[0]?.toUpperCase() || '?';
}

// Render icon value (lucide:Name | data:... | legacy text) → element
function renderIcon(iconVal: string, size = 18, projectName = ''): HTMLElement | SVGSVGElement {
  if (iconVal.startsWith('lucide:')) {
    const name = iconVal.slice(7);
    // Try from already-loaded cache first, else render placeholder that fills in async
    const cached = allIcons?.[name];
    if (cached) return svgEl(cached, size);
    // Return a span placeholder; async replace when icons load
    const wrap = document.createElement('span');
    wrap.style.cssText = `width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center`;
    loadAllIcons().then(icons => {
      if (icons[name]) wrap.replaceWith(svgEl(icons[name], size));
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

function projectIconColor(project: Project): string {
  return project.color ?? projectColorFromSeed(project.id || project.name);
}

function applyProjectIconStyle(container: HTMLElement, project: Project): void {
  if (project.icon.startsWith('data:')) return;
  container.classList.add('project-icon-colored');
  container.style.backgroundColor = projectIconColor(project);
}

// ── Grid renderer ──────────────────────────────────────────
// For ≤35 items: plain DOM (no scroll).
// For >35 items: virtual scroll capped at 5-row viewport height.
const COLS = 7;
const VISIBLE_ROWS = 5;
const BUFFER_ROWS = 2;

class IconGridRenderer {
  private container: HTMLElement;
  private items: string[] = [];
  private renderCell: (item: string) => HTMLElement;
  // virtual scroll state
  private spacer: HTMLElement | null = null;
  private canvas: HTMLElement | null = null;
  private cellSize = 0;
  private visibleStart = -1;
  private isVirtual = false;

  constructor(containerId: string, renderCell: (item: string) => HTMLElement) {
    this.container = document.getElementById(containerId)!;
    this.renderCell = renderCell;
  }

  setItems(items: string[]) {
    this.items = items;
    this.visibleStart = -1;
    this.container.scrollTop = 0;
    this.container.innerHTML = '';
    this.spacer = null;
    this.canvas = null;
    this.isVirtual = items.length > 35;

    if (this.isVirtual) {
      this.setupVirtual();
    } else {
      this.setupPlain();
    }
  }

  private setupPlain() {
    // Remove fixed height - let grid grow naturally to fit all items
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

  private setupVirtual() {
    // Measure cell size: container width minus padding divided by cols
    const availW = this.container.parentElement!.clientWidth - 20;
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

    this.spacer = document.createElement('div');
    this.spacer.style.cssText = 'position:absolute;top:0;left:0;width:1px;pointer-events:none';
    const totalH = Math.ceil(this.items.length / COLS) * rowH + 10;
    this.spacer.style.height = `${totalH}px`;
    this.container.appendChild(this.spacer);

    this.canvas = document.createElement('div');
    this.canvas.style.cssText = `display:grid;grid-template-columns:repeat(${COLS},1fr);gap:2px;padding:0 10px;position:absolute;left:0;right:0;box-sizing:border-box`;
    this.container.appendChild(this.canvas);

    this.container.addEventListener('scroll', () => this.renderVirtual(), { passive: true });
    this.renderVirtual();
  }

  private renderVirtual() {
    if (!this.canvas) return;
    const rowH = this.cellSize + 2;
    const scrollTop = this.container.scrollTop;
    const viewH = this.container.clientHeight;

    const firstRow = Math.max(0, Math.floor(scrollTop / rowH) - BUFFER_ROWS);
    const lastRow = Math.min(
      Math.ceil(this.items.length / COLS) - 1,
      Math.ceil((scrollTop + viewH) / rowH) + BUFFER_ROWS,
    );

    if (firstRow === this.visibleStart) return;
    this.visibleStart = firstRow;

    this.canvas.style.top = `${firstRow * rowH + 6}px`;
    this.canvas.innerHTML = '';

    const start = firstRow * COLS;
    const end = Math.min(this.items.length, (lastRow + 1) * COLS);
    for (let i = start; i < end; i++) {
      const cell = this.renderCell(this.items[i]);
      cell.style.aspectRatio = '1';
      this.canvas.appendChild(cell);
    }
  }

  refresh() {
    if (this.isVirtual) this.renderVirtual();
  }
}

// ── Send helper ───────────────────────────────────────────
function send<T>(msg: Message): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(msg);
}

// ── Dialog helpers ────────────────────────────────────────
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

function alertDialog(message: string, title = 'Notice'): Promise<void> {
  return new Promise(resolve => {
    const overlay = document.getElementById('alert-dialog')!;
    const titleEl = document.getElementById('alert-title')!;
    const msgEl = document.getElementById('alert-message')!;
    const okBtn = document.getElementById('alert-ok')!;

    titleEl.textContent = title;
    msgEl.textContent = message;
    overlay.style.display = 'flex';

    const cleanup = () => {
      overlay.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      overlay.removeEventListener('click', onBackdrop);
    };
    const onOk = () => { cleanup(); resolve(); };
    const onBackdrop = (e: MouseEvent) => { if (e.target === overlay) onOk(); };

    okBtn.addEventListener('click', onOk);
    overlay.addEventListener('click', onBackdrop);
  });
}

// ── State ─────────────────────────────────────────────────
let projects: Project[] = [];
let openIds = new Set<string>();
let currentWindowId = 0;
let currentProjectId: string | null = null;
let pendingIconId: string | null = null;
let pendingDeleteId: string | null = null;
let dragSrcId: string | null = null;
let uploadDataUrl: string | null = null;

// ── Boot static icons ─────────────────────────────────────
document.getElementById('btn-new-icon')!.appendChild(svgEl(Plus, 14));
document.getElementById('btn-import')!.appendChild(svgEl(Download, 15));
document.getElementById('btn-export')!.appendChild(svgEl(Upload, 15));
document.getElementById('icon-dialog-close')!.appendChild(svgEl(X, 14));
document.getElementById('btn-clear-icon')!.prepend(svgEl(X, 12));
document.getElementById('assign-dialog-close')!.appendChild(svgEl(X, 14));
document.getElementById('upload-area-icon')!.appendChild(svgEl(Image, 28));

const manifest = chrome.runtime.getManifest();
document.getElementById('footer-version')!.textContent = `v${manifest.version}`;
const author = manifest.author;
const authorText = typeof author === 'string' ? author : author?.email ?? '';
document.getElementById('footer-author')!.textContent = authorText;

// ── Virtual grids ──────────────────────────────────────────
const lucideGrid = new IconGridRenderer('lucide-grid', (name) => {
  const btn = document.createElement('button');
  btn.className = 'lucide-btn';
  btn.title = name;
  const data = allIcons?.[name];
  if (data) {
    btn.appendChild(svgEl(data, 18));
  } else {
    const ph = document.createElement('span');
    ph.style.cssText = 'width:18px;height:18px;display:block';
    btn.appendChild(ph);
    loadAllIcons().then(all => { if (all[name]) ph.replaceWith(svgEl(all[name], 18)); });
  }
  btn.addEventListener('click', () => applyIcon(`lucide:${name}`));
  return btn;
});

// ── Load ──────────────────────────────────────────────────
async function loadAll() {
  const win = await chrome.windows.getCurrent();
  currentWindowId = win.id!;

  const [allRes, currentRes] = await Promise.all([
    send<Project[]>({ type: 'GET_ALL_PROJECTS' }),
    send<Project | null>({ type: 'GET_CURRENT_PROJECT', windowId: currentWindowId }),
  ]);

  projects = allRes.ok ? allRes.data : [];
  currentProjectId = currentRes.ok && currentRes.data ? currentRes.data.id : null;

  const checks = await Promise.all(
    projects.map(p => send<number | null>({ type: 'GET_WINDOW_FOR_PROJECT', projectId: p.id })),
  );
  openIds = new Set(
    projects.filter((_, i) => checks[i].ok && checks[i].data !== null).map(p => p.id),
  );
}

// ── Render ────────────────────────────────────────────────
function renderAll() {
  renderBanner();
  renderProjects();
}

function renderBanner() {
  const banner = document.getElementById('assign-banner')!;
  if (currentProjectId) {
    banner.style.display = 'none';
  } else {
    banner.style.display = 'flex';
  }
}

function renderProjects() {
  const list = document.getElementById('project-list')!;
  if (projects.length === 0) {
    list.innerHTML = '<div class="empty-state">No projects yet.<br>Hit "New Project" to get started.</div>';
    return;
  }
  list.innerHTML = '';
  for (const p of projects) list.appendChild(makeCard(p));
}

function makeCard(project: Project): HTMLElement {
  const isOpen = openIds.has(project.id);
  const isCurrent = project.id === currentProjectId;

  const card = document.createElement('div');
  card.className = 'project-card' + (isCurrent ? ' current' : '');
  card.dataset.id = project.id;
  card.draggable = true;

  // Drag handle - always visible
  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  handle.appendChild(svgEl(GripVertical, 14));

  // Icon
  const cardIcon = document.createElement('div');
  cardIcon.className = 'card-icon';
  cardIcon.title = 'Change icon';
  applyProjectIconStyle(cardIcon, project);
  cardIcon.appendChild(renderIcon(project.icon, 18, project.name));
  const iconOverlay = document.createElement('div');
  iconOverlay.className = 'card-icon-overlay';
  iconOverlay.appendChild(svgEl(Pencil, 13));
  cardIcon.appendChild(iconOverlay);
  cardIcon.addEventListener('click', () => openIconDialog(project.id));

  // Body
  const body = document.createElement('div');
  body.className = 'card-body';

  const nameInput = document.createElement('input');
  nameInput.className = 'card-name-input';
  nameInput.value = project.name;
  nameInput.spellcheck = false;
  nameInput.addEventListener('change', async () => {
    const v = nameInput.value.trim();
    if (!v) { nameInput.value = project.name; return; }
    project.name = v;
    await send({ type: 'SAVE_PROJECT', project });
  });

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const tabCount = project.tabs.length;
  meta.appendChild(document.createTextNode(`${tabCount} tab${tabCount !== 1 ? 's' : ''}`));

  body.appendChild(nameInput);
  body.appendChild(meta);

  const status = document.createElement('div');
  status.className = 'card-status';
  if (isOpen) {
    const dot = document.createElement('span');
    dot.className = 'dot-open';
    dot.title = 'Window is open';
    status.appendChild(dot);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const openBtn = document.createElement('button');
  openBtn.className = 'card-btn';
  openBtn.title = isOpen ? 'Focus window' : 'Open project';
  openBtn.appendChild(svgEl(ExternalLink, 14));
  openBtn.addEventListener('click', async () => {
    await send({ type: 'OPEN_PROJECT', projectId: project.id });
    await refresh();
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'card-btn danger';
  delBtn.title = 'Delete project';
  delBtn.appendChild(svgEl(Trash2, 14));
  delBtn.addEventListener('click', () => openDeleteDialog(project.id, project.name));

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

// ── Drag & Drop ───────────────────────────────────────────
function setupDrag(card: HTMLElement) {
  card.addEventListener('dragstart', e => {
    dragSrcId = card.dataset.id!;
    card.classList.add('dragging');
    e.dataTransfer!.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });
  card.addEventListener('dragover', e => {
    e.preventDefault();
    if (card.dataset.id !== dragSrcId) card.classList.add('drag-over');
    e.dataTransfer!.dropEffect = 'move';
  });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', async e => {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (!dragSrcId || dragSrcId === card.dataset.id) return;
    const si = projects.findIndex(p => p.id === dragSrcId);
    const di = projects.findIndex(p => p.id === card.dataset.id);
    if (si === -1 || di === -1) return;
    const [moved] = projects.splice(si, 1);
    projects.splice(di, 0, moved);
    await send({ type: 'REORDER_PROJECTS', orderedIds: projects.map(p => p.id) });
    renderProjects();
  });
}

// ── Icon dialog ───────────────────────────────────────────
function openIconDialog(projectId: string) {
  pendingIconId = projectId;
  uploadDataUrl = null;

  renderColorSwatches();
  switchIconTab('lucide');
  (document.getElementById('icon-search') as HTMLInputElement).value = '';
  resetUploadUI();
  buildLucideGrid('');

  // Preload data in background so search is instant
  void loadAllIcons();

  document.getElementById('icon-dialog')!.style.display = 'flex';
  requestAnimationFrame(() => lucideGrid.refresh());
}

function renderColorSwatches() {
  const container = document.getElementById('project-color-swatches')!;
  const project = projects.find(p => p.id === pendingIconId);
  if (!project) return;

  const activeColor = project.color ?? projectColorFromSeed(project.id || project.name);
  container.innerHTML = '';

  const saveColor = async (color: string) => {
    project.color = color;
    await send({ type: 'SAVE_PROJECT', project });
    renderColorSwatches();
    renderProjects();
  };

  for (const color of PROJECT_BADGE_COLORS) {
    const btn = document.createElement('button');
    btn.className = 'project-color-swatch' + (color === activeColor ? ' active' : '');
    btn.style.background = color;
    btn.title = color;
    btn.type = 'button';
    btn.addEventListener('click', () => { void saveColor(color); });
    container.appendChild(btn);
  }

  const customBtn = document.createElement('button');
  customBtn.className = 'project-color-swatch custom'
    + (PROJECT_BADGE_COLORS.includes(activeColor as never) ? '' : ' active');
  customBtn.type = 'button';
  customBtn.title = 'Choose custom color';
  customBtn.textContent = '+';
  if (!PROJECT_BADGE_COLORS.includes(activeColor as never)) {
    customBtn.style.background = activeColor;
    customBtn.style.color = '#fff';
  }

  const input = document.createElement('input');
  input.type = 'color';
  input.value = /^#[0-9a-f]{6}$/i.test(activeColor) ? activeColor : '#4f86e8';
  input.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
  input.addEventListener('input', () => {
    customBtn.style.background = input.value;
    customBtn.style.color = '#fff';
  });
  input.addEventListener('change', () => { void saveColor(input.value); });

  customBtn.addEventListener('click', () => input.click());
  customBtn.appendChild(input);
  container.appendChild(customBtn);
}

async function buildLucideGrid(filter: string) {
  let names: string[];
  if (!filter) {
    names = DEFAULT_ICONS;
  } else {
    const icons = await loadAllIcons();
    const q = filter.toLowerCase();
    names = Object.keys(icons).filter(n => n.toLowerCase().includes(q));
  }
  lucideGrid.setItems(names);
}

function switchIconTab(tab: 'lucide' | 'upload') {
  document.querySelectorAll('.icon-tab').forEach(el => {
    (el as HTMLElement).classList.toggle('active', (el as HTMLElement).dataset.tab === tab);
  });
  document.getElementById('icon-tab-lucide')!.style.display = tab === 'lucide' ? '' : 'none';
  document.getElementById('icon-tab-upload')!.style.display = tab === 'upload' ? '' : 'none';

  // Refresh so VirtualGrid measures real dimensions after display change
  requestAnimationFrame(() => {
    if (tab === 'lucide') lucideGrid.refresh();
  });
}

document.querySelectorAll('.icon-tab').forEach(el => {
  el.addEventListener('click', () => {
    switchIconTab((el as HTMLElement).dataset.tab as 'lucide' | 'upload');
  });
});

document.getElementById('icon-search')!.addEventListener('input', e => {
  void buildLucideGrid((e.target as HTMLInputElement).value);
});

document.getElementById('icon-dialog-close')!.addEventListener('click', () => closeDialog('icon-dialog'));
document.getElementById('icon-dialog')!.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDialog('icon-dialog');
});

// Upload tab
const uploadArea = document.getElementById('upload-area')!;
const uploadInput = document.getElementById('icon-upload-input') as HTMLInputElement;

uploadArea.addEventListener('click', () => uploadInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over-upload'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over-upload'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over-upload');
  const file = e.dataTransfer?.files[0];
  if (file) handleUploadFile(file);
});

uploadInput.addEventListener('change', () => {
  const file = uploadInput.files?.[0];
  if (file) handleUploadFile(file);
  uploadInput.value = '';
});

function handleUploadFile(file: File) {
  if (file.size > 512 * 1024) { void alertDialog('Image must be under 512 KB'); return; }

  const reader = new FileReader();
  reader.onload = () => {
    uploadDataUrl = reader.result as string;
    const img = document.getElementById('upload-preview-img') as HTMLImageElement;
    img.src = uploadDataUrl;
    document.getElementById('upload-area')!.style.display = 'none';
    document.getElementById('upload-preview')!.style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function resetUploadUI() {
  uploadDataUrl = null;
  document.getElementById('upload-area')!.style.display = 'flex';
  document.getElementById('upload-preview')!.style.display = 'none';
  (document.getElementById('upload-preview-img') as HTMLImageElement).src = '';
}

document.getElementById('upload-use')!.addEventListener('click', () => {
  if (uploadDataUrl) applyIcon(uploadDataUrl);
});

document.getElementById('upload-clear')!.addEventListener('click', resetUploadUI);

document.getElementById('btn-clear-icon')!.addEventListener('click', () => {
  void applyIcon('');
});

async function applyIcon(iconVal: string) {
  if (!pendingIconId) return;
  const p = projects.find(p => p.id === pendingIconId);
  if (!p) return;
  p.icon = iconVal;
  await send({ type: 'SAVE_PROJECT', project: p });
  closeDialog('icon-dialog');
  renderProjects();
}

// ── Delete dialog ─────────────────────────────────────────
function openDeleteDialog(projectId: string, name: string) {
  pendingDeleteId = projectId;
  document.getElementById('delete-message')!.textContent =
    `"${name}" will be permanently deleted and its window closed.`;
  document.getElementById('delete-dialog')!.style.display = 'flex';
}

document.getElementById('delete-dialog')!.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDialog('delete-dialog');
});
document.getElementById('delete-cancel')!.addEventListener('click', () => closeDialog('delete-dialog'));
document.getElementById('delete-confirm')!.addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  await send({ type: 'DELETE_PROJECT', projectId: pendingDeleteId });
  closeDialog('delete-dialog');
  await refresh();
});

// ── Assign dialog ─────────────────────────────────────────
document.getElementById('btn-assign')!.addEventListener('click', async () => {
  const name = await promptDialog('Project name');
  if (!name) return;
  const res = await send<Project>({ type: 'CREATE_PROJECT', name });
  if (!res.ok) return;
  // Associate this window (with its current tabs) to the new project
  await send({ type: 'ASSIGN_WINDOW', windowId: currentWindowId, projectId: res.data.id });
  await refresh();
});

document.getElementById('assign-dialog-close')!.addEventListener('click', () => closeDialog('assign-dialog'));
document.getElementById('assign-dialog')!.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDialog('assign-dialog');
});

// ── New project ───────────────────────────────────────────
document.getElementById('btn-new')!.addEventListener('click', async () => {
  const name = await promptDialog('Project name');
  if (!name) return;
  const res = await send<Project>({ type: 'CREATE_PROJECT', name });
  if (!res.ok) return;
  await send({ type: 'OPEN_PROJECT', projectId: res.data.id });
  await refresh();
});

// ── Export ────────────────────────────────────────────────
document.getElementById('btn-export')!.addEventListener('click', async () => {
  const res = await send<ProjectStore>({ type: 'EXPORT_PROJECTS' });
  if (!res.ok) return;
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chrome-projects-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── Import ────────────────────────────────────────────────
document.getElementById('btn-import')!.addEventListener('click', () => {
  (document.getElementById('import-input') as HTMLInputElement).click();
});

(document.getElementById('import-input') as HTMLInputElement).addEventListener('change', async e => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const store = JSON.parse(await file.text()) as Partial<ProjectStore>;
    await send({ type: 'IMPORT_PROJECTS', store });
    await refresh();
  } catch {
    await alertDialog('Invalid JSON file');
  }
  (e.target as HTMLInputElement).value = '';
});

// ── Util ──────────────────────────────────────────────────
function closeDialog(id: string) {
  document.getElementById(id)!.style.display = 'none';
}

async function refresh() {
  await loadAll();
  renderAll();
}

refresh().catch(console.error);

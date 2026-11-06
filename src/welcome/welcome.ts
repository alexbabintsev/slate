// Welcome page, opened once after a fresh install (see background/welcome.ts).
// It walks through the three things a new user needs: pin the icon, create a
// first project, and know how switching works. It runs entirely offline.

import { Check, Eye, Pin, Puzzle, type IconNode } from 'lucide';
import type { Message, MessageResponse } from '../models/messages';
import type { Project } from '../models/project';
import { t, localizeDocument } from '../i18n';
import { feedbackUrl } from '../feedback';
import { isEdge } from '../browser';

function icon(node: IconNode, size = 16): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries({
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  })) svg.setAttribute(k, String(v));
  for (const [tag, attrs] of node) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    svg.appendChild(el);
  }
  return svg;
}

function send<T>(msg: Message): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(msg);
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/* ---- step 1: pinned? ---- */

async function refreshPinned(): Promise<void> {
  try {
    const { isOnToolbar } = await chrome.action.getUserSettings();
    $('pin-status').hidden = !isOnToolbar;
    $('step-pin').classList.toggle('done', isOnToolbar);
  } catch {
    // getUserSettings is unavailable: leave the instructions without a status.
  }
}

function watchPinned(): void {
  void refreshPinned();
  // Chrome 130+ reports changes; older versions are polled while the page is visible.
  const changed = (chrome.action as unknown as { onUserSettingsChanged?: chrome.events.Event<() => void> } | undefined)?.onUserSettingsChanged;
  if (changed) {
    changed.addListener(() => void refreshPinned());
  } else {
    setInterval(() => { if (!document.hidden) void refreshPinned(); }, 1500);
  }
}

/* ---- step 2: first project ---- */

function setupCreate(): void {
  const form = $<HTMLFormElement>('create-form');
  const input = $<HTMLInputElement>('create-name');
  const button = form.querySelector('button')!;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    $('create-error').hidden = true;
    button.disabled = true;
    try {
      const res = await send<Project>({ type: 'CREATE_PROJECT', name });
      if (!res.ok) throw new Error(res.error);
      const opened = await send({ type: 'OPEN_PROJECT', projectId: res.data.id });
      if (!opened.ok) throw new Error(opened.error);
      $('create-status-text').textContent = t('welcomeCreated', res.data.name);
      $('create-status').hidden = false;
      $('step-create').classList.add('done');
      input.value = '';
    } catch {
      $('create-error').textContent = t('welcomeCreateFailed');
      $('create-error').hidden = false;
    } finally {
      button.disabled = false;
    }
  });
}

/* ---- extras ---- */

function setupManager(): void {
  $('open-manager').addEventListener('click', async () => {
    const win = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: win.id! });
  });
}

localizeDocument();
$<HTMLAnchorElement>('feedback-link').href = feedbackUrl();
$('demo-puzzle').appendChild(icon(Puzzle, 18));
// Edge shows or hides toolbar icons with an eye rather than a pin.
$('demo-pin').appendChild(icon(isEdge() ? Eye : Pin, 15));
if (isEdge()) $('pin-text').textContent = t('welcomePinTextEdge');
document.querySelectorAll('.status.ok .status-icon').forEach(el => el.appendChild(icon(Check, 16)));
watchPinned();
setupCreate();
setupManager();
$('create-name').focus();

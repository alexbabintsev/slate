import { describe, it, expect, beforeEach } from 'vitest';
import { openWelcomeOnInstall, WELCOME_PATH } from '../src/background/welcome';

let created: string[];
let installType: string;

beforeEach(() => {
  created = [];
  installType = 'normal';
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { getURL: (path: string) => `chrome-extension://slate/${path}` },
    tabs: { create: async ({ url }: { url: string }) => { created.push(url); return { id: 1 }; } },
    management: { getSelf: async () => ({ installType }) },
  };
});

const details = (reason: string) => ({ reason }) as chrome.runtime.InstalledDetails;

describe('welcome page', () => {
  it('opens once after a fresh install', async () => {
    await openWelcomeOnInstall(details('install'));
    expect(created).toEqual([`chrome-extension://slate/${WELCOME_PATH}`]);
  });

  it('stays closed when an administrator installed Slate by policy', async () => {
    installType = 'admin';
    await openWelcomeOnInstall(details('install'));
    expect(created).toEqual([]);
  });

  it('stays closed on updates and Chrome updates', async () => {
    for (const reason of ['update', 'chrome_update', 'shared_module_update']) {
      await openWelcomeOnInstall(details(reason));
    }
    expect(created).toEqual([]);
  });
});

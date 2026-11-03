import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installFakeChrome } from './fake-chrome-windows';
import { DEFAULT_SETTINGS } from '../src/models/project';

describe('message sender check', () => {
  let fake: ReturnType<typeof installFakeChrome>;

  beforeEach(async () => {
    fake = installFakeChrome();
    fake.setLocal('projectStore', { projects: {}, settings: DEFAULT_SETTINGS });
    vi.resetModules();
    await import('../src/background/service-worker');
  });

  it('accepts the extension\'s own pages', async () => {
    expect((await fake.sendMessage({ type: 'GET_ALL_PROJECTS' })).ok).toBe(true);
  });

  it('refuses an extension page framed inside a website', async () => {
    const res = await fake.sendMessage(
      { type: 'CLI_COMMAND', command: { action: 'list' } },
      { id: 'slate-test-id', url: 'chrome-extension://slate-test-id/src/cli/cli.html', tab: { id: 5 }, frameId: 3 },
    );
    expect(res).toEqual({ ok: false, error: 'Untrusted sender' });
  });

  it('refuses other extensions', async () => {
    const res = await fake.sendMessage({ type: 'GET_ALL_PROJECTS' }, { id: 'someone-else' });
    expect(res.ok).toBe(false);
  });
});

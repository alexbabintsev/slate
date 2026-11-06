import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installChromeStorageMock, type MockStorage } from './setup-chrome-mock';

const DAY = 24 * 60 * 60 * 1000;
let mock: MockStorage;
let rp: typeof import('../src/review-prompt');

beforeEach(async () => {
  mock = installChromeStorageMock();
  vi.resetModules();
  rp = await import('../src/review-prompt');
});

const install = (now: number) => rp.recordInstall({ reason: 'install' } as chrome.runtime.InstalledDetails, now);
const openTimes = async (n: number) => { for (let i = 0; i < n; i++) await rp.recordProjectOpen(); };

describe('review prompt', () => {
  it('waits for both a week of use and enough project opens', async () => {
    await install(0);
    await openTimes(rp.MIN_OPENS - 1);
    expect(await rp.takeReviewPrompt(30 * DAY)).toBe(false);

    await openTimes(1);
    expect(await rp.takeReviewPrompt(6 * DAY)).toBe(false);
    expect(await rp.takeReviewPrompt(7 * DAY)).toBe(true);
  });

  it('treats users from before this feature as long-time users', async () => {
    await rp.recordInstall({ reason: 'update' } as chrome.runtime.InstalledDetails, 100);
    await openTimes(rp.MIN_OPENS);
    expect(await rp.takeReviewPrompt(101)).toBe(true);
  });

  it('counts opens that arrive at the same time', async () => {
    await Promise.all(Array.from({ length: 5 }, () => rp.recordProjectOpen()));
    expect(mock.store.reviewOpens).toBe(5);
  });

  it('never asks again after the user leaves a review', async () => {
    await openTimes(rp.MIN_OPENS);
    expect(await rp.takeReviewPrompt(0)).toBe(true);
    await rp.finishReviewPrompt();
    expect(await rp.takeReviewPrompt(365 * DAY)).toBe(false);
  });

  it('"not now" waits a month, and the second one ends it', async () => {
    await openTimes(rp.MIN_OPENS);
    await rp.snoozeReviewPrompt(0);
    expect(await rp.takeReviewPrompt(29 * DAY)).toBe(false);
    expect(await rp.takeReviewPrompt(30 * DAY)).toBe(true);

    await rp.snoozeReviewPrompt(30 * DAY);
    expect(await rp.takeReviewPrompt(365 * DAY)).toBe(false);
  });

  it('ignoring the banner for a while counts as "not now"', async () => {
    await openTimes(rp.MIN_OPENS);
    for (let i = 0; i < rp.MAX_IMPRESSIONS; i++) expect(await rp.takeReviewPrompt(i)).toBe(true);
    expect(await rp.takeReviewPrompt(rp.MAX_IMPRESSIONS)).toBe(false);
    expect(await rp.takeReviewPrompt(rp.MAX_IMPRESSIONS + rp.SNOOZE)).toBe(true);
  });

  it('never asks people whose administrator installed Slate', async () => {
    (globalThis as unknown as { chrome: { management: unknown } }).chrome.management = {
      getSelf: async () => ({ installType: 'admin' }),
    };
    await openTimes(rp.MIN_OPENS);
    expect(await rp.takeReviewPrompt(365 * DAY)).toBe(false);
  });

  it('links to the Web Store reviews of the published extension', () => {
    expect(rp.reviewUrl(false)).toBe('https://chromewebstore.google.com/detail/keiaafjcddiababjlpgbfciohdebiggm/reviews');
  });

  it('does not ask in Edge until there is an Edge listing to send people to', async () => {
    expect(rp.EDGE_REVIEW_URL).toBeNull();
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0' });
    try {
      await openTimes(rp.MIN_OPENS);
      expect(await rp.takeReviewPrompt(365 * DAY)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

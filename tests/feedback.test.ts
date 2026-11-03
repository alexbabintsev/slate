import { describe, it, expect, afterEach } from 'vitest';
import { feedbackUrl, FEEDBACK_URL } from '../src/feedback';

afterEach(() => { delete (globalThis as { chrome?: unknown }).chrome; });

describe('feedback link', () => {
  it('opens the site form with the installed version', () => {
    (globalThis as unknown as { chrome: unknown }).chrome = { runtime: { getManifest: () => ({ version: '1.1.0' }) } };
    expect(feedbackUrl()).toBe('https://slate.babintsev.com/feedback?v=1.1.0');
  });

  it('still works where the manifest is unavailable', () => {
    expect(feedbackUrl()).toBe(FEEDBACK_URL);
  });
});

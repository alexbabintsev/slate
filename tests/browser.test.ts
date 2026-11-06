import { describe, it, expect } from 'vitest';
import { isEdge } from '../src/browser';

const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const EDGE_UA = `${CHROME_UA} Edg/131.0.0.0`;

describe('isEdge', () => {
  it('recognizes Edge by its client hints brand', () => {
    expect(isEdge({ userAgent: CHROME_UA, userAgentData: { brands: [{ brand: 'Microsoft Edge' }, { brand: 'Chromium' }] } })).toBe(true);
  });

  it('falls back to the Edg/ user agent token', () => {
    expect(isEdge({ userAgent: EDGE_UA })).toBe(true);
  });

  it('is false in Chrome', () => {
    expect(isEdge({ userAgent: CHROME_UA, userAgentData: { brands: [{ brand: 'Google Chrome' }, { brand: 'Chromium' }] } })).toBe(false);
  });
});

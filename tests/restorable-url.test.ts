import { describe, it, expect } from 'vitest';
import { isRestorableUrl } from '../src/background/restorable-url';

describe('isRestorableUrl', () => {
  it('accepts ordinary web URLs', () => {
    expect(isRestorableUrl('https://example.com/a', false)).toBe(true);
    expect(isRestorableUrl('http://localhost:3000', false)).toBe(true);
  });

  it('rejects chrome:// and other internal schemes', () => {
    expect(isRestorableUrl('chrome://newtab/', true)).toBe(false);
    expect(isRestorableUrl('chrome://extensions', true)).toBe(false);
    expect(isRestorableUrl('devtools://devtools/bundled/x.html', true)).toBe(false);
    expect(isRestorableUrl('about:blank', true)).toBe(false);
  });

  it('rejects file:// when the extension lacks local file access', () => {
    // The reported bug: a saved .pdf tab made chrome.windows.create reject and
    // the project window never opened at all.
    expect(isRestorableUrl('file:///Users/me/doc.pdf', false)).toBe(false);
  });

  it('accepts file:// once local file access is granted', () => {
    expect(isRestorableUrl('file:///Users/me/doc.pdf', true)).toBe(true);
  });

  it('rejects malformed URLs rather than throwing', () => {
    expect(isRestorableUrl('', true)).toBe(false);
    expect(isRestorableUrl('not a url', true)).toBe(false);
  });
});

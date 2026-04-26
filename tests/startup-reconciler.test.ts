import { describe, it, expect } from 'vitest';
import { normalizeUrl, scoreMatch } from '../src/background/startup-reconciler';
import type { Project } from '../src/models/project';

function makeProject(urls: string[]): Project {
  return {
    id: 'p',
    name: 'P',
    icon: '',
    tabs: urls.map((url, index) => ({ url, title: '', pinned: false, index })),
    tabGroups: [],
    activeTabIndex: 0,
    createdAt: 0,
    updatedAt: 0,
    sortOrder: 0,
  };
}

function makeTabs(urls: string[]): chrome.tabs.Tab[] {
  return urls.map((url, index) => ({ url, index }) as chrome.tabs.Tab);
}

describe('normalizeUrl', () => {
  it('strips scheme', () => {
    expect(normalizeUrl('https://example.com/a')).toBe('example.com/a');
    expect(normalizeUrl('http://example.com/a')).toBe('example.com/a');
  });

  it('strips query string', () => {
    expect(normalizeUrl('https://example.com/a?x=1&y=2')).toBe('example.com/a');
  });

  it('keeps path and fragment', () => {
    expect(normalizeUrl('https://example.com/a/b#frag')).toBe('example.com/a/b#frag');
  });

  it('treats different schemes as same after normalize', () => {
    expect(normalizeUrl('https://x.com/p')).toBe(normalizeUrl('http://x.com/p'));
  });

  it('treats query-only difference as identical', () => {
    expect(normalizeUrl('https://x.com/p?a=1')).toBe(normalizeUrl('https://x.com/p?b=2'));
  });

  it('returns input unchanged when no scheme', () => {
    expect(normalizeUrl('about:blank')).toBe('about:blank');
    expect(normalizeUrl('foo')).toBe('foo');
  });
});

describe('scoreMatch', () => {
  it('returns 0 when project has no tabs', () => {
    expect(scoreMatch(makeTabs(['https://a.com']), makeProject([]))).toBe(0);
  });

  it('returns 0 when both empty', () => {
    expect(scoreMatch([], makeProject([]))).toBe(0);
  });

  it('returns 1.0 for perfect match', () => {
    const tabs = makeTabs(['https://a.com', 'https://b.com']);
    const project = makeProject(['https://a.com', 'https://b.com']);
    expect(scoreMatch(tabs, project)).toBe(1);
  });

  it('matches across http/https difference', () => {
    const tabs = makeTabs(['http://a.com']);
    const project = makeProject(['https://a.com']);
    expect(scoreMatch(tabs, project)).toBe(1);
  });

  it('matches across query string difference', () => {
    const tabs = makeTabs(['https://a.com/p?x=1']);
    const project = makeProject(['https://a.com/p?x=2']);
    expect(scoreMatch(tabs, project)).toBe(1);
  });

  it('returns partial score for partial overlap', () => {
    const tabs = makeTabs(['https://a.com', 'https://b.com', 'https://c.com']);
    const project = makeProject(['https://a.com', 'https://b.com']);
    // 2 matches out of max(3, 2) = 3
    expect(scoreMatch(tabs, project)).toBeCloseTo(2 / 3);
  });

  it('handles tabs with missing url', () => {
    const tabs = [{ index: 0 } as chrome.tabs.Tab, { url: 'https://a.com', index: 1 } as chrome.tabs.Tab];
    const project = makeProject(['https://a.com']);
    // 1 match out of max(2, 1) = 2
    expect(scoreMatch(tabs, project)).toBe(0.5);
  });

  it('crosses 0.6 threshold for 2/3 match', () => {
    const tabs = makeTabs(['https://a.com', 'https://b.com', 'https://c.com']);
    const project = makeProject(['https://a.com', 'https://b.com']);
    expect(scoreMatch(tabs, project)).toBeGreaterThanOrEqual(0.6);
  });

  it('does not cross 0.6 threshold for 1/3 match', () => {
    const tabs = makeTabs(['https://a.com', 'https://b.com', 'https://c.com']);
    const project = makeProject(['https://a.com']);
    expect(scoreMatch(tabs, project)).toBeLessThan(0.6);
  });
});

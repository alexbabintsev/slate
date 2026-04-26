import { describe, it, expect } from 'vitest';
import { sanitizeImportedStore, sanitizeProject } from '../src/background/import-sanitizer';

const minimalProject = {
  id: 'p1',
  name: 'Work',
  icon: '',
  tabs: [],
  tabGroups: [],
  activeTabIndex: 0,
  createdAt: 1000,
  updatedAt: 2000,
  sortOrder: 1,
};

describe('sanitizeProject', () => {
  it('accepts a fully-formed project', () => {
    const p = sanitizeProject(minimalProject);
    expect(p).not.toBeNull();
    expect(p!.id).toBe('p1');
    expect(p!.name).toBe('Work');
    expect(p!.tabs).toEqual([]);
  });

  it('rejects non-objects', () => {
    expect(sanitizeProject(null)).toBeNull();
    expect(sanitizeProject(undefined)).toBeNull();
    expect(sanitizeProject('foo')).toBeNull();
    expect(sanitizeProject(42)).toBeNull();
    expect(sanitizeProject([])).toBeNull();
  });

  it('rejects missing id', () => {
    expect(sanitizeProject({ ...minimalProject, id: '' })).toBeNull();
    expect(sanitizeProject({ ...minimalProject, id: 123 })).toBeNull();
    const { id: _id, ...noId } = minimalProject;
    expect(sanitizeProject(noId)).toBeNull();
  });

  it('rejects missing name', () => {
    expect(sanitizeProject({ ...minimalProject, name: '' })).toBeNull();
    expect(sanitizeProject({ ...minimalProject, name: null })).toBeNull();
  });

  it('drops invalid tabs but keeps valid ones', () => {
    const p = sanitizeProject({
      ...minimalProject,
      tabs: [
        { url: 'https://a.com', title: 'A', pinned: false, index: 0 },
        { url: '', title: 'B', pinned: false, index: 1 },     // invalid: empty url
        null,                                                   // invalid: not object
        { title: 'C', pinned: false, index: 2 },               // invalid: missing url
        'string',                                               // invalid
        { url: 'https://d.com' },                               // valid: only url required
      ],
    });
    expect(p!.tabs.length).toBe(2);
    expect(p!.tabs[0].url).toBe('https://a.com');
    expect(p!.tabs[1].url).toBe('https://d.com');
  });

  it('coerces tab field types with sane defaults', () => {
    const p = sanitizeProject({
      ...minimalProject,
      tabs: [{ url: 'https://x.com', title: 42, pinned: 'yes', index: 'zero' }],
    });
    expect(p!.tabs[0]).toEqual({
      url: 'https://x.com',
      title: '',
      pinned: true,
      index: 0,
      faviconUrl: undefined,
      groupId: undefined,
    });
  });

  it('drops invalid tab groups', () => {
    const p = sanitizeProject({
      ...minimalProject,
      tabGroups: [
        { id: 1, title: 'G1', color: 'blue', collapsed: false },
        { id: 'not-number', title: 'G2', color: 'red', collapsed: false }, // invalid id type
        null,
        { title: 'G3' },                                                    // missing id
      ],
    });
    expect(p!.tabGroups.length).toBe(1);
    expect(p!.tabGroups[0].id).toBe(1);
  });

  it('falls back invalid color to grey', () => {
    const p = sanitizeProject({
      ...minimalProject,
      tabGroups: [{ id: 1, title: '', color: 'taupe', collapsed: false }],
    });
    expect(p!.tabGroups[0].color).toBe('grey');
  });

  it('handles non-array tabs and tabGroups', () => {
    const p = sanitizeProject({ ...minimalProject, tabs: 'not-array', tabGroups: 42 });
    expect(p!.tabs).toEqual([]);
    expect(p!.tabGroups).toEqual([]);
  });

  it('preserves optional color when present', () => {
    const p = sanitizeProject({ ...minimalProject, color: '#abcdef' });
    expect(p!.color).toBe('#abcdef');
  });

  it('omits color when not a string', () => {
    const p = sanitizeProject({ ...minimalProject, color: 123 });
    expect(p!.color).toBeUndefined();
  });

  it('fills sane numeric defaults when fields missing', () => {
    const { activeTabIndex, createdAt, updatedAt, sortOrder, ...rest } = minimalProject;
    const before = Date.now();
    const p = sanitizeProject(rest);
    const after = Date.now();
    expect(p!.activeTabIndex).toBe(0);
    expect(p!.createdAt).toBeGreaterThanOrEqual(before);
    expect(p!.createdAt).toBeLessThanOrEqual(after);
    expect(p!.updatedAt).toBeGreaterThanOrEqual(before);
    expect(p!.sortOrder).toBeGreaterThanOrEqual(before);
  });
});

describe('sanitizeImportedStore', () => {
  it('returns null for non-object input', () => {
    expect(sanitizeImportedStore(undefined)).toBeNull();
    expect(sanitizeImportedStore(null as never)).toBeNull();
    expect(sanitizeImportedStore('foo' as never)).toBeNull();
  });

  it('returns null when projects key is missing or not an object', () => {
    expect(sanitizeImportedStore({} as never)).toBeNull();
    expect(sanitizeImportedStore({ projects: 'oops' } as never)).toBeNull();
    expect(sanitizeImportedStore({ projects: [] } as never)).toBeNull();
  });

  it('returns empty object for empty projects map', () => {
    const result = sanitizeImportedStore({ projects: {} });
    expect(result).toEqual({});
  });

  it('keeps valid projects, drops invalid', () => {
    const result = sanitizeImportedStore({
      projects: {
        p1: minimalProject,
        p2: { id: 'p2', name: 'Other', tabs: [], tabGroups: [], icon: '', activeTabIndex: 0, createdAt: 0, updatedAt: 0, sortOrder: 0 },
        bad: null as never,
        also_bad: { id: 'also_bad' } as never, // missing name
      },
    } as never);
    expect(Object.keys(result!).sort()).toEqual(['p1', 'p2']);
  });

  it('drops projects whose key does not match their id', () => {
    const result = sanitizeImportedStore({
      projects: {
        wrong_key: { ...minimalProject, id: 'p1' },
      },
    } as never);
    expect(result).toEqual({});
  });

  it('does not crash on prototype-pollution attempts', () => {
    const malicious = JSON.parse('{"projects":{"__proto__":{"polluted":true}}}');
    const result = sanitizeImportedStore(malicious);
    expect(result).not.toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

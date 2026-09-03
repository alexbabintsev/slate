import { describe, it, expect } from 'vitest';
import { normalizeGroups } from '../src/background/tab-sync';
import type { TabState, TabGroupState } from '../src/models/project';

function tab(url: string, groupId?: number): TabState {
  return { url, title: url, pinned: false, index: 0, groupId };
}

function group(id: number, title: string): TabGroupState {
  return { id, title, color: 'blue', collapsed: false };
}

describe('normalizeGroups', () => {
  it('renumbers chrome volatile group ids to dense indices', () => {
    const tabs = [tab('a', 831), tab('b', 831), tab('c', 947)];
    const groups = [group(831, 'BLE'), group(947, 'MLL')];

    const result = normalizeGroups(tabs, groups);

    expect(result.tabGroups.map(g => [g.id, g.title])).toEqual([[0, 'BLE'], [1, 'MLL']]);
    expect(result.tabs.map(t => t.groupId)).toEqual([0, 0, 1]);
  });

  it('produces identical output across restores with different chrome ids', () => {
    // Same logical window, saved twice - chrome hands out fresh ids each restore.
    const first = normalizeGroups(
      [tab('a', 12), tab('b', 13)],
      [group(12, 'BLE'), group(13, 'MLL')],
    );
    const second = normalizeGroups(
      [tab('a', 4001), tab('b', 4002)],
      [group(4001, 'BLE'), group(4002, 'MLL')],
    );

    expect(second).toEqual(first);
  });

  it('keeps a group even when the cached tabs do not reference it yet', () => {
    // Chrome fires no tabs.onUpdated when a tab's groupId changes, so a save
    // can see tabs that still look ungrouped. The group must survive: dropping
    // it here is what silently wiped groups on close.
    const tabs = [tab('a'), tab('b')];
    const groups = [group(777, 'Shop')];

    const result = normalizeGroups(tabs, groups);

    expect(result.tabGroups).toEqual([group(0, 'Shop')]);
  });

  it('does not duplicate groups across repeated saves', () => {
    // The 1.0.1 regression: each open appended a fresh set of groups. Ids are
    // renumbered densely, so saving the same window twice is idempotent.
    const once = normalizeGroups([tab('a', 900), tab('b', 901)], [group(900, 'BLE'), group(901, 'MLL')]);
    const twice = normalizeGroups(once.tabs, once.tabGroups);

    expect(twice).toEqual(once);
    expect(twice.tabGroups).toHaveLength(2);
  });

  it('clears groupId on tabs whose group is gone', () => {
    const result = normalizeGroups([tab('a', 55)], []);
    expect(result.tabs[0].groupId).toBeUndefined();
    expect(result.tabGroups).toEqual([]);
  });

  it('leaves ungrouped tabs untouched', () => {
    const result = normalizeGroups([tab('a'), tab('b', 7)], [group(7, 'X')]);
    expect(result.tabs.map(t => t.groupId)).toEqual([undefined, 0]);
  });
});

# Changelog

## [1.0.2] - 2026-09-03

### Fixed
- Tab groups were lost every time a project window was closed, so reopening the
  project restored none. Chrome tears a window down by removing its tab groups
  *before* its tabs, so `tabGroups.onRemoved` arrives while the window is not yet
  marked as closing. The handler read that as the user ungrouping and evicted the
  group from the cache moments before the close-time save read it, persisting
  `tabGroups: []` over a project that had them. The handler now asks Chrome whether
  the window is still alive instead of trusting its own flag, and `persist` refuses
  to record an empty group list while the tabs still reference groups.
- Tab groups were also dropped at save time by a 1.0.1 regression: `normalizeGroups`
  discarded every group no saved tab referenced, and Chrome fires no
  `tabs.onUpdated` when a tab's `groupId` changes, so the tabs a save read still
  looked ungrouped. Groups the window reports are now kept regardless; duplicate
  groups stay fixed through the window-scoped cache and eviction on removal.
- Opening a project no longer scatters its tabs across two windows.
  `chrome.tabs.group` was called without a target window, so Chrome resolved the
  group into whichever window was focused and dragged those tabs along.
- Group restore no longer relies on the tab list `chrome.windows.create` returns,
  which can come back short or out of order; saved tabs are bound to concrete tab
  ids from a fresh query before pinning reorders the window.

## [1.0.1] - 2026-08-26

### Fixed
- Projects containing a saved `file://` tab (e.g. a local PDF) now open. Previously a
  single such tab made `chrome.windows.create` reject and the window never opened at
  all. File tabs are restored when the extension has "Allow access to file URLs"
  enabled, and skipped otherwise.
- Tab groups could be saved twice over, accumulating duplicates in projects that use
  them. Chrome reuses window ids and assigns fresh group ids on every restore, and the
  cached groups of a previous window could survive into the next one and be persisted
  alongside the current groups. Group ids are now normalized to stable indices, groups
  that no live tab references are dropped, and the cache is scoped to the live window.
  Affected projects repair themselves on their next save.
- Deleting a project no longer closes its window. The window is unlinked from the project and stays open.
- Toolbar badge is cleared immediately when a project is deleted while its window is open.
- Delete confirmation dialog text updated to reflect the new behavior.

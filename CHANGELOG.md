# Changelog

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

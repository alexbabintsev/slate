# Changelog

## [Unreleased]

### Changed
- Storage moved to one record per project (schema 2). Projects used to share a
  single storage key, so every tab change rewrote all projects, uploaded icons
  included; now autosave writes only the project that changed. Existing data is
  migrated on first start: the old copy is removed only after every project is
  confirmed in its new place, and an interrupted migration resumes safely.
- Deleted projects leave a small tombstone, and every write records its time and
  a random id of the installation. Nothing uses these yet; they are groundwork
  for syncing projects between devices.

## [1.0.3] - 2026-11-03

### Fixed
- Project windows that Chrome reopens on its own are recognized again. The
  window-to-project links live in session storage and are cleared on every
  restart, and they were rebuilt only once, at browser startup. After a crash
  Chrome restores windows only when you click **Restore** - after that point - so
  they showed "no project" and opening the project made a duplicate window. Slate
  now matches windows as they appear, and opening a project adopts an already
  open window with its tabs instead of creating a second one.
- Renaming, recoloring or changing the icon of a project in the side panel no
  longer rolls back its tabs. The panel used to send its own, possibly hours-old,
  copy of the whole project, overwriting tabs saved since - for good if the window
  was closed. Only the edited fields are sent now, and the panel refreshes itself
  when projects change.
- Saves no longer overwrite each other. Reordering, importing, creating and
  autosaving read the store outside the write queue, so a write landing in between
  could be lost and a project deleted meanwhile could come back.
- The active tab is kept after Chrome suspends the extension's background worker,
  instead of resetting to the first tab, and lands on the right tab when some tabs
  cannot be restored or pinned tabs move to the front.
- Opening a project twice at once (double click, popup and CLI together) opens one
  window, and a stale link to a closed window no longer blocks opening a project.
- The CLI finds projects whose names contain `#`, `+`, `%`, `?`, `/` or non-Latin
  letters.

### Security
- Websites can no longer control Slate. The CLI page was exposed to all sites,
  which let any page open or close your projects by name. It is no longer
  web-accessible, and the extension accepts messages only from its own pages.
- Imported files are validated: only `http`, `https` and `file` tab URLs are
  accepted, icons, colors and favicons are checked, and sizes are capped. Tabs are
  reopened only with `http`/`https` (and `file` when allowed).

### Changed
- Import reports how many projects were imported and how many with the same id
  were replaced, and shows an error instead of failing silently.
- New `unlimitedStorage` permission, so projects with uploaded icons cannot hit the
  10 MB storage cap and make saving fail. It shows no warning on install and data
  still stays on your device.
- Autosave reads less: no full storage read per tab event, and the tab cache is
  refreshed only for changes a save records.

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

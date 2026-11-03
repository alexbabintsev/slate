# Slate

Organize your work as projects in Chrome - each project gets its own window with its own saved tabs and tab groups. Switch contexts instantly. Never lose your place.

## Features

- **Project = window.** Each project owns a Chrome window. Its tabs are auto-saved as you work, and reopening the project restores them.
- **Tab groups preserved.** Group titles, colors, and collapsed state are saved with the project.
- **Pinned tabs preserved.** Pinned state is restored on reopen.
- **Active tab restored.** The tab that was active when you last closed the window is reactivated.
- **Survives restarts and crashes.** When Chrome reopens windows itself - on restart, or after a crash once you click **Restore** - Slate recognizes each project's window by its tabs and reattaches it instead of opening a duplicate.
- **Toolbar badge** shows the current project's initials in its color, per window.
- **Side panel manager** for renaming, reordering (drag & drop), changing icons/colors, and deleting projects. Deleting a project unlinks its window without closing it.
- **Icon picker** with 335 curated Lucide icons + image upload (PNG/JPG/SVG/WebP up to 512 KB).
- **Import / export** all projects as JSON. Imported files are validated: only `http`, `https` and `file` tab URLs are accepted, and projects with the same id replace existing ones.
- **Optional CLI** to open/close projects from your shell.
- **100% local.** No accounts, no servers, no telemetry. See [PRIVACY.md](PRIVACY.md).

## Install

### From the Chrome Web Store

[Slate - Window per Project](https://chromewebstore.google.com/detail/slate-window-per-project/keiaafjcddiababjlpgbfciohdebiggm)

### From source (development)

Requires Node.js 20 or newer (CI uses 22).

```bash
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this directory

The built bundles are not committed, so run `npm run build` again after pulling changes.

## Usage

- **Create a project** - click the toolbar icon → **New Project**, or in the side panel.
- **Switch projects** - click the toolbar icon and pick a project from the list. Its window is opened or focused.
- **Assign an existing window** - open the popup in a window with no project assigned, click **Create project from this window**.
- **Rename, recolor, change icon** - in the side panel. Edits touch only those fields, never the saved tabs.
- **Manage projects** - click the gear icon in the popup to open the side panel.
- **Reorder** - drag projects in the side panel.
- **Import/export** - buttons in the side panel header.

## CLI (optional)

A small bash wrapper lets you control Slate from the command line:

```bash
slate open "Work"
slate close "Work"
slate list
```

The wrapper opens an extension page with `chrome --new-window`; it needs `SLATE_EXT_ID` set to the extension id (`keiaafjcddiababjlpgbfciohdebiggm` for the Web Store build). Project names may contain any characters. See [cli/README.md](cli/README.md) for setup.

## Build

```bash
npm install              # install esbuild, vitest + types
npm run build            # one-shot build
npm run watch            # rebuild on change
npm run typecheck        # strict TS check, no emit
npm test                 # vitest suite (chrome APIs are faked)
npm run package          # build + Web Store zip in dist-package/
```

Output (generated, git-ignored):
- `dist/service-worker.js` - background service worker
- `src/popup/popup.js` - popup bundle
- `src/manager/manager.js` - side-panel manager bundle
- `assets/lucide-icons.json` - curated icon subset

## Release

```bash
npm version patch        # bumps package.json and syncs manifest.json
git push --follow-tags
```

Pushing a `v*` tag runs the release workflow: it checks the tag matches `manifest.json`, typechecks, tests, packages the zip and attaches it to a GitHub release. Upload that zip to the Chrome Web Store.

## Project layout

```
manifest.json              MV3 manifest
src/
  background/              service worker, tab sync, window tracking, startup reconciler
  popup/                   toolbar popup
  manager/                 side-panel project manager (icon picker, drag reorder, import/export)
  cli/                     hidden cli.html shim invoked by the bash wrapper
  models/                  shared types
  storage/                 chrome.storage.local adapter (serialized, atomic updates)
assets/                    icons + Lucide JSON
cli/slate                  optional bash CLI wrapper
scripts/                   packaging and version sync
tests/                     vitest suite with a fake chrome API
```

## Permissions

Slate requests only what it needs:

- `tabs`, `tabGroups` - read URLs/titles/group state to save and restore project tab sets
- `storage` - store projects in `chrome.storage.local`
- `sidePanel` - show the project manager in Chrome's side panel
- `unlimitedStorage` - lift the 10 MB `chrome.storage.local` cap so uploaded icons can't fill it and break saving

No host permissions, no content scripts, no web-accessible resources, no network access. The service worker accepts messages only from Slate's own top-level pages. See [PRIVACY.md](PRIVACY.md).

## Requirements

Chrome 119 or newer (per-window action APIs).

## License

MIT - see [LICENSE](LICENSE).

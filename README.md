# Slate

Organize your work as projects in Chrome - each project gets its own window with its own saved tabs and tab groups. Switch contexts instantly. Never lose your place.

## Features

- **Project = window.** Each project owns a Chrome window. Closing the window saves the tab set; reopening the project restores it.
- **Tab groups preserved.** Group titles, colors, and collapsed state are saved with the project.
- **Pinned tabs preserved.** Pinned state is restored on reopen.
- **Active tab restored.** The tab that was active when you last closed the window is reactivated.
- **Toolbar badge** shows the current project's initials in its color, per window.
- **Side panel manager** for renaming, reordering (drag & drop), changing icons/colors, and deleting projects.
- **Icon picker** with 1900+ Lucide icons + image upload (PNG/JPG/SVG/WebP up to 512 KB).
- **Import / export** all projects as JSON.
- **Optional CLI** to open/close projects from your shell.
- **100% local.** No accounts, no servers, no telemetry. See [PRIVACY.md](PRIVACY.md).

## Install

### From the Chrome Web Store

*(Pending publication.)*

### From source (development)

Requires Node.js 18+.

```bash
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this directory

## Usage

- **Create a project** - click the toolbar icon → **New Project**, or in the side panel.
- **Switch projects** - click the toolbar icon and pick a project from the list. Its window is opened or focused.
- **Assign an existing window** - open the popup in a window with no project assigned, click **Create project from this window**.
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

See [cli/README.md](cli/README.md) for setup.

## Build

```bash
npm install              # install esbuild + types
npm run build            # one-shot build
npm run watch            # rebuild on change
npm run typecheck        # strict TS check, no emit
```

Output:
- `dist/service-worker.js` - background service worker
- `src/popup/popup.js` - popup bundle
- `src/manager/manager.js` - side-panel manager bundle

## Project layout

```
manifest.json              MV3 manifest
src/
  background/              service worker, tab sync, window tracking, startup reconciler
  popup/                   toolbar popup
  manager/                 side-panel project manager (icon picker, drag reorder, import/export)
  cli/                     hidden cli.html shim invoked by the bash wrapper
  models/                  shared types
  storage/                 chrome.storage.local adapter
assets/                    icons + Lucide JSON
cli/slate                  optional bash CLI wrapper
```

## Permissions

Slate requests only what it needs:

- `tabs`, `tabGroups` - read URLs/titles/group state to save and restore project tab sets
- `storage` - store projects in `chrome.storage.local`
- `sidePanel` - show the project manager in Chrome's side panel

No host permissions, no content scripts, no network access. See [PRIVACY.md](PRIVACY.md).

## Requirements

Chrome 119 or newer (per-window action APIs).

## License

MIT - see [LICENSE](LICENSE).

# Privacy Policy for Slate

**Effective date:** April 26, 2026
**Author:** Alex Babintsev

Slate is a browser extension that helps you organize Chrome windows into named projects with saved tab sets. This document explains exactly what data Slate handles, where it lives, and what it never does.

## Summary

- Slate stores everything **locally on your device** using `chrome.storage.local`.
- Slate **does not** send any data to the author, to any server, or to any third party.
- Slate **does not** collect analytics, telemetry, crash reports, or usage metrics.
- Slate **does not** require an account, login, or network connection.
- Slate **does not** read or modify the contents of webpages.
- Slate **does not** sell, share, or transfer your data to anyone.

## What Slate stores

To restore your project windows, Slate saves the following on your device:

- **Project metadata** - name, icon (Lucide name or your uploaded image as a base64 data URL), color, sort order, timestamps.
- **Tab metadata for each project** - URL, title, favicon URL, pinned state, position, group membership.
- **Tab group metadata** - title, color, collapsed state.
- **Window-to-project associations** - kept in `chrome.storage.session`, cleared when Chrome restarts.

This data is stored only inside Chrome's extension storage on your computer. It is never uploaded.

## What Slate does NOT store or access

- Page contents, form data, passwords, or cookies on any website.
- Browsing history outside of currently open project windows.
- Personally identifying information (name, email, IP address, location, etc.).
- Anything from non-project Chrome windows.

## Permissions Slate requests, and why

| Permission | Why it's needed |
|---|---|
| `tabs` | Read URLs, titles, pinned state, and active state of tabs in project windows so they can be saved and restored. |
| `tabGroups` | Read and recreate Chrome tab groups (title, color, collapsed state) when restoring a project window. |
| `storage` | Persist projects to `chrome.storage.local` on your device. |
| `sidePanel` | Show the project manager UI in Chrome's side panel. |

Slate does not request any host permissions and does not run content scripts on any web page.

## Network requests

Slate makes **zero outbound network requests**. The only `fetch()` call in the codebase loads a bundled local JSON file (`assets/lucide-icons.json`) via `chrome.runtime.getURL` - this is a local file inside the extension package, not a remote request.

## Data export and deletion

- **Export.** Use the **Export** button in the side panel to download all your projects as a JSON file.
- **Delete a project.** Click the trash icon on a project card.
- **Delete everything.** Uninstall the extension. Chrome automatically removes all `chrome.storage.local` data belonging to it.

## Optional CLI

Slate ships with an optional shell wrapper (`cli/slate`) that opens an extension page via `chrome --new-window 'chrome-extension://.../cli/cli.html?action=...'`. This runs entirely on your machine. The CLI does not send data anywhere; it is simply another way to invoke the same in-extension messages that the popup uses.

## Children's privacy

Slate does not knowingly collect any data from anyone, including children under 13.

## Changes to this policy

If this policy changes, the new version will be published in this repository with a new effective date. Material changes will also be noted in the extension's release notes.

## Contact

For questions about this policy, file an issue in the project repository or contact the author at alexbabintsev@gmail.com.

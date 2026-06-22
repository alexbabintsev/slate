# Slate CLI

Optional shell wrapper to control the Slate Chrome extension from the command line.

## Install

1. Open `chrome://extensions`, enable **Developer mode**, copy your Slate extension ID.
2. Set it in your shell rc:
   ```bash
   export SLATE_EXT_ID="abcdefghijklmnopqrstuvwxyzabcdef"
   ```
3. Symlink `slate` onto your `PATH`:
   ```bash
   ln -s "$(pwd)/cli/slate" /usr/local/bin/slate
   ```

## Usage

```bash
slate open "Work"      # open or focus the "Work" project window
slate close "Work"     # close the project window
slate list             # list all projects (opens a Chrome tab with JSON output)
```

## How it works

The wrapper invokes `chrome --new-window 'chrome-extension://<ID>/src/cli/cli.html?action=...'`.
The extension page sends a message to the background service worker, performs the action,
then closes itself. No native messaging host required.

## Supported platforms

macOS and Linux (Bash). Tested with Google Chrome and Chromium.

const UNRESTORABLE_SCHEMES = ['chrome:', 'chrome-untrusted:', 'devtools:', 'about:', 'edge:'];

// chrome.windows.create rejects the entire call if any URL cannot be navigated
// to, so a project holding a single such tab would otherwise never open.
export function isRestorableUrl(url: string, fileAccess: boolean): boolean {
  let scheme: string;
  try {
    scheme = new URL(url).protocol;
  } catch {
    return false;
  }
  if (UNRESTORABLE_SCHEMES.includes(scheme)) return false;
  // file:// only works when the user granted the extension local file access
  if (scheme === 'file:') return fileAccess;
  return true;
}

export async function hasFileAccess(): Promise<boolean> {
  try {
    return await chrome.extension.isAllowedFileSchemeAccess();
  } catch {
    return false;
  }
}

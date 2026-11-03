// Schemes a saved tab may be reopened with. An allowlist rather than a denylist:
// a project can arrive from an imported file, and reopening data:, javascript:,
// blob: or another extension's pages from it would hand that file a way to put
// arbitrary content in front of the user.
const RESTORABLE_SCHEMES = new Set(['http:', 'https:']);

function schemeOf(url: string): string | null {
  try {
    return new URL(url).protocol;
  } catch {
    return null;
  }
}

/** Schemes accepted when importing a project file. */
export function isImportableUrl(url: string): boolean {
  const scheme = schemeOf(url);
  return scheme !== null && (RESTORABLE_SCHEMES.has(scheme) || scheme === 'file:');
}

// chrome.windows.create rejects the entire call if any URL cannot be navigated
// to, so a project holding a single such tab would otherwise never open.
export function isRestorableUrl(url: string, fileAccess: boolean): boolean {
  const scheme = schemeOf(url);
  if (scheme === null) return false;
  // file:// only works when the user granted the extension local file access
  if (scheme === 'file:') return fileAccess;
  return RESTORABLE_SCHEMES.has(scheme);
}

export async function hasFileAccess(): Promise<boolean> {
  try {
    return await chrome.extension.isAllowedFileSchemeAccess();
  } catch {
    return false;
  }
}

/**
 * Whether an administrator installed Slate through enterprise policy (Google
 * Workspace, managed ChromeOS). Those people did not choose Slate, so it should
 * not greet them or ask them for a review. getSelf needs no permission.
 */
export async function isAdminInstall(): Promise<boolean> {
  try {
    const self = await chrome.management.getSelf();
    return self.installType === 'admin';
  } catch {
    return false;
  }
}

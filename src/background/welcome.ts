import { isAdminInstall } from '../install-type';

export const WELCOME_PATH = 'src/welcome/welcome.html';

/**
 * Open the welcome page after a fresh install - never on updates, Chrome
 * updates or reloads of the unpacked extension, where it would only get in the
 * way, and never when an administrator pushed Slate to a managed device.
 */
export async function openWelcomeOnInstall(details: chrome.runtime.InstalledDetails): Promise<void> {
  if (details.reason !== 'install') return;
  if (await isAdminInstall()) return;
  await chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_PATH) });
}

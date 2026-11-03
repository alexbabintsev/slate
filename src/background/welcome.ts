export const WELCOME_PATH = 'src/welcome/welcome.html';

/**
 * Open the welcome page after a fresh install - never on updates, Chrome
 * updates or reloads of the unpacked extension, where it would only get in the way.
 */
export async function openWelcomeOnInstall(details: chrome.runtime.InstalledDetails): Promise<void> {
  if (details.reason !== 'install') return;
  await chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_PATH) });
}

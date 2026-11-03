export const UNINSTALL_SURVEY_URL = 'https://slate.babintsev.com/uninstall';

/**
 * Ask Chrome to open the uninstall survey when Slate is removed. Only the
 * version goes along, so answers can be matched to a release; nothing about
 * the person. Chrome keeps the URL, so setting it once per install or update
 * is enough.
 */
export async function registerUninstallSurvey(): Promise<void> {
  const version = chrome.runtime.getManifest().version;
  await chrome.runtime.setUninstallURL(`${UNINSTALL_SURVEY_URL}?v=${encodeURIComponent(version)}`);
}

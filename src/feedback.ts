export const FEEDBACK_URL = 'https://slate.babintsev.com/feedback';

/** The site's feedback form, with the installed version so a report says which release it is about. */
export function feedbackUrl(): string {
  const version = globalThis.chrome?.runtime?.getManifest?.().version;
  return version ? `${FEEDBACK_URL}?v=${encodeURIComponent(version)}` : FEEDBACK_URL;
}

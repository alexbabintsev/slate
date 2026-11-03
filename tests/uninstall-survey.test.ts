import { describe, it, expect } from 'vitest';
import { registerUninstallSurvey, UNINSTALL_SURVEY_URL } from '../src/background/uninstall-survey';

describe('uninstall survey', () => {
  it('points Chrome at the survey with only the version attached', async () => {
    let url = '';
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        getManifest: () => ({ version: '1.1.0' }),
        setUninstallURL: async (u: string) => { url = u; },
      },
    };

    await registerUninstallSurvey();

    expect(url).toBe(`${UNINSTALL_SURVEY_URL}?v=1.1.0`);
    expect(UNINSTALL_SURVEY_URL).toBe('https://slate.babintsev.com/uninstall');
  });
});

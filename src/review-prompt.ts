// A one-line "leave a review" nudge in the popup, shown only to people who
// clearly use Slate, and at most a couple of times. Everything it counts stays
// in chrome.storage.local; nothing is sent anywhere.
//
//   - the service worker counts project opens (recordProjectOpen)
//   - the popup asks shouldShowReviewPrompt() and reports what the user did
//
// Separate keys, so the service worker's counter and the popup's state never
// overwrite each other.

export const REVIEW_URL = 'https://chromewebstore.google.com/detail/keiaafjcddiababjlpgbfciohdebiggm/reviews';

const DAY = 24 * 60 * 60 * 1000;
export const MIN_OPENS = 15;
export const MIN_AGE = 7 * DAY;
export const SNOOZE = 30 * DAY;
/** Snoozes before we stop asking for good. */
export const MAX_SNOOZES = 2;
/** Popup openings with the banner ignored that count as one "not now". */
export const MAX_IMPRESSIONS = 5;

const INSTALLED_KEY = 'reviewInstalledAt';
const OPENS_KEY = 'reviewOpens';
const STATE_KEY = 'reviewState';

export type ReviewState = {
  done: boolean;
  snoozes: number;
  snoozedUntil: number;
  impressions: number;
};

const INITIAL: ReviewState = { done: false, snoozes: 0, snoozedUntil: 0, impressions: 0 };

type Data = { installedAt?: number; opens: number; state: ReviewState };

/**
 * Whether to show the banner. A missing install time means Slate was installed
 * before this feature existed: a long-time user, so only the open count applies.
 */
export function decide({ installedAt, opens, state }: Data, now: number): boolean {
  if (state.done) return false;
  if (opens < MIN_OPENS) return false;
  if (installedAt !== undefined && now - installedAt < MIN_AGE) return false;
  return now >= state.snoozedUntil;
}

/** The state after one more "not now" (explicit, or implied by ignoring it). */
export function snoozed(state: ReviewState, now: number): ReviewState {
  const snoozes = state.snoozes + 1;
  return { done: snoozes >= MAX_SNOOZES, snoozes, snoozedUntil: now + SNOOZE, impressions: 0 };
}

async function read(): Promise<Data> {
  const found = await chrome.storage.local.get([INSTALLED_KEY, OPENS_KEY, STATE_KEY]);
  return {
    installedAt: found[INSTALLED_KEY] as number | undefined,
    opens: (found[OPENS_KEY] as number | undefined) ?? 0,
    state: { ...INITIAL, ...(found[STATE_KEY] as Partial<ReviewState> | undefined) },
  };
}

const writeState = (state: ReviewState) => chrome.storage.local.set({ [STATE_KEY]: state });

/* ---- service worker ---- */

export async function recordInstall(details: chrome.runtime.InstalledDetails, now = Date.now()): Promise<void> {
  if (details.reason !== 'install') return;
  await chrome.storage.local.set({ [INSTALLED_KEY]: now });
}

let counting: Promise<void> = Promise.resolve();

/** Count one project open. Serialized so quick successive opens are all counted. */
export function recordProjectOpen(): Promise<void> {
  counting = counting.then(async () => {
    const found = await chrome.storage.local.get(OPENS_KEY);
    const opens = (found[OPENS_KEY] as number | undefined) ?? 0;
    if (opens < MIN_OPENS) await chrome.storage.local.set({ [OPENS_KEY]: opens + 1 });
  }).catch(() => undefined);
  return counting;
}

/* ---- popup ---- */

/** Whether to show the banner now; counts the showing, and ignoring it too often snoozes it. */
export async function takeReviewPrompt(now = Date.now()): Promise<boolean> {
  const data = await read();
  if (!decide(data, now)) return false;
  const impressions = data.state.impressions + 1;
  await writeState(impressions >= MAX_IMPRESSIONS ? snoozed(data.state, now) : { ...data.state, impressions });
  return true;
}

export async function snoozeReviewPrompt(now = Date.now()): Promise<void> {
  await writeState(snoozed((await read()).state, now));
}

export async function finishReviewPrompt(): Promise<void> {
  await writeState({ ...(await read()).state, done: true });
}

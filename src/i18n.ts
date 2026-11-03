import en from '../_locales/en/messages.json';

type MessageKey = keyof typeof en;
type Entry = { message: string; placeholders?: Record<string, { content: string }> };

/** English text with $PLACEHOLDER$s filled - used when chrome.i18n has no message (tests, missing key). */
function fallback(key: string, subs: string[]): string {
  const entry = (en as Record<string, Entry>)[key];
  if (!entry) return key;
  return entry.message.replace(/\$([A-Z_]+)\$/g, (_, name: string) => {
    const content = entry.placeholders?.[name.toLowerCase()]?.content ?? '';
    const n = Number(content.replace('$', ''));
    return Number.isInteger(n) && n > 0 ? (subs[n - 1] ?? '') : content;
  });
}

export function t(key: MessageKey | string, ...subs: Array<string | number>): string {
  const args = subs.map(String);
  const message = globalThis.chrome?.i18n?.getMessage?.(key, args);
  return message || fallback(key, args);
}

/** Whether a message exists in the active locale (or, without chrome.i18n, in English). */
function has(key: string): boolean {
  const getMessage = globalThis.chrome?.i18n?.getMessage;
  return getMessage ? getMessage(key) !== '' : key in en;
}

let pluralRules: Intl.PluralRules | null = null;

/**
 * Plural message for a count: `<base>_zero` for 0 when the locale has one, else
 * the CLDR category (`_one`, `_few`, `_many`, `_other`) of the language the
 * messages are actually in - not the browser's, which may have fallen back to
 * English - and `_other` when that category has no message.
 */
export function tCount(base: string, count: number): string {
  if (count === 0 && has(`${base}_zero`)) return t(`${base}_zero`);
  pluralRules ??= new Intl.PluralRules(t('pluralLocale'));
  const key = `${base}_${pluralRules.select(count)}`;
  return t(has(key) ? key : `${base}_other`, count);
}

/** Fill elements marked with data-i18n / data-i18n-title / data-i18n-placeholder / data-i18n-aria-label. */
export function localizeDocument(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle!);
  for (const el of root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]')) el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel!));
  if (typeof document !== 'undefined') document.documentElement.lang = t('pluralLocale');
}

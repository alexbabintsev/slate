import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import enJson from '../_locales/en/messages.json';
import ukJson from '../_locales/uk/messages.json';
import deJson from '../_locales/de/messages.json';
import esJson from '../_locales/es/messages.json';
import manifest from '../manifest.json';
import popupHtml from '../src/popup/popup.html?raw';
import managerHtml from '../src/manager/manager.html?raw';
import welcomeHtml from '../src/welcome/welcome.html?raw';

type Entry = { message: string; placeholders?: Record<string, { content: string }> };
type Messages = Record<string, Entry>;

const ALL: Record<string, Messages> = { en: enJson, uk: ukJson, de: deJson, es: esJson };
const locales = Object.keys(ALL);
const load = (lang: string): Messages => ALL[lang];
const en = load('en');
const PLURAL = /_(zero|one|two|few|many|other)$/;

/** chrome.i18n.getMessage over one locale's file, like Chrome does it. */
function installI18n(lang: string) {
  const messages = load(lang);
  (globalThis as unknown as { chrome: unknown }).chrome = {
    i18n: {
      getMessage: (key: string, subs: string[] = []) => {
        const entry = messages[key];
        if (!entry) return '';
        return entry.message.replace(/\$([A-Z_]+)\$/g, (_, name: string) => {
          const content = entry.placeholders?.[name.toLowerCase()]?.content ?? '';
          return content.replace(/\$(\d)/g, (_m, d: string) => subs[Number(d) - 1] ?? '');
        });
      },
    },
  };
}

describe('locale files', () => {
  for (const lang of locales) {
    describe(lang, () => {
      const messages = load(lang);

      it('translates every English key (plural families may add forms)', () => {
        const missing = Object.keys(en).filter(k => !(k in messages) && !PLURAL.test(k));
        const missingFamilies = Object.keys(en)
          .filter(k => PLURAL.test(k))
          .map(k => k.replace(PLURAL, ''))
          .filter(base => !(`${base}_other` in messages));
        expect([...missing, ...missingFamilies]).toEqual([]);
      });

      it('defines a placeholder for every $NAME$ it uses', () => {
        for (const [key, entry] of Object.entries(messages)) {
          for (const [, name] of entry.message.matchAll(/\$([A-Z_]+)\$/g)) {
            expect(entry.placeholders?.[name.toLowerCase()], `${lang}.${key} uses $${name}$`).toBeDefined();
          }
        }
      });

      it('fits the Web Store limits for name and description', () => {
        expect(messages.extName.message.length).toBeLessThanOrEqual(75);
        expect(messages.extDescription.message.length).toBeLessThanOrEqual(132);
      });
    });
  }

  it('every data-i18n key used in the HTML exists', () => {
    const html = popupHtml + managerHtml + welcomeHtml;
    const keys = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map(m => m[1]);
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter(k => !(k in en))).toEqual([]);
  });

  it('the manifest name and description come from the locales', () => {
    expect(manifest.name).toBe('__MSG_extName__');
    expect(manifest.description).toBe('__MSG_extDescription__');
    expect((manifest as { default_locale?: string }).default_locale).toBe('en');
  });
});

describe('t and tCount', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => { delete (globalThis as { chrome?: unknown }).chrome; });

  it('falls back to English without chrome.i18n', async () => {
    const { t, tCount } = await import('../src/i18n');
    expect(t('deleteMessage', 'Work')).toBe('“Work” will be permanently deleted. Any open window will be unlinked.');
    expect(tCount('tabs', 0)).toBe('No tabs');
    expect(tCount('tabs', 1)).toBe('1 tab');
    expect(tCount('tabs', 5)).toBe('5 tabs');
  });

  it('uses Ukrainian plural forms', async () => {
    installI18n('uk');
    const { tCount } = await import('../src/i18n');
    expect([0, 1, 2, 5, 11, 21, 22, 25].map(n => tCount('tabs', n))).toEqual([
      'Немає вкладок', '1 вкладка', '2 вкладки', '5 вкладок', '11 вкладок', '21 вкладка', '22 вкладки', '25 вкладок',
    ]);
  });

  it('uses German and Spanish forms', async () => {
    installI18n('de');
    let { tCount } = await import('../src/i18n');
    expect([1, 3].map(n => tCount('importDone', n))).toEqual(['1 Projekt importiert.', '3 Projekte importiert.']);
    vi.resetModules();
    installI18n('es');
    ({ tCount } = await import('../src/i18n'));
    expect([0, 1, 4].map(n => tCount('tabs', n))).toEqual(['Sin pestañas', '1 pestaña', '4 pestañas']);
  });

  it('localizes text, titles and placeholders in a document', async () => {
    installI18n('uk');
    const { localizeDocument } = await import('../src/i18n');
    const root = {
      querySelectorAll: (sel: string) => {
        const el = { dataset: { i18n: 'newProject', i18nTitle: 'manageProjects', i18nPlaceholder: 'searchIcons' }, textContent: '', title: '', placeholder: '', setAttribute: () => {} };
        return sel === '[data-i18n]' || sel === '[data-i18n-title]' || sel === '[data-i18n-placeholder]' ? [el] : [];
      },
    };
    const els: Record<string, string>[] = [];
    const spy = { ...root, querySelectorAll: (sel: string) => { const r = root.querySelectorAll(sel); els.push(...(r as unknown as Record<string, string>[])); return r; } };
    localizeDocument(spy as unknown as ParentNode);
    expect(els.find(e => e.textContent)?.textContent).toBe('Новий проєкт');
    expect(els.find(e => e.title)?.title).toBe('Керувати проєктами');
    expect(els.find(e => e.placeholder)?.placeholder).toBe('Пошук іконок…');
  });
});

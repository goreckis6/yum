// Per-language UI dictionaries, added incrementally. Each is a Partial map —
// any missing key falls back to English via the t() helper (see I18nContext).
// English ('en') and Polish ('pl') live in ../translations.ts.
//
// As a language is translated, create ./<lang>.ts, import it here, and swap its
// empty placeholder below for the import.
import type { TKey } from '../translations';

export type Dict = Partial<Record<TKey, string>>;

import de from './de';
import es from './es';
import fr from './fr';
import it from './it';

const locales: Record<string, Dict> = {
  de,
  es,
  fr,
  it,
  pt: {},
  nl: {},
  sv: {},
  uk: {},
  ru: {},
  ar: {},
  he: {},
  ja: {},
  ko: {},
  tr: {},
  'zh-Hans': {},
};

export default locales;

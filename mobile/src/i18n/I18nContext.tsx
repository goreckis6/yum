import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { DICTS, Lang, LANGS, TKey } from './translations';

const STORAGE_KEY = '@yumshare/lang';

const SUPPORTED = new Set<string>(LANGS.map((l) => l.key));

// Keep the whole app left-to-right. The RTL languages (ar/he) aren't translated
// yet (they fall back to English), and forcing RTL persists natively and only
// takes effect after a restart — which left the UI stuck mirrored. Pin LTR here
// and undo any previously-persisted forceRTL(true). Revisit when ar/he ship with
// a proper RTL restart flow.
I18nManager.allowRTL(false);
if (I18nManager.isRTL) I18nManager.forceRTL(false);

function normalizeCode(code?: string): Lang | null {
  if (!code) return null;
  const c = code.toLowerCase();
  if (c === 'zh') return 'zh-Hans'; // any Chinese → Simplified for now
  if (c === 'iw') return 'he'; // legacy ISO code for Hebrew
  return SUPPORTED.has(c) ? (c as Lang) : null;
}

function deviceLang(): Lang {
  try {
    return normalizeCode(getLocales()[0]?.languageCode ?? undefined) ?? 'en';
  } catch {
    return 'en';
  }
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLang());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v && SUPPORTED.has(v)) setLangState(v as Lang);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => {
      let s = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
      if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, String(vars[k]));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

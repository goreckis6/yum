import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { DICTS, Lang, LANGS, RTL_LANGS, TKey } from './translations';

const STORAGE_KEY = '@yumshare/lang';

const SUPPORTED = new Set<string>(LANGS.map((l) => l.key));

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

// RTL takes effect after an app restart (I18nManager persists the flag
// natively). We set it but never force a reload — a mid-session flip can crash.
function applyDirection(lang: Lang) {
  const rtl = RTL_LANGS.includes(lang);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
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

  useEffect(() => {
    applyDirection(lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    applyDirection(l);
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

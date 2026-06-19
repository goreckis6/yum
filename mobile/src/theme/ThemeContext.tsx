import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeColors,
  lightColors,
  darkColors,
  lightTints,
  darkTints,
} from './colors';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  c: ThemeColors;
  tints: string[];
  isDark: boolean;
  mode: ThemeMode; // the user's preference
  setMode: (m: ThemeMode) => void;
}

const STORAGE_KEY = '@yumshare/theme-mode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Load the saved preference once on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      })
      .catch(() => {});
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  };

  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({
      c: isDark ? darkColors : lightColors,
      tints: isDark ? darkTints : lightTints,
      isDark,
      mode,
      setMode,
    }),
    [isDark, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Full theme value (colors, tints, mode controls).
export function useThemeCtx(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeCtx must be used within ThemeProvider');
  return ctx;
}

// Convenience hook returning just the colors object, since that's what most
// components need. Use like: const c = useTheme();
export function useTheme(): ThemeColors {
  return useThemeCtx().c;
}

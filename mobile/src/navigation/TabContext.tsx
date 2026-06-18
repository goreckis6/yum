import React, { createContext, useContext } from 'react';
import { MainTab } from './types';

const TabContext = createContext<{ setTab: (tab: MainTab) => void } | null>(null);

export function TabProvider({
  setTab,
  children,
}: {
  setTab: (tab: MainTab) => void;
  children: React.ReactNode;
}) {
  return <TabContext.Provider value={{ setTab }}>{children}</TabContext.Provider>;
}

export function useTabNav() {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTabNav must be used within TabProvider');
  return ctx;
}

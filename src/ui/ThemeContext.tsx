import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Theme } from '../theme';

type Mode = 'light' | 'dark';
type Ctx = { t: Theme; mode: Mode; toggle: () => void };

const ThemeCtx = createContext<Ctx>({ t: light, mode: 'light', toggle: () => {} });
const KEY = 'lobar.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<Mode>(system === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === 'light' || v === 'dark') setMode(v); }).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => ({
    t: mode === 'dark' ? dark : light,
    mode,
    toggle: () => {
      const next: Mode = mode === 'dark' ? 'light' : 'dark';
      setMode(next);
      AsyncStorage.setItem(KEY, next).catch(() => {});
    },
  }), [mode]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

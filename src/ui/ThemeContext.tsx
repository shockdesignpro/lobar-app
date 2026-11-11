// Ko'rinish telefonning o'z sozlamasiga moslashadi: telefon qorong'i rejimda bo'lsa — qorong'i,
// aks holda yorug'. Ilovaning ichida alohida almashtirgich yo'q.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Theme } from '../theme';

type Mode = 'light' | 'dark';
type Ctx = { t: Theme; mode: Mode };

const ThemeCtx = createContext<Ctx>({ t: light, mode: 'light' });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode: Mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  // Avvalgi qo'lda tanlangan mavzu endi ishlatilmaydi
  useEffect(() => { AsyncStorage.removeItem('lobar.theme').catch(() => {}); }, []);
  const value = useMemo<Ctx>(() => ({ t: mode === 'dark' ? dark : light, mode }), [mode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

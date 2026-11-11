import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  autoLockMinutes, getLastActive, loadAccess, signOut, touchActive, type Access,
} from './src/lib/auth';
import { supabase } from './src/lib/supabase';
import { AdminScreen } from './src/screens/admin/AdminScreen';
import { CatalogScreen } from './src/screens/CatalogScreen';
import { HomeScreen, SoonScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { Loading, Screen, type Tab } from './src/ui/components';
import { SnackProvider } from './src/ui/SnackContext';
import { ThemeProvider, useTheme } from './src/ui/ThemeContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SnackProvider>
          <Root />
        </SnackProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

type Route = { name: 'home' } | { name: 'admin' } | { name: 'soon'; tab: Tab };

function Root() {
  const { t, mode } = useTheme();
  const [phase, setPhase] = useState<'boot' | 'login' | 'app'>('boot');
  const [access, setAccess] = useState<Access | null>(null);
  const [locked, setLocked] = useState(false);
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const lastActive = useRef(Date.now());
  const accessRef = useRef<Access | null>(null);
  accessRef.current = access;

  const refreshAccess = useCallback(async () => {
    try {
      const a = await loadAccess();
      if (!a) { await signOut(); setAccess(null); setPhase('login'); return null; }
      setAccess(a); setPhase('app');
      return a;
    } catch {
      return accessRef.current; // internet yo'q: oldingi ma'lumot bilan davom etamiz
    }
  }, []);

  // Ishga tushganda: saqlangan sessiya bormi, qulflash vaqti o'tganmi
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setPhase('login'); return; }
      const a = await refreshAccess();
      if (!a) return;
      const last = await getLastActive();
      if (last && Date.now() - last > autoLockMinutes(a) * 60_000) setLocked(true);
      lastActive.current = Date.now();
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setAccess(null); setLocked(false); setPhase('login'); }
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshAccess]);

  // Ruxsat yoki sozlama o'zgarsa, darhol qayta o'qiymiz (realtime)
  useEffect(() => {
    if (phase !== 'app') return;
    const ch = supabase.channel('my-access');
    for (const table of ['permissions', 'staff_overrides', 'app_settings', 'staff']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => { refreshAccess(); });
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [phase, refreshAccess]);

  // Avtomatik qulflash
  const markActive = useCallback(() => {
    lastActive.current = Date.now();
  }, []);

  useEffect(() => {
    if (phase !== 'app' || locked) return;
    const minutes = autoLockMinutes(access);
    const check = () => {
      if (Date.now() - lastActive.current > minutes * 60_000) setLocked(true);
    };
    const timer = setInterval(() => { check(); touchActiveThrottled(lastActive.current); }, 10_000);
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check(); else touchActive();
    });
    let off = () => {};
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const h = () => markActive();
      const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
      evs.forEach((e) => window.addEventListener(e, h, { passive: true }));
      off = () => evs.forEach((e) => window.removeEventListener(e, h));
    }
    return () => { clearInterval(timer); appSub.remove(); off(); };
  }, [phase, locked, access, markActive]);

  const goTab = (tab: Tab) => setRoute(tab === 'home' ? { name: 'home' } : { name: 'soon', tab });

  if (phase === 'boot') {
    return <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center' }}><Loading /></View>;
  }

  if (phase === 'login' || !access) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onSuccess={async () => { setLocked(false); setRoute({ name: 'home' }); lastActive.current = Date.now(); await refreshAccess(); }} />
      </>
    );
  }

  if (locked) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen
          lockedFor={{ login: access.login, name: access.full_name }}
          onSuccess={async () => { lastActive.current = Date.now(); setLocked(false); await refreshAccess(); }}
          onSwitchUser={async () => { await signOut(); }}
        />
      </>
    );
  }

  const tab: Tab = route.name === 'soon' ? route.tab : 'home';
  const soonTitles: Record<Tab, string> = { home: 'Asosiy', orders: 'Buyurtmalar', catalog: 'Katalog', reports: 'Hisobot' };

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => { markActive(); return false; }}
      onMoveShouldSetResponderCapture={() => { markActive(); return false; }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {route.name === 'admin' ? (
        <Screen title="Admin panel" onBack={() => setRoute({ name: 'home' })} tab="home" onTab={goTab}>
          <AdminScreen access={access} />
        </Screen>
      ) : (
        <Screen title={route.name === 'soon' ? soonTitles[route.tab] : 'Lobar'} tab={tab} onTab={goTab}
          onBack={route.name === 'soon' ? () => setRoute({ name: 'home' }) : undefined}>
          {route.name === 'home'
            ? <HomeScreen access={access} onOpenAdmin={() => setRoute({ name: 'admin' })} onSignOut={() => signOut()} />
            : route.tab === 'catalog'
              ? <CatalogScreen access={access} />
              : <SoonScreen title={soonTitles[route.tab]} />}
        </Screen>
      )}
    </View>
  );
}

let lastPersist = 0;
function touchActiveThrottled(at: number) {
  if (at - lastPersist > 30_000) { lastPersist = at; touchActive(); }
}

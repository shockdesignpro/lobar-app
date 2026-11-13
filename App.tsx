import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  can, effectiveLockMinutes, getLastActive, onLockPrefChange, hasStoredSession, loadAccess, signOut, touchActive, type Access,
} from './src/lib/auth';
import { onSyncFailure, setCacheScope, startNetworkWatch } from './src/lib/offline';
import { RemindersSync } from './src/lib/RemindersSync';
import { prefetchCatalog } from './src/lib/catalog';
import { ReceiptRenderer } from './src/ui/ReceiptRenderer';
import { loadMacros } from './src/lib/order/draft';
import { supabase } from './src/lib/supabase';
import { onPushOpen, registerPush, type PushTarget } from './src/lib/push';
import { AdminScreen } from './src/screens/admin/AdminScreen';
import { CatalogScreen } from './src/screens/CatalogScreen';
import { OrdersScreen } from './src/screens/orders/OrdersScreen';
import { OrderEditor } from './src/screens/order/OrderEditor';
import type { Draft } from './src/lib/order/model';
import { HomeScreen, type OrdersPreset } from './src/screens/HomeScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { SettingsMenu } from './src/screens/SettingsMenu';
import { PayrollScreen } from './src/screens/PayrollScreen';
import { ExpensesScreen } from './src/screens/ExpensesScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProfileSheet } from './src/screens/ProfileSheet';
import { TrashScreen } from './src/screens/TrashScreen';
import { TrackPage } from './src/screens/TrackPage';
import { trackTokenFromUrl } from './src/lib/track';
import { InboxScreen } from './src/screens/InboxScreen';
import { BellContext, Loading, Screen, TabsContext, type Tab } from './src/ui/components';
import { useUnread } from './src/lib/inbox';
import { SnackProvider, useSnack } from './src/ui/SnackContext';
import { ThemeProvider, useTheme } from './src/ui/ThemeContext';

export default function App() {
  // Mijoz kuzatish havolasi (?t=...) — kirishsiz alohida sahifa
  const [track] = useState(() => (Platform.OS === 'web' ? trackTokenFromUrl() : null));
  if (track) return <SafeAreaProvider><TrackPage token={track} /></SafeAreaProvider>;
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

type Route = { name: 'home' } | { name: 'admin' } | { name: 'trash' } | { name: 'inbox' } | { name: 'payroll'; staffId: string | null } | { name: 'expenses' } | { name: 'soon'; tab: Tab } | { name: 'order'; draft: Draft | null };

function Root() {
  const { t, mode } = useTheme();
  const [phase, setPhase] = useState<'boot' | 'login' | 'app'>('boot');
  const [access, setAccess] = useState<Access | null>(null);
  const [locked, setLocked] = useState(false);
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [orderFocus, setOrderFocus] = useState<string | null>(null);
  const [focusFrom, setFocusFrom] = useState<Tab | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [preset, setPreset] = useState<{ n: number; p: OrdersPreset | null }>({ n: 0, p: null });
  const lastActive = useRef(Date.now());
  const accessRef = useRef<Access | null>(null);
  accessRef.current = access;

  const refreshAccess = useCallback(async () => {
    try {
      const a = await loadAccess();
      if (!a) { await signOut(); setAccess(null); setPhase('login'); return null; }
      setCacheScope(a.staff_id);
      void prefetchCatalog(); void loadMacros().catch(() => {});
      setAccess(a); setPhase('app');
      return a;
    } catch {
      if (!accessRef.current) setPhase('login');
      return accessRef.current; // vaqtinchalik xato: oldingi ma'lumot bilan davom etamiz
    }
  }, []);

  // Ishga tushganda: saqlangan sessiya bormi, qulflash vaqti o'tganmi
  useEffect(() => {
    startNetworkWatch();
    (async () => {
      const { data } = await supabase.auth.getSession();
      // Internetsiz ochilganda token yangilanmay qolishi mumkin — saqlangan sessiya bo'lsa, davom etamiz
      if (!data.session && !(await hasStoredSession())) { setPhase('login'); return; }
      const a = await refreshAccess();
      if (!a) return;
      const last = await getLastActive();
      const lockMin = await effectiveLockMinutes(a);
      if (lockMin > 0 && last && Date.now() - last > lockMin * 60_000) setLocked(true);
      lastActive.current = Date.now();
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setAccess(null); setLocked(false); setPhase('login'); }
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshAccess]);

  const unread = useUnread(access?.staff_id ?? null);

  // Bildirishnomalar: telefon manzilini yozamiz (har kirishda — manzil yangilangan bo'lishi mumkin)
  const staffId = access?.staff_id;
  useEffect(() => { if (staffId) void registerPush(); }, [staffId]);

  // Bildirishnoma bosilsa — kerakli sahifa (qulf ochilgandan keyin)
  const [pushTarget, setPushTarget] = useState<PushTarget | null>(null);
  useEffect(() => onPushOpen(setPushTarget), []);
  useEffect(() => {
    if (!pushTarget || phase !== 'app' || locked || !access) return;
    setPushTarget(null); setMenuOpen(false);
    if (pushTarget.screen === 'payroll') { setOrderFocus(null); setRoute({ name: 'payroll', staffId: null }); }
    else if (pushTarget.orderId) { setFocusFrom('home'); setOrderFocus(pushTarget.orderId); setRoute({ name: 'soon', tab: 'orders' }); }
    else { setOrderFocus(null); setFocusFrom(null); setRoute({ name: 'soon', tab: 'orders' }); }
  }, [pushTarget, phase, locked, access]);

  // Internetsiz kiritilgan o'zgarish server tomonidan qabul qilinmasa — xabar beramiz
  const snack = useSnack();
  useEffect(() => onSyncFailure((m) => snack(m)), [snack]);

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

  // Qulflash vaqti: xodim o'zi tanlagan (Kod va qulflash sahifasida) yoki Admin belgilagan standart; 0 — qulflanmaydi
  const [lockMinutes, setLockMinutes] = useState<number | null>(null);
  useEffect(() => {
    if (!access) return;
    const read = () => { effectiveLockMinutes(access).then(setLockMinutes); };
    read();
    return onLockPrefChange(read);
  }, [access]);

  useEffect(() => {
    if (phase !== 'app' || locked || lockMinutes == null) return;
    const minutes = lockMinutes;
    if (minutes === 0) return; // qulflanmasin
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
  }, [phase, locked, lockMinutes, markActive]);

  // Telefonning "Orqaga" tugmasi: ilovadan chiqib ketmasdan oldingi sahifaga qaytadi.
  // Bosh sahifada — 2 soniya ichida ikki marta bosilsa, ilova yopiladi.
  const backRef = useRef<() => boolean>(() => false);
  const lastBack = useRef(0);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => backRef.current());
    return () => sub.remove();
  }, []);

  const goTab = (tab: Tab) => {
    setOrderFocus(null); setFocusFrom(null);
    if (tab === 'orders') setPreset((x) => ({ n: x.n + 1, p: null }));
    setRoute(tab === 'home' ? { name: 'home' } : tab === 'pay' ? { name: 'payroll', staffId: null } : { name: 'soon', tab });
  };
  const openOrder = (from: Tab) => (id: string) => { setFocusFrom(from); setOrderFocus(id); setRoute({ name: 'soon', tab: 'orders' }); };
  backRef.current = () => {
    if (phase !== 'app' || locked || !access) return false;
    if (menuOpen) { setMenuOpen(false); return true; }
    if (profileOpen) { setProfileOpen(false); return true; }
    if (route.name === 'order') return true; // buyurtma oynasi o'zi boshqaradi
    if (route.name === 'payroll') {
      setRoute(route.staffId && can(access, 'payroll.manage') ? { name: 'payroll', staffId: null } : { name: 'home' });
      return true;
    }
    if (route.name === 'expenses' || route.name === 'admin' || route.name === 'trash' || route.name === 'inbox') { setRoute({ name: 'home' }); return true; }
    if (route.name === 'soon') {
      if (route.tab === 'orders' && orderFocus) { if (focusFrom) goTab(focusFrom); else setOrderFocus(null); }
      else goTab('home');
      return true;
    }
    const now = Date.now();
    if (now - lastBack.current < 2000) return false;
    lastBack.current = now;
    snack('Chiqish uchun yana bir marta bosing');
    return true;
  };
  const showOrders = (p: OrdersPreset) => { setOrderFocus(null); setFocusFrom(null); setPreset((x) => ({ n: x.n + 1, p })); setRoute({ name: 'soon', tab: 'orders' }); };

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
  const soonTitles: Record<Tab, string> = { home: 'Asosiy', orders: 'Buyurtmalar', catalog: 'Katalog', reports: 'Hisobot', pay: 'Ish haqim' };
  // Tikuvchi va usta: Katalog va Hisobot yo'q, o'rniga "Ish haqim"
  const worker = access.role === 'tikuvchi' || access.role === 'usta';
  const tabs: Tab[] = worker ? ['home', 'orders', 'pay'] : ['home', 'orders', 'catalog', 'reports'];

  return (
    <TabsContext.Provider value={tabs}>
    <BellContext.Provider value={{ count: unread, onPress: () => { setMenuOpen(false); setOrderFocus(null); setRoute({ name: 'inbox' }); } }}>
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => { markActive(); return false; }}
      onMoveShouldSetResponderCapture={() => { markActive(); return false; }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <RemindersSync access={access} />
      <ReceiptRenderer />
      <SettingsMenu visible={menuOpen} onClose={() => setMenuOpen(false)} access={access}
        onOpenAdmin={() => { setOrderFocus(null); setRoute({ name: 'admin' }); }} onSignOut={() => { void signOut(); }}
        onOpenExpenses={() => { setOrderFocus(null); setRoute({ name: 'expenses' }); }}
        onOpenPayroll={() => { setOrderFocus(null); setRoute({ name: 'payroll', staffId: null }); }}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenTrash={() => { setOrderFocus(null); setRoute({ name: 'trash' }); }}
        onOpenInbox={() => { setOrderFocus(null); setRoute({ name: 'inbox' }); }} />
      {profileOpen && <ProfileSheet access={access} onClose={() => setProfileOpen(false)} onSaved={refreshAccess} />}
      {route.name === 'order' ? (
        <OrderEditor access={access} initial={route.draft} onExit={() => setRoute({ name: 'home' })} />
      ) : route.name === 'expenses' ? (
        <Screen title="Xarajatlar" tab="reports" onTab={goTab} onMenu={() => setMenuOpen(true)} onBack={() => setRoute({ name: 'home' })}>
          <ExpensesScreen access={access} />
        </Screen>
      ) : route.name === 'payroll' ? (
        <Screen title={worker ? 'Mening ish haqim' : 'Ish haqi'} tab={worker ? 'pay' : 'home'} onTab={goTab} onMenu={() => setMenuOpen(true)}
          onBack={() => (route.staffId && can(access, 'payroll.manage') ? setRoute({ name: 'payroll', staffId: null }) : setRoute({ name: 'home' }))}>
          <PayrollScreen access={access} staffId={route.staffId} setStaffId={(id) => setRoute({ name: 'payroll', staffId: id })} />
        </Screen>
      ) : route.name === 'inbox' ? (
        <Screen title="Bildirishnomalar" onBack={() => setRoute({ name: 'home' })} tab="home" onTab={goTab} onMenu={() => setMenuOpen(true)}>
          <InboxScreen access={access} onOpen={(x) => setPushTarget({ orderId: x.orderId, screen: x.screen === 'payroll' || x.screen === 'orders' ? x.screen : undefined })} />
        </Screen>
      ) : route.name === 'trash' ? (
        <Screen title="Korzinka" onBack={() => setRoute({ name: 'home' })} tab="home" onTab={goTab} onMenu={() => setMenuOpen(true)}>
          <TrashScreen access={access} />
        </Screen>
      ) : route.name === 'admin' ? (
        <Screen title="Admin panel" onBack={() => setRoute({ name: 'home' })} tab="home" onTab={goTab} onMenu={() => setMenuOpen(true)}>
          <AdminScreen access={access} />
        </Screen>
      ) : (
        <Screen title={route.name === 'soon' ? soonTitles[route.tab] : 'Lobar'} tab={tab} onTab={goTab} onMenu={() => setMenuOpen(true)}
          onBack={route.name === 'soon' ? () => (route.tab === 'orders' && orderFocus ? (focusFrom ? goTab(focusFrom) : setOrderFocus(null)) : setRoute({ name: 'home' })) : undefined}>
          {route.name === 'home'
            ? <HomeScreen access={access} onNewOrder={(d) => setRoute({ name: 'order', draft: d })}
                onOpenPayroll={() => setRoute({ name: 'payroll', staffId: null })} onOpenProfile={() => setProfileOpen(true)}
                onOpenOrder={openOrder('home')} onShowOrders={showOrders} />
            : route.tab === 'catalog' && !worker
              ? <CatalogScreen access={access} />
              : route.tab === 'orders'
              ? <OrdersScreen key={preset.n} preset={preset.p} access={access} focusId={orderFocus} setFocusId={(id) => (id === null && focusFrom ? goTab(focusFrom) : setOrderFocus(id))} onEdit={(d) => setRoute({ name: 'order', draft: d })} />
              : worker ? null : <ReportScreen access={access} onOpenOrder={openOrder('reports')} />}
        </Screen>
      )}
    </View>
    </BellContext.Provider>
    </TabsContext.Provider>
  );
}

let lastPersist = 0;
function touchActiveThrottled(at: number) {
  if (at - lastPersist > 30_000) { lastPersist = at; touchActive(); }
}

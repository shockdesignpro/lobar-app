import AsyncStorage from '@react-native-async-storage/async-storage';
import { STAFF_LOGIN_FUNCTION, SUPABASE_KEY, SUPABASE_URL } from '../config';
import { clearUserData, isNetworkError, readAccessCopy, rememberCode, saveAccessCopy, setOnline } from './offline';
import { supabase } from './supabase';

export type Perm = { allowed: boolean; limit: number | null };
export type Access = {
  staff_id: string;
  login: string;
  full_name: string;
  role: 'admin' | 'direktor' | 'tikuvchi' | 'usta' | string;
  role_name: string;
  level: number;
  perms: Record<string, Perm>;
  settings: Record<string, unknown>;
};

const LAST_LOGIN = 'lobar.lastLogin';
const LAST_ACTIVE = 'lobar.lastActive';

export const can = (a: Access | null, action: string) => !!a && (a.level >= 100 || !!a.perms[action]?.allowed);
export const isAdmin = (a: Access | null) => !!a && a.level >= 100;
export const autoLockMinutes = (a: Access | null) => {
  const v = Number(a?.settings?.auto_lock_minutes ?? 5);
  return Number.isFinite(v) ? Math.min(10, Math.max(1, v)) : 5;
};

export async function getLastLogin() {
  try { return (await AsyncStorage.getItem(LAST_LOGIN)) ?? ''; } catch { return ''; }
}
export async function touchActive() {
  try { await AsyncStorage.setItem(LAST_ACTIVE, String(Date.now())); } catch { /* ignore */ }
}
export async function getLastActive() {
  try { return Number(await AsyncStorage.getItem(LAST_ACTIVE)) || 0; } catch { return 0; }
}

/** Login + kodni server funksiyasida tekshiradi va sessiyani o'rnatadi. */
export async function signIn(login: string, code: string): Promise<{ ok: true } | { ok: false; error: string; network?: boolean }> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${STAFF_LOGIN_FUNCTION}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ login: login.trim().toLowerCase(), code: code.trim() }),
    });
  } catch {
    return { ok: false, network: true, error: 'Internet yo‘q — kirish xizmatiga ulanib bo‘lmadi.' };
  }
  let body: { error?: string; access_token?: string; refresh_token?: string } = {};
  try { body = await res.json(); } catch { /* bo'sh javob */ }
  if (res.status === 404) return { ok: false, error: `Kirish xizmati topilmadi (${STAFF_LOGIN_FUNCTION}).` };
  if (!res.ok || !body.access_token || !body.refresh_token) {
    return { ok: false, error: body.error ?? `Kirib bo‘lmadi (xato ${res.status})` };
  }
  const { error } = await supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  if (error) return { ok: false, error: error.message };
  try { await AsyncStorage.setItem(LAST_LOGIN, login.trim().toLowerCase()); } catch { /* ignore */ }
  await rememberCode(login.trim().toLowerCase(), code.trim());
  await touchActive();
  return { ok: true };
}

/** Ruxsatlar: serverdan; internet yo'q bo'lsa — oxirgi saqlangan nusxa. Kirilmagan bo'lsa null. */
export async function loadAccess(): Promise<Access | null> {
  let res: { data: unknown; error: { message: string; code?: string } | null };
  try { res = await supabase.rpc('my_access'); } catch (e) { res = { data: null, error: { message: e instanceof Error ? e.message : 'network' } }; }
  if (res.error) {
    if (isNetworkError(res.error)) { setOnline(false); const copy = await readAccessCopy<Access>(); if (copy) return copy; }
    throw res.error;
  }
  const a = (res.data as Access | null) ?? null;
  if (a) await saveAccessCopy(a);
  return a;
}

/** Saqlangan sessiya bormi (internetsiz ochilganda token muddati o'tgan bo'lsa ham) */
export async function hasStoredSession() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.some((k) => /^sb-.*-auth-token$/.test(k));
  } catch { return false; }
}

export async function signOut() {
  await supabase.auth.signOut().catch(() => {});
  await clearUserData();
}

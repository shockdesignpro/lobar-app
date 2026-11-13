// ============================================================
// Internetsiz ishlash.
//  * Tarmoq holati: so'rov tarmoq sababli o'tmasa — "internet yo'q" holatiga o'tamiz,
//    har 15 soniyada tekshirib turamiz, qaytishi bilan navbatdagilar yuboriladi.
//  * Kesh: oxirgi olingan ro'yxatlar (buyurtmalar, katalog, ruxsatlar) telefonda saqlanadi.
//  * Navbat (outbox): internet yo'qligida kiritilgan o'zgarishlar tartib bilan saqlanadi
//    va internet qaytganda xuddi shu tartibda serverga yuboriladi.
//    Har bir yozuvning o'z id'si bor, shuning uchun ikki marta yuborilsa ham ikkilanmaydi.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { checkConnection, supabase } from './supabase';

// ---------------- Tarmoq holati ----------------
type Err = { message?: string; code?: string; status?: number; statusCode?: string | number; name?: string } | null | undefined;
export function isNetworkError(e: Err | unknown): boolean {
  if (!e) return false;
  const x = e as Exclude<Err, null | undefined>;
  if (x.code && x.code !== '' && !/^(ECONN|ENOTFOUND|ETIMEDOUT)/.test(String(x.code))) return false;
  return /fetch|network|load failed|timed? ?out|econn|enotfound|internet|offline/i.test(`${x.name ?? ''} ${x.message ?? ''}`);
}

let online = true;
const netListeners = new Set<() => void>();
const emitNet = () => netListeners.forEach((f) => f());
export const isOnline = () => online;
export function setOnline(v: boolean) {
  if (online === v) return;
  online = v;
  emitNet();
  if (v) void flush();
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
async function probe() {
  const r = await checkConnection();
  const ok = r.kind === 'ok';
  if (ok && online) void flush(); // allaqachon "bor" deb turgan bo'lsa ham navbatni yuboramiz
  setOnline(ok);
}
/** Ilova ishga tushganda bir marta chaqiriladi. */
export function startNetworkWatch() {
  if (pollTimer) return;
  pollTimer = setInterval(() => { if (!online || outbox.length) void probe(); }, 15_000);
  AppState.addEventListener('change', (s) => { if (s === 'active') void probe(); });
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('online', () => { void probe(); });
    window.addEventListener('offline', () => setOnline(false));
    if (typeof navigator !== 'undefined' && navigator.onLine === false) setOnline(false);
  }
}

// ---------------- Kesh ----------------
let scope = 'anon';
export function setCacheScope(staffId: string) { scope = staffId; void loadOutbox(); }
export async function cacheGet<T>(name: string): Promise<T | null> {
  try { const raw = await AsyncStorage.getItem(`lobar.c.${scope}.${name}`); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
export async function cacheSet(name: string, value: unknown) {
  try { await AsyncStorage.setItem(`lobar.c.${scope}.${name}`, JSON.stringify(value)); } catch { /* joy tugagan bo'lishi mumkin */ }
}
/** Chiqishda: shu foydalanuvchining telefondagi nusxalari o'chiriladi. */
export async function clearUserData() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('lobar.c.') || k.startsWith('lobar.outbox.') || k === LOCAL_KEY || k === ACCESS_KEY));
  } catch { /* ignore */ }
  outbox = []; loadedScope = ''; emitBox();
}

// Ruxsatlar nusxasi (internetsiz ochilganda kim ekanini bilish uchun)
const ACCESS_KEY = 'lobar.access';
export async function saveAccessCopy(a: unknown) { try { await AsyncStorage.setItem(ACCESS_KEY, JSON.stringify(a)); } catch { /* ignore */ } }
export async function readAccessCopy<T>(): Promise<T | null> {
  try { const raw = await AsyncStorage.getItem(ACCESS_KEY); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}

// ---------------- Navbat ----------------
export type Op =
  | { kind: 'save_order'; payload: Record<string, unknown>; uploads: { path: string; data: string }[]; item: unknown; draft: unknown }
  | { kind: 'payment_add'; id: string; order_id: string; amount: number; paid_at: string }
  | { kind: 'payment_cancel'; id: string; at: string }
  | { kind: 'step'; order_id: string; step: string; done: boolean }
  | { kind: 'archive'; order_id: string; on: boolean }
  | { kind: 'assign'; order_id: string; staff_id: string; task: 'tikish' | 'ornatish'; on: boolean };
export type Queued = Op & { qid: string; queuedAt: number; label: string };

let outbox: Queued[] = [];
let loadedScope = '';
const boxListeners = new Set<() => void>();
const emitBox = () => boxListeners.forEach((f) => f());
const failListeners = new Set<(msg: string) => void>();
const doneListeners = new Set<() => void>();

async function loadOutbox() {
  if (loadedScope === scope) return;
  loadedScope = scope;
  try { outbox = JSON.parse((await AsyncStorage.getItem(`lobar.outbox.${scope}`)) ?? '[]'); } catch { outbox = []; }
  emitBox();
  if (outbox.length) void probe();
}
async function persistOutbox() {
  try { await AsyncStorage.setItem(`lobar.outbox.${scope}`, JSON.stringify(outbox)); } catch { /* ignore */ }
}
export const pendingOps = () => outbox;
export function onSyncFailure(f: (msg: string) => void) { failListeners.add(f); return () => { failListeners.delete(f); }; }
/** Navbatdagilar yuborilgandan keyin (ro'yxatlarni qayta o'qish uchun) */
export function onSynced(f: () => void) { doneListeners.add(f); return () => { doneListeners.delete(f); }; }
export function onOutboxChange(f: () => void) { boxListeners.add(f); return () => { boxListeners.delete(f); }; }

export function dataToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export async function uploadPhoto(path: string, dataUrl: string): Promise<{ ok: true } | { ok: false; network: boolean; message: string }> {
  try {
    const mime = /^data:(image\/[a-z+.-]+);/i.exec(dataUrl)?.[1] ?? 'image/jpeg';
    const { error } = await supabase.storage.from('order-photos').upload(path, dataToBytes(dataUrl), { contentType: mime, upsert: false });
    if (!error) return { ok: true };
    // Oldin yuklangan (qayta yuborish) — xato emas
    if (/exists|duplicate/i.test(error.message) || String((error as { statusCode?: string }).statusCode) === '409') return { ok: true };
    return { ok: false, network: isNetworkError(error), message: error.message };
  } catch (e) {
    return { ok: false, network: true, message: e instanceof Error ? e.message : String(e) };
  }
}

type RunResult = { ok: true; data?: unknown } | { ok: false; network: boolean; message: string };
async function runOp(op: Op): Promise<RunResult> {
  const fin = (error: Err, data?: unknown): RunResult =>
    error ? { ok: false, network: isNetworkError(error), message: error.message ?? 'Xato' } : { ok: true, data };
  try {
    switch (op.kind) {
      case 'save_order': {
        for (const u of op.uploads) {
          const r = await uploadPhoto(u.path, u.data);
          if (!r.ok) return r;
        }
        const { data, error } = await supabase.rpc('save_order', { p: op.payload });
        return fin(error, data);
      }
      case 'payment_add': {
        const { error } = await supabase.from('payments')
          .upsert({ id: op.id, order_id: op.order_id, amount: op.amount, paid_at: op.paid_at }, { onConflict: 'id', ignoreDuplicates: true });
        return fin(error);
      }
      case 'payment_cancel': {
        const { error } = await supabase.from('payments').update({ cancelled_at: op.at }).eq('id', op.id);
        return fin(error);
      }
      case 'step': {
        const { error } = await supabase.from('order_steps')
          .upsert({ order_id: op.order_id, step_key: op.step, done: op.done, deleted_at: null }, { onConflict: 'order_id,step_key' });
        return fin(error);
      }
      case 'archive': {
        const { error } = await supabase.from('orders').update({ deleted_at: op.on ? new Date().toISOString() : null }).eq('id', op.order_id);
        return fin(error);
      }
      case 'assign': {
        const { error } = op.on
          ? await supabase.from('order_assignees').upsert({ order_id: op.order_id, staff_id: op.staff_id, task: op.task, deleted_at: null }, { onConflict: 'order_id,staff_id,task' })
          : await supabase.from('order_assignees').update({ deleted_at: new Date().toISOString() }).eq('order_id', op.order_id).eq('staff_id', op.staff_id).eq('task', op.task);
        return fin(error);
      }
    }
  } catch (e) {
    return { ok: false, network: true, message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * O'zgarishni bajaradi. Internet bo'lsa — darhol serverga; bo'lmasa — navbatga.
 * Navbatda kutayotganlar bo'lsa, tartib buzilmasligi uchun yangisi ham navbat oxiriga qo'yiladi.
 * Server rad etsa (masalan, ruxsat yo'q), xato qaytariladi.
 */
export async function perform(op: Op, label: string): Promise<{ queued: boolean; data?: unknown }> {
  if (online && outbox.length === 0) {
    const r = await runOp(op);
    if (r.ok) return { queued: false, data: r.data };
    if (!r.network) throw new Error(r.message);
    setOnline(false);
  }
  outbox = [...outbox, { ...op, qid: `${Date.now()}-${Math.random().toString(36).slice(2)}`, queuedAt: Date.now(), label }];
  await persistOutbox();
  emitBox();
  return { queued: true };
}

let flushing = false;
export async function flush() {
  if (flushing || !outbox.length) return;
  flushing = true;
  let sent = 0;
  try {
    while (outbox.length) {
      const q = outbox[0];
      const r = await runOp(q);
      if (!r.ok && r.network) { online = false; emitNet(); break; }
      outbox = outbox.slice(1);
      await persistOutbox();
      emitBox();
      if (r.ok) sent++;
      else failListeners.forEach((f) => f(`${q.label} — saqlanmadi: ${r.message}`));
    }
  } finally {
    flushing = false;
  }
  if (sent) doneListeners.forEach((f) => f());
}

/** Ekranlar uchun: internet holati va navbatdagi o'zgarishlar soni */
export function useSync() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    netListeners.add(f); boxListeners.add(f);
    return () => { netListeners.delete(f); boxListeners.delete(f); };
  }, []);
  return { online, pending: outbox.length };
}

// ---------------- Internetsiz qulfni ochish ----------------
// Muvaffaqiyatli kirishda kodning tuzli xeshi shu telefonda saqlanadi (kodning o'zi emas).
// Internet yo'q paytda qulflangan ilovani faqat o'sha foydalanuvchi o'z kodi bilan ocha oladi.
const LOCAL_KEY = 'lobar.lk';
const ROUNDS = 600;
async function stretch(salt: string, code: string) {
  let h = `${salt}:${code}`;
  for (let i = 0; i < ROUNDS; i++) h = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}${h}${code}`);
  return h;
}
export async function rememberCode(login: string, code: string) {
  try {
    const salt = Array.from(getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify({ login, salt, hash: await stretch(salt, code) }));
  } catch { /* ignore */ }
}
/** 5 marta noto'g'ri kiritilsa, internetsiz ochish o'chadi — keyin faqat internet bilan kiriladi. */
export async function checkLocalCode(login: string, code: string): Promise<'ok' | 'wrong' | 'none'> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    if (!raw) return 'none';
    const v = JSON.parse(raw) as { login: string; salt: string; hash: string; tries?: number };
    if (v.login === login && (await stretch(v.salt, code)) === v.hash) {
      if (v.tries) await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify({ ...v, tries: 0 }));
      return 'ok';
    }
    const tries = (v.tries ?? 0) + 1;
    if (tries >= 5) await AsyncStorage.removeItem(LOCAL_KEY);
    else await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify({ ...v, tries }));
    return 'wrong';
  } catch { return 'none'; }
}

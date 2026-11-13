// ============================================================
// Buyurtmalar: ro'yxat, tafsilot, to'lovlar, ish bosqichlari, biriktirish.
// Eski tarix.js / mobile.js mantiqi (holat, to'lov holati, yaqin kunlar) shu yerda.
// ============================================================
import { useEffect, useState } from 'react';
import { cacheGet, cacheSet, isNetworkError, isOnline, onOutboxChange, onSynced, pendingOps, perform, setOnline, type Op, type Queued } from './offline';
import { emptyDraft, type Draft, type Row, type Section } from './order/model';
import { supabase } from './supabase';

export const ORDER_STEPS = [
  { key: 'razmer', label: 'Razmer olindi' },
  { key: 'sotib_olindi', label: 'Sotib olindi' },
  { key: 'tikuvchiga_berildi', label: 'Tikuvchiga berildi' },
  { key: 'bichildi', label: 'Bichildi' },
  { key: 'chetlari_tikildi', label: 'Chetlari tikildi' },
  { key: 'boy_chiqarildi', label: 'Bo‘y chiqarildi' },
  { key: 'tepasi_tikildi', label: 'Tepasi tikildi' },
  { key: 'dazmolandi', label: 'Dazmolandi' },
  { key: 'karniz_ustanovka', label: 'Karniz ustanovka' },
  { key: 'parda_ornatish', label: 'Pardani o‘rnatish' },
] as const;
export type StepKey = (typeof ORDER_STEPS)[number]['key'];
export const STEP_GROUP: Record<StepKey, 'ofis' | 'tikish' | 'ornatish'> = {
  razmer: 'ofis', sotib_olindi: 'ofis', tikuvchiga_berildi: 'ofis', bichildi: 'tikish', chetlari_tikildi: 'tikish',
  boy_chiqarildi: 'tikish', tepasi_tikildi: 'tikish', dazmolandi: 'tikish', karniz_ustanovka: 'ornatish', parda_ornatish: 'ornatish',
};

export type Payment = { id: string; amount: number; paid_at: string };
export type Assignee = { staff_id: string; task: 'tikish' | 'ornatish' };
export type OrderListItem = {
  id: string; order_no: number | null; order_year: number | null; created_at: string; ready_date: string | null;
  total: number | null; // ishchilar uchun null (narx ko'rinmaydi)
  client_name: string; client_phone: string | null; client_address: string | null;
  payments: Payment[]; steps: Partial<Record<StepKey, boolean>>; assignees: Assignee[];
  photos: string[]; photo_captions: string[];
  /** internet qaytishini kutayotgan o'zgarishi bor */
  pending?: boolean;
};

export const orderNumber = (o: { order_no: number | null }) => (o.order_no ? String(o.order_no).padStart(4, '0') : '—');
export const paidSum = (o: OrderListItem) => o.payments.reduce((s, p) => s + p.amount, 0);
export const remaining = (o: OrderListItem) => Math.max(0, (o.total ?? 0) - paidSum(o));
export function payStatus(o: OrderListItem): 'full' | 'partial' | 'none' {
  const paid = paidSum(o);
  if ((o.total ?? 0) > 0 && paid >= (o.total ?? 0)) return 'full';
  if (paid > 0) return 'partial';
  return 'none';
}
export const stepsDone = (o: OrderListItem) => ORDER_STEPS.filter((s) => !!o.steps[s.key]).length;
export function stage(o: OrderListItem) {
  const st = o.steps;
  if (st.parda_ornatish || stepsDone(o) >= ORDER_STEPS.length) return 'O‘rnatildi';
  if (st.dazmolandi) return 'Tayyor';
  if (st.tikuvchiga_berildi || st.bichildi || st.chetlari_tikildi || st.boy_chiqarildi || st.tepasi_tikildi) return 'Tikilmoqda';
  if (st.sotib_olindi) return 'Mato olindi';
  return 'Yangi buyurtma';
}
export const isLate = (o: OrderListItem) => !!o.ready_date && new Date(`${o.ready_date}T23:59:59`) < new Date() && stage(o) !== 'O‘rnatildi';
export const displayDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : 'Sana belgilanmagan');
export function progressTone(pct: number): 'red' | 'amber' | 'teal' { return pct >= 90 ? 'teal' : pct >= 50 ? 'amber' : 'red'; }

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Bugun yoki ertaga tayyor bo'lishi kerak, hali o'rnatilmagan buyurtmalar */
export function readySoon(list: OrderListItem[]) {
  const today = isoDay(new Date()); const t = new Date(); t.setDate(t.getDate() + 1); const tomorrow = isoDay(t);
  return list.filter((o) => o.ready_date && (o.ready_date === today || o.ready_date === tomorrow) && stage(o) !== 'O‘rnatildi')
    .sort((a, b) => (a.ready_date ?? '').localeCompare(b.ready_date ?? ''))
    .map((o) => ({ order: o, today: o.ready_date === today }));
}
export function createdFrom(f: 'all' | 'today' | 'week' | 'month'): number | null {
  const now = new Date();
  if (f === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (f === 'week') { const day = now.getDay(); return new Date(now.getFullYear(), now.getMonth(), now.getDate() + (day === 0 ? -6 : 1 - day)).getTime(); }
  if (f === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return null;
}

type DbOrder = {
  id: string; order_no: number | null; order_year: number | null; created_at: string; ready_date: string | null; total: number | string;
  photos: string[] | null; photo_captions: string[] | null;
  client_name: string | null; client_phone: string | null; client_address: string | null;
  clients: { name: string; phone: string | null; address: string | null } | null;
  payments: { id: string; amount: number | string; paid_at: string; cancelled_at: string | null; deleted_at: string | null }[];
  order_steps: { step_key: StepKey; done: boolean; deleted_at: string | null }[];
  order_assignees: { staff_id: string; task: 'tikish' | 'ornatish'; deleted_at: string | null }[];
};

// ---------------- Buyurtmalar ombori ----------------
// Bitta umumiy ro'yxat: barcha ekranlar shu yerdan oladi. Avval telefondagi nusxa ko'rsatiladi,
// keyin serverdan yangisi; navbatdagi (internetsiz kiritilgan) o'zgarishlar ustidan qo'shiladi.
type Store = { full: boolean | null; server: OrderListItem[] | null; error: string; refs: number };
const store: Store = { full: null, server: null, error: '', refs: 0 };
const listeners = new Set<() => void>();
let view: OrderListItem[] | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

// Internet bor paytda ham bosilgan zahoti ko'rinsin: server javobini kutmasdan ekranga qo'yamiz
let optimistic: Op[] = [];
function recompute() {
  view = store.server ? applyPending(applyPending(store.server, pendingOps()), optimistic, false) : null;
  listeners.forEach((f) => f());
}

/** Navbatdagi o'zgarishlarni ro'yxat ustiga qo'yadi (ekranda darhol ko'rinishi uchun) */
export function applyPending(list: OrderListItem[], ops: Queued[] | Op[], markPending = true): OrderListItem[] {
  let out = list.map((o) => ({ ...o }));
  const mark = (id: string, fn: (o: OrderListItem) => OrderListItem) => { out = out.map((o) => (o.id === id ? { ...fn(o), pending: markPending || o.pending } : o)); };
  for (const op of ops) {
    switch (op.kind) {
      case 'save_order': {
        const it = op.item as OrderListItem;
        if (out.some((o) => o.id === it.id)) {
          mark(it.id, (o) => ({ ...o, client_name: it.client_name, client_phone: it.client_phone, client_address: it.client_address,
            ready_date: it.ready_date, total: it.total, photos: it.photos, photo_captions: it.photo_captions }));
        } else out = [{ ...it, pending: markPending }, ...out];
        break;
      }
      case 'payment_add':
        mark(op.order_id, (o) => (o.payments.some((p) => p.id === op.id) ? o : { ...o, payments: [...o.payments, { id: op.id, amount: op.amount, paid_at: op.paid_at }] }));
        break;
      case 'payment_cancel':
        out = out.map((o) => (o.payments.some((p) => p.id === op.id) ? { ...o, payments: o.payments.filter((p) => p.id !== op.id), pending: markPending || o.pending } : o));
        break;
      case 'step':
        mark(op.order_id, (o) => ({ ...o, steps: { ...o.steps, [op.step]: op.done } }));
        break;
      case 'archive':
        if (op.on) out = out.filter((o) => o.id !== op.order_id);
        break;
      case 'assign':
        mark(op.order_id, (o) => ({
          ...o, assignees: op.on
            ? [...o.assignees.filter((a) => !(a.staff_id === op.staff_id && a.task === op.task)), { staff_id: op.staff_id, task: op.task }]
            : o.assignees.filter((a) => !(a.staff_id === op.staff_id && a.task === op.task)),
        }));
        break;
    }
  }
  return out;
}

const cacheName = (full: boolean) => (full ? 'orders.all' : 'orders.work');

async function fetchOrders(full: boolean): Promise<OrderListItem[]> {
  if (full) {
    const { data, error: e } = await supabase.from('orders')
      .select('id, order_no, order_year, created_at, ready_date, total, photos, photo_captions, client_name, client_phone, client_address, clients(name, phone, address), payments(id, amount, paid_at, cancelled_at, deleted_at), order_steps(step_key, done, deleted_at), order_assignees(staff_id, task, deleted_at)')
      .is('deleted_at', null).order('created_at', { ascending: false });
    if (e) throw e;
    return ((data ?? []) as unknown as DbOrder[]).map((o) => ({
      id: o.id, order_no: o.order_no, order_year: o.order_year, created_at: o.created_at, ready_date: o.ready_date, total: Number(o.total),
      client_name: o.client_name ?? o.clients?.name ?? 'Mijoz', client_phone: o.client_phone ?? o.clients?.phone ?? null, client_address: o.client_address ?? o.clients?.address ?? null,
      payments: o.payments.filter((p) => !p.cancelled_at && !p.deleted_at).map((p) => ({ id: p.id, amount: Number(p.amount), paid_at: p.paid_at })).sort((a, b) => a.paid_at.localeCompare(b.paid_at)),
      steps: Object.fromEntries(o.order_steps.filter((s) => !s.deleted_at).map((s) => [s.step_key, s.done])),
      assignees: o.order_assignees.filter((a) => !a.deleted_at).map((a) => ({ staff_id: a.staff_id, task: a.task })),
      photos: o.photos ?? [], photo_captions: o.photo_captions ?? [],
    }));
  }
  // Tikuvchi va usta: faqat biriktirilgan buyurtmalar, narxsiz
  const [w, st, as] = await Promise.all([
    supabase.from('work_orders').select('id, order_no, order_year, ready_date, client_name, client_phone, client_address, updated_at, photos, photo_captions'),
    supabase.from('order_steps').select('order_id, step_key, done').is('deleted_at', null),
    supabase.from('order_assignees').select('order_id, staff_id, task').is('deleted_at', null),
  ]);
  if (w.error) throw w.error;
  type W = { id: string; order_no: number | null; order_year: number | null; ready_date: string | null; client_name: string; client_phone: string | null; client_address: string | null; updated_at: string; photos: string[] | null; photo_captions: string[] | null };
  const steps = (st.data ?? []) as { order_id: string; step_key: StepKey; done: boolean }[];
  const asg = (as.data ?? []) as { order_id: string; staff_id: string; task: 'tikish' | 'ornatish' }[];
  return ((w.data ?? []) as W[]).map((o) => ({
    id: o.id, order_no: o.order_no, order_year: o.order_year, created_at: o.updated_at, ready_date: o.ready_date, total: null,
    client_name: o.client_name ?? 'Mijoz', client_phone: o.client_phone, client_address: o.client_address, payments: [],
    steps: Object.fromEntries(steps.filter((s) => s.order_id === o.id).map((s) => [s.step_key, s.done])),
    assignees: asg.filter((a) => a.order_id === o.id).map((a) => ({ staff_id: a.staff_id, task: a.task })),
    photos: o.photos ?? [], photo_captions: o.photo_captions ?? [],
  })).sort((a, b) => (a.ready_date ?? '9999').localeCompare(b.ready_date ?? '9999'));
}

export async function reloadOrders() {
  const full = store.full;
  if (full == null) return;
  try {
    const list = await fetchOrders(full);
    if (store.full !== full) return;
    store.server = list; store.error = '';
    void cacheSet(cacheName(full), list);
    void prefetchDrafts(list, full);
  } catch (e) {
    if (isNetworkError(e)) { setOnline(false); store.error = ''; }
    else store.error = e instanceof Error ? e.message : (e as { message?: string }).message ?? 'Xato';
    if (!store.server) store.server = [];
  }
  recompute();
}
// Faol buyurtmalar tarkibini (xonalar, o'lchamlar) oldindan telefonga saqlaymiz —
// usta internetsiz joyda ham o'lchamlarni ko'ra olishi uchun. Har buyurtma sessiyada bir marta.
const prefetched = new Set<string>();
async function prefetchDrafts(list: OrderListItem[], full: boolean) {
  const todo = list.filter((o) => stage(o) !== 'O‘rnatildi' && !prefetched.has(o.id)).slice(0, 40);
  for (const o of todo) {
    prefetched.add(o.id);
    try { await cacheSet(`draft.${o.id}`, await fetchOrderDraft(o, full)); } catch (e) { if (isNetworkError(e)) { prefetched.delete(o.id); return; } }
  }
}

const scheduleReload = () => { if (reloadTimer) clearTimeout(reloadTimer); reloadTimer = setTimeout(() => { void reloadOrders(); }, 250); };

onOutboxChange(recompute);
onSynced(() => { void reloadOrders(); });

function attach(full: boolean) {
  store.refs++;
  if (store.full !== full) {
    store.full = full; store.server = null; store.error = ''; view = null;
    cacheGet<OrderListItem[]>(cacheName(full)).then((c) => { if (c && store.full === full && !store.server) { store.server = c; recompute(); } });
    void reloadOrders();
  }
  if (!channel) {
    channel = supabase.channel('orders-list');
    for (const table of ['orders', 'payments', 'order_steps', 'order_assignees', 'clients']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleReload);
    }
    channel.subscribe();
  }
}
function detach() {
  store.refs--;
  if (store.refs <= 0 && channel) { supabase.removeChannel(channel); channel = null; }
}

/** Ro'yxatdagi buyurtma (tahrirlashda raqam, sana va to'lovlarni saqlab qolish uchun) */
export const findOrder = (id: string | null) => (id ? view?.find((o) => o.id === id) ?? null : null);

/** Buyurtmalar ro'yxati, istalgan qurilmadagi o'zgarish bilan darhol yangilanadi; internetsiz ham ishlaydi. */
export function useOrders(fullAccess: boolean) {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    attach(fullAccess);
    if (store.refs > 1) void reloadOrders();
    return () => { listeners.delete(f); detach(); };
  }, [fullAccess]);
  return { items: store.full === fullAccess ? view : null, error: store.error, reload: reloadOrders };
}

// ---- Amallar (internet bo'lmasa navbatga qo'yiladi) ----
type ActResult = { error: { message: string } | null; queued?: boolean };
async function act(op: Op, label: string): Promise<ActResult> {
  optimistic = [...optimistic, op];
  recompute();
  const drop = () => { optimistic = optimistic.filter((x) => x !== op); recompute(); };
  try {
    const r = await perform(op, label);
    if (r.queued) drop(); // endi navbat ko'rsatadi
    else void reloadOrders().finally(drop);
    return { error: null, queued: r.queued };
  } catch (e) {
    drop(); // server rad etdi — avvalgi holatga qaytadi
    return { error: { message: e instanceof Error ? e.message : 'Xato' } };
  }
}
const orderLabel = (id: string) => store.server?.find((o) => o.id === id)?.client_name ?? view?.find((o) => o.id === id)?.client_name ?? 'Buyurtma';

export const addPayment = (orderId: string, amount: number, id: string = randomId()) =>
  act({ kind: 'payment_add', id, order_id: orderId, amount, paid_at: new Date().toISOString() }, `${orderLabel(orderId)}: to‘lov`);
export const cancelPayment = (id: string) => act({ kind: 'payment_cancel', id, at: new Date().toISOString() }, 'To‘lovni bekor qilish');
export const setStep = (orderId: string, step: StepKey, done: boolean) =>
  act({ kind: 'step', order_id: orderId, step, done }, `${orderLabel(orderId)}: holat`);
export const archiveOrder = (id: string) => act({ kind: 'archive', order_id: id, on: true }, `${orderLabel(id)}: o‘chirish`);
export const restoreOrder = (id: string) => act({ kind: 'archive', order_id: id, on: false }, 'Tiklash');
export const setAssignee = (orderId: string, staffId: string, task: 'tikish' | 'ornatish', on: boolean) =>
  act({ kind: 'assign', order_id: orderId, staff_id: staffId, task, on }, `${orderLabel(orderId)}: biriktirish`);

function randomId() {
  // expo-crypto bilan bir xil format (UUID v4)
  const g = globalThis.crypto as Crypto | undefined;
  if (g?.randomUUID) return g.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
}

export type StaffLite = { id: string; full_name: string; role_id: string; avatar_path?: string | null };
export async function loadWorkers(): Promise<StaffLite[]> {
  const { data, error } = await supabase.from('staff').select('id, full_name, role_id, avatar_path').in('role_id', ['tikuvchi', 'usta']).eq('is_active', true).is('deleted_at', null).order('full_name');
  if (error) return (await cacheGet<StaffLite[]>('workers')) ?? [];
  void cacheSet('workers', data);
  return (data as StaffLite[] | null) ?? [];
}

// ---- Buyurtma tarkibini qoralamaga qaytarish (tahrir, chek, batafsil) ----
type DbItem = {
  id: string; section: Section; product_id: string | null; product_name: string; unit: string | null; quantity: number | string | null;
  unit_price?: number | string; room_id: string | null; opening_id: string | null; linked_from_width?: boolean; auto_sync?: boolean; sort_order?: number;
};
export async function loadOrderDraft(o: OrderListItem, fullAccess: boolean): Promise<Draft> {
  // Navbatda shu buyurtmaning saqlanishi kutayotgan bo'lsa — eng yangi nusxa o'sha
  const queued = [...pendingOps()].reverse().find((q) => q.kind === 'save_order' && (q.item as OrderListItem).id === o.id);
  if (queued && queued.kind === 'save_order') return queued.draft as Draft;
  // Internet yo'qligi aniq bo'lsa, kutib o'tirmasdan telefondagi nusxani ko'rsatamiz
  if (!isOnline()) { const c = await cacheGet<Draft>(`draft.${o.id}`); if (c) return c; }
  try {
    const d = await fetchOrderDraft(o, fullAccess);
    void cacheSet(`draft.${o.id}`, d);
    return d;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    setOnline(false);
    const c = await cacheGet<Draft>(`draft.${o.id}`);
    if (c) return c;
    throw new Error('Internet yo‘q — bu buyurtma tarkibi hali telefonga yuklanmagan.');
  }
}

async function fetchOrderDraft(o: OrderListItem, fullAccess: boolean): Promise<Draft> {
  const [rooms, items] = await Promise.all([
    supabase.from('rooms').select('id, name, sort_order, openings(id, kind, height, width, rail_type, color, auto_off, sort_order, deleted_at)').eq('order_id', o.id).is('deleted_at', null).order('sort_order'),
    fullAccess
      ? supabase.from('order_items').select('id, section, product_id, product_name, unit, quantity, unit_price, room_id, opening_id, linked_from_width, auto_sync, sort_order').eq('order_id', o.id).is('deleted_at', null).order('sort_order')
      : supabase.from('work_items').select('id, section, product_name, unit, quantity, room_id, opening_id').eq('order_id', o.id),
  ]);
  if (rooms.error) throw rooms.error;
  if (items.error) throw items.error;
  type DbRoom = { id: string; name: string; openings: { id: string; kind: 'deraza' | 'eshik'; height: string | null; width: string | null; rail_type: string | null; color: string | null; auto_off: Partial<Record<Section, boolean>> | null; sort_order: number; deleted_at: string | null }[] };
  const d = emptyDraft();
  d.orderId = o.id;
  d.client = { name: o.client_name, address: o.client_address ?? '', phone: o.client_phone ?? '+998', readyDate: o.ready_date ?? '' };
  d.photos = o.photos.map((path, i) => ({ path, uri: '', caption: o.photo_captions[i] ?? '' }));
  d.rooms = ((rooms.data ?? []) as DbRoom[]).map((r) => ({
    id: r.id, name: r.name,
    openings: r.openings.filter((x) => !x.deleted_at).sort((a, b) => a.sort_order - b.sort_order).map((x) => ({
      id: x.id, kind: x.kind, height: x.height ?? '', width: x.width ?? '', rail: x.rail_type ?? 'Truba', color: x.color ?? 'Oq', autoOff: x.auto_off ?? {},
    })),
  }));
  d.rows = ((items.data ?? []) as DbItem[]).map((i): Row => ({
    id: i.id, section: i.section, productId: i.product_id ?? null, productName: i.product_name, unit: i.unit ?? '',
    price: Number(i.unit_price ?? 0), qty: i.quantity == null ? null : Number(i.quantity),
    roomId: i.room_id, openingId: i.linked_from_width ? null : i.opening_id, linkOpening: i.linked_from_width ? i.opening_id : null,
    autoSync: !!i.auto_sync,
  }));
  return d;
}

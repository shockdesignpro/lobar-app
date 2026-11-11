// ============================================================
// Buyurtmalar: ro'yxat, tafsilot, to'lovlar, ish bosqichlari, biriktirish.
// Eski tarix.js / mobile.js mantiqi (holat, to'lov holati, yaqin kunlar) shu yerda.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
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
  clients: { name: string; phone: string | null; address: string | null } | null;
  payments: { id: string; amount: number | string; paid_at: string; cancelled_at: string | null; deleted_at: string | null }[];
  order_steps: { step_key: StepKey; done: boolean; deleted_at: string | null }[];
  order_assignees: { staff_id: string; task: 'tikish' | 'ornatish'; deleted_at: string | null }[];
};

/** Buyurtmalar ro'yxati, istalgan qurilmadagi o'zgarish bilan darhol yangilanadi. */
export function useOrders(fullAccess: boolean) {
  const [items, setItems] = useState<OrderListItem[] | null>(null);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (fullAccess) {
      const { data, error: e } = await supabase.from('orders')
        .select('id, order_no, order_year, created_at, ready_date, total, clients(name, phone, address), payments(id, amount, paid_at, cancelled_at, deleted_at), order_steps(step_key, done, deleted_at), order_assignees(staff_id, task, deleted_at)')
        .is('deleted_at', null).order('created_at', { ascending: false });
      if (e) { setError(e.message); setItems((p) => p ?? []); return; }
      setError('');
      setItems(((data ?? []) as unknown as DbOrder[]).map((o) => ({
        id: o.id, order_no: o.order_no, order_year: o.order_year, created_at: o.created_at, ready_date: o.ready_date, total: Number(o.total),
        client_name: o.clients?.name ?? 'Mijoz', client_phone: o.clients?.phone ?? null, client_address: o.clients?.address ?? null,
        payments: o.payments.filter((p) => !p.cancelled_at && !p.deleted_at).map((p) => ({ id: p.id, amount: Number(p.amount), paid_at: p.paid_at })).sort((a, b) => a.paid_at.localeCompare(b.paid_at)),
        steps: Object.fromEntries(o.order_steps.filter((s) => !s.deleted_at).map((s) => [s.step_key, s.done])),
        assignees: o.order_assignees.filter((a) => !a.deleted_at).map((a) => ({ staff_id: a.staff_id, task: a.task })),
      })));
    } else {
      // Tikuvchi va usta: faqat biriktirilgan buyurtmalar, narxsiz
      const [w, st, as] = await Promise.all([
        supabase.from('work_orders').select('id, order_no, order_year, ready_date, client_name, client_phone, client_address, updated_at'),
        supabase.from('order_steps').select('order_id, step_key, done').is('deleted_at', null),
        supabase.from('order_assignees').select('order_id, staff_id, task').is('deleted_at', null),
      ]);
      if (w.error) { setError(w.error.message); setItems((p) => p ?? []); return; }
      setError('');
      type W = { id: string; order_no: number | null; order_year: number | null; ready_date: string | null; client_name: string; client_phone: string | null; client_address: string | null; updated_at: string };
      const steps = (st.data ?? []) as { order_id: string; step_key: StepKey; done: boolean }[];
      const asg = (as.data ?? []) as { order_id: string; staff_id: string; task: 'tikish' | 'ornatish' }[];
      setItems(((w.data ?? []) as W[]).map((o) => ({
        id: o.id, order_no: o.order_no, order_year: o.order_year, created_at: o.updated_at, ready_date: o.ready_date, total: null,
        client_name: o.client_name ?? 'Mijoz', client_phone: o.client_phone, client_address: o.client_address, payments: [],
        steps: Object.fromEntries(steps.filter((s) => s.order_id === o.id).map((s) => [s.step_key, s.done])),
        assignees: asg.filter((a) => a.order_id === o.id).map((a) => ({ staff_id: a.staff_id, task: a.task })),
      })).sort((a, b) => (a.ready_date ?? '9999').localeCompare(b.ready_date ?? '9999')));
    }
  }, [fullAccess]);

  useEffect(() => {
    load();
    const reload = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(load, 250); };
    const ch = supabase.channel('orders-list');
    for (const table of ['orders', 'payments', 'order_steps', 'order_assignees', 'clients']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, reload);
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); if (timer.current) clearTimeout(timer.current); };
  }, [load]);

  return { items, error, reload: load };
}

// ---- Amallar ----
export const addPayment = (orderId: string, amount: number) => supabase.from('payments').insert({ order_id: orderId, amount });
export const cancelPayment = (id: string) => supabase.from('payments').update({ cancelled_at: new Date().toISOString() }).eq('id', id);
export const setStep = (orderId: string, step: StepKey, done: boolean) =>
  supabase.from('order_steps').upsert({ order_id: orderId, step_key: step, done, deleted_at: null }, { onConflict: 'order_id,step_key' });
export const archiveOrder = (id: string) => supabase.from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', id);
export const restoreOrder = (id: string) => supabase.from('orders').update({ deleted_at: null }).eq('id', id);

export async function setAssignee(orderId: string, staffId: string, task: 'tikish' | 'ornatish', on: boolean) {
  if (on) return supabase.from('order_assignees').upsert({ order_id: orderId, staff_id: staffId, task, deleted_at: null }, { onConflict: 'order_id,staff_id,task' });
  return supabase.from('order_assignees').update({ deleted_at: new Date().toISOString() }).eq('order_id', orderId).eq('staff_id', staffId).eq('task', task);
}

export type StaffLite = { id: string; full_name: string; role_id: string };
export async function loadWorkers(): Promise<StaffLite[]> {
  const { data } = await supabase.from('staff').select('id, full_name, role_id').in('role_id', ['tikuvchi', 'usta']).eq('is_active', true).is('deleted_at', null).order('full_name');
  return (data as StaffLite[] | null) ?? [];
}

// ---- Buyurtma tarkibini qoralamaga qaytarish (tahrir, chek, batafsil) ----
type DbItem = {
  id: string; section: Section; product_id: string | null; product_name: string; unit: string | null; quantity: number | string | null;
  unit_price?: number | string; room_id: string | null; opening_id: string | null; linked_from_width?: boolean; auto_sync?: boolean; sort_order?: number;
};
export async function loadOrderDraft(o: OrderListItem, fullAccess: boolean): Promise<Draft> {
  const [rooms, items] = await Promise.all([
    supabase.from('rooms').select('id, name, sort_order, openings(id, kind, height, width, rail_type, color, auto_off, sort_order, deleted_at)').eq('order_id', o.id).is('deleted_at', null).order('sort_order'),
    fullAccess
      ? supabase.from('order_items').select('id, section, product_id, product_name, unit, quantity, unit_price, room_id, opening_id, linked_from_width, auto_sync, sort_order').eq('order_id', o.id).is('deleted_at', null).order('sort_order')
      : supabase.from('work_items').select('id, section, product_name, unit, quantity, room_id, opening_id').eq('order_id', o.id),
  ]);
  if (rooms.error) throw new Error(rooms.error.message);
  if (items.error) throw new Error(items.error.message);
  type DbRoom = { id: string; name: string; openings: { id: string; kind: 'deraza' | 'eshik'; height: string | null; width: string | null; rail_type: string | null; color: string | null; auto_off: Partial<Record<Section, boolean>> | null; sort_order: number; deleted_at: string | null }[] };
  const d = emptyDraft();
  d.orderId = o.id;
  d.client = { name: o.client_name, address: o.client_address ?? '', phone: o.client_phone ?? '+998', readyDate: o.ready_date ?? '' };
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

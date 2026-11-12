// Ishchilar ish haqi: serverdagi hisob-kitobni o'qish va berilgan pullarni yozish
import { useEffect } from 'react';
import { supabase } from './supabase';

export const MONTH_NAMES = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

export type MonthKey = string; // '2026-11'
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export function monthRange(key: MonthKey): [string, string] {
  const [y, m] = key.split('-').map(Number);
  return [new Date(y, m - 1, 1).toISOString(), new Date(y, m, 1).toISOString()];
}
/** Joriy oydan orqaga 12 oy */
export function monthOptions(now = new Date()) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { key: monthKey(d), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
  });
}

export type WorkerSummary = { staff_id: string; full_name: string; role_id: 'tikuvchi' | 'usta'; is_active: boolean; earned: number; paid: number; balance: number };
export type Work = { order_id: string; order_no: number | null; client_name: string; task: 'tikish' | 'ornatish'; quantity: number; amount: number; earned_at: string; paid: number };
/** Ishning hali to'lanmagan qismi */
export const unpaidOf = (w: Work) => Math.max(0, Math.round((w.amount - w.paid) * 100) / 100);
export type Payout = { id: string; amount: number; paid_at: string; note: string | null; task: 'tikish' | 'ornatish' | null; client_name: string | null; order_no: number | null };
export type WorkerDetail = { works: Work[]; payouts: Payout[]; balance: number };

const num = (v: unknown) => Number(v ?? 0) || 0;

export async function loadSummary(key: MonthKey): Promise<WorkerSummary[]> {
  const [from, to] = monthRange(key);
  const { data, error } = await supabase.rpc('payroll_summary', { p_from: from, p_to: to });
  if (error) throw error;
  return ((data ?? []) as WorkerSummary[]).map((w) => ({ ...w, earned: num(w.earned), paid: num(w.paid), balance: num(w.balance) }));
}

export async function loadDetail(staffId: string, key: MonthKey): Promise<WorkerDetail> {
  const [from, to] = monthRange(key);
  const { data, error } = await supabase.rpc('payroll_detail', { p_staff: staffId, p_from: from, p_to: to });
  if (error) throw error;
  const d = data as WorkerDetail;
  return {
    works: (d.works ?? []).map((w) => ({ ...w, quantity: num(w.quantity), amount: num(w.amount), paid: num(w.paid) })),
    payouts: (d.payouts ?? []).map((p) => ({ ...p, amount: num(p.amount) })),
    balance: num(d.balance),
  };
}

export const addPayout = (staffId: string, amount: number, note: string) =>
  supabase.from('worker_payouts').insert({ staff_id: staffId, amount, note: note.trim() || null });
/** Aynan shu ish uchun to'lash (to'lanmagan qismi) */
export const payJobs = (staffId: string, works: Work[]) =>
  supabase.from('worker_payouts').insert(works.filter((w) => unpaidOf(w) > 0)
    .map((w) => ({ staff_id: staffId, amount: unpaidOf(w), order_id: w.order_id, task: w.task })));
export const cancelPayout = (id: string) =>
  supabase.from('worker_payouts').update({ cancelled_at: new Date().toISOString() }).eq('id', id);

/** Ish haqi o'zgarsa (boshqa telefonda bosqich belgilansa, pul berilsa) — darhol qayta o'qish */
export function usePayrollLive(onChange: () => void) {
  useEffect(() => {
    const ch = supabase.channel(`payroll-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_earnings' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_payouts' }, onChange)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

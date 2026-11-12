// Xarajatlar va sof foyda
import { useEffect } from 'react';
import { supabase } from './supabase';

export type ExpenseCategory = { id: string; name: string; sort_order: number; is_default: boolean };
export type Expense = { id: string; category_id: string; amount: number; spent_on: string; note: string | null; order_id: string | null };
export type Profit = { income: number; expenses: number; payroll: number; paid_out: number; profit: number; categories: { name: string; amount: number }[] };
export type OrderProfit = { total: number; expenses: number; payroll: number; profit: number };

const num = (v: unknown) => Number(v ?? 0) || 0;
/** Mahalliy sana (YYYY-MM-DD) */
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function loadCategories(): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase.from('expense_categories').select('id, name, sort_order, is_default').is('deleted_at', null).order('sort_order').order('name');
  if (error) throw error;
  return (data ?? []) as ExpenseCategory[];
}
export async function addCategory(name: string): Promise<ExpenseCategory> {
  const { data, error } = await supabase.from('expense_categories').insert({ name: name.trim(), sort_order: 50 }).select('id, name, sort_order, is_default').single();
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Bunday tur allaqachon bor' : error.message);
  return data as ExpenseCategory;
}

/** Oy oralig'idagi xarajatlar: [from, to) — mahalliy sana */
export async function loadExpenses(from: string, to: string): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses').select('id, category_id, amount, spent_on, note, order_id')
    .is('deleted_at', null).gte('spent_on', from).lt('spent_on', to).order('spent_on', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Expense[]).map((e) => ({ ...e, amount: num(e.amount) }));
}
export const addExpense = (e: { category_id: string; amount: number; spent_on: string; note: string; order_id: string | null }) =>
  supabase.from('expenses').insert({ ...e, note: e.note.trim() || null });
export const deleteExpense = (id: string) => supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id);

export async function loadProfit(from: Date, to: Date): Promise<Profit> {
  const { data, error } = await supabase.rpc('profit_report', { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw error;
  const d = data as Profit;
  return { income: num(d.income), expenses: num(d.expenses), payroll: num(d.payroll), paid_out: num(d.paid_out), profit: num(d.profit),
    categories: (d.categories ?? []).map((c) => ({ name: c.name, amount: num(c.amount) })) };
}
export async function loadOrderProfit(orderId: string): Promise<OrderProfit | null> {
  const { data, error } = await supabase.rpc('order_profit', { p_order: orderId });
  if (error || !data) return null;
  const d = data as OrderProfit;
  return { total: num(d.total), expenses: num(d.expenses), payroll: num(d.payroll), profit: num(d.profit) };
}

/** Xarajat, to'lov yoki ish haqi o'zgarsa — qayta o'qish */
export function useMoneyLive(onChange: () => void) {
  useEffect(() => {
    const ch = supabase.channel(`money-${Math.random().toString(36).slice(2)}`);
    for (const table of ['expenses', 'expense_categories', 'payments', 'worker_earnings', 'orders']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

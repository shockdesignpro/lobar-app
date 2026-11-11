import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { emptyDraft, isDraftEmpty, type CatalogItem, type Draft } from './model';

const KEY = 'lobar.draft';
const USAGE = 'lobar.usage';
export const newId = () => randomUUID();

export async function loadDraft(): Promise<Draft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return isDraftEmpty(d) ? null : d;
  } catch { return null; }
}
export async function clearDraft() {
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Qoralama: har o'zgarishda telefonga saqlanadi, ilova yopilsa ham yo'qolmaydi. */
export function useDraft(initial: Draft | null) {
  const [draft, setDraftState] = useState<Draft>(initial ?? emptyDraft());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setDraft = useCallback((fn: (d: Draft) => Draft) => {
    setDraftState((prev) => {
      const next = { ...fn(prev), updatedAt: Date.now() };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {}); }, 300);
      return next;
    });
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return [draft, setDraft] as const;
}

// ---- Eng ko'p ishlatilgan mahsulotlar (tezkor qo'shish) ----
export async function loadUsage(): Promise<Record<string, number>> {
  try { return JSON.parse((await AsyncStorage.getItem(USAGE)) ?? '{}'); } catch { return {}; }
}
export async function bumpUsage(productIds: string[]) {
  const u = await loadUsage();
  productIds.forEach((id) => { u[id] = (u[id] ?? 0) + 1; });
  try { await AsyncStorage.setItem(USAGE, JSON.stringify(u)); } catch { /* ignore */ }
}

// ---- Makroslar ----
export type Macro = { id: string; kind: 'baget' | 'potolok'; name: string; product_ids: string[] };
export async function loadMacros(): Promise<Macro[]> {
  const { data } = await supabase.from('macros').select('id, kind, name, product_ids').is('deleted_at', null).order('sort_order');
  const list = (data as Macro[] | null) ?? [];
  const defaults: Macro[] = [
    { id: 'baget', kind: 'baget', name: 'Baget', product_ids: [] },
    { id: 'potolok', kind: 'potolok', name: 'Potolok karniz', product_ids: [] },
  ];
  return defaults.map((d) => list.find((m) => m.kind === d.kind) ?? d);
}

// ---- Saqlash ----
export async function saveDraftToServer(d: Draft, catalog: CatalogItem[]) {
  const payload = {
    order_id: d.orderId,
    client: { name: d.client.name.trim(), phone: d.client.phone, address: d.client.address.trim() },
    ready_date: d.client.readyDate || null,
    rooms: d.rooms.map((r, i) => ({
      id: r.id, name: r.name, sort_order: i,
      openings: r.openings.map((o, j) => ({
        id: o.id, kind: o.kind, height: o.height, width: o.width, rail_type: o.rail, color: o.color, auto_off: o.autoOff ?? {}, sort_order: j,
      })),
    })),
    items: d.rows.map((row, i) => ({
      id: row.id, room_id: row.roomId, opening_id: row.openingId ?? row.linkOpening, section: row.section,
      product_id: catalog.some((p) => p.id === row.productId) ? row.productId : null,
      product_name: row.productName, unit: row.unit, quantity: row.qty ?? 0, unit_price: row.price,
      linked_from_width: !!row.linkOpening, auto_sync: row.autoSync, sort_order: i,
    })),
  };
  const { data, error } = await supabase.rpc('save_order', { p: payload });
  if (error) throw new Error(error.message);
  await bumpUsage(d.rows.map((r) => r.productId).filter((x): x is string => !!x));
  return data as { id: string; order_year: number; order_no: number; total: number };
}

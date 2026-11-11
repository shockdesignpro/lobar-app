import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheGet, cacheSet, perform } from '../offline';
import type { OrderListItem } from '../orders';
import { supabase } from '../supabase';
import { emptyDraft, isDraftEmpty, totals, type CatalogItem, type Draft } from './model';

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
  const { data, error } = await supabase.from('macros').select('id, kind, name, product_ids').is('deleted_at', null).order('sort_order');
  let list = (data as Macro[] | null) ?? [];
  if (error) list = (await cacheGet<Macro[]>('macros')) ?? [];
  else void cacheSet('macros', list);
  const defaults: Macro[] = [
    { id: 'baget', kind: 'baget', name: 'Baget', product_ids: [] },
    { id: 'potolok', kind: 'potolok', name: 'Potolok karniz', product_ids: [] },
  ];
  return defaults.map((d) => list.find((m) => m.kind === d.kind) ?? d);
}

// ---- Saqlash ----
export type SaveResult = { id: string; order_year: number | null; order_no: number | null; total: number; queued: boolean };

/**
 * Buyurtmani saqlaydi. Buyurtma id'si shu yerda yaratiladi, shuning uchun internet bo'lmasa ham
 * buyurtma navbatga tushadi va ro'yxatda darhol ko'rinadi; internet qaytganda serverga yuboriladi.
 * Yangi andoza rasmlari avval Storage'ga yuklanadi, keyin buyurtma yoziladi.
 */
export async function saveDraftToServer(d: Draft, catalog: CatalogItem[], existing?: OrderListItem | null): Promise<SaveResult> {
  const orderId = d.orderId ?? newId();
  const photos = d.photos ?? [];
  const uploads: { path: string; data: string }[] = [];
  const paths = photos.map((p) => {
    if (p.path) return p.path;
    const path = `${orderId}/${newId()}.jpg`;
    uploads.push({ path, data: p.uri });
    return path;
  });
  const payload = {
    order_id: orderId,
    client: { name: d.client.name.trim(), phone: d.client.phone, address: d.client.address.trim() },
    ready_date: d.client.readyDate || null,
    photos: paths,
    photo_captions: photos.map((p) => p.caption.trim()),
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
  const total = totals(d).grand;
  const item: OrderListItem = {
    id: orderId, order_no: existing?.order_no ?? null, order_year: existing?.order_year ?? null,
    created_at: existing?.created_at ?? new Date().toISOString(), ready_date: payload.ready_date, total,
    client_name: payload.client.name, client_phone: payload.client.phone, client_address: payload.client.address || null,
    payments: existing?.payments ?? [], steps: existing?.steps ?? {}, assignees: existing?.assignees ?? [],
    photos: paths, photo_captions: payload.photo_captions,
  };
  const saved: Draft = { ...d, orderId, photos: photos.map((p, i) => ({ ...p, path: paths[i] })), step: 1 };
  const r = await perform({ kind: 'save_order', payload, uploads, item, draft: saved }, `${payload.client.name}: buyurtma`);
  void cacheSet(`draft.${orderId}`, saved);
  await bumpUsage(d.rows.map((x) => x.productId).filter((x): x is string => !!x));
  if (r.queued) return { id: orderId, order_year: item.order_year, order_no: item.order_no, total, queued: true };
  const data = r.data as { id: string; order_year: number; order_no: number; total: number };
  return { ...data, total: Number(data.total), queued: false };
}

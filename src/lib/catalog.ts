import { useCallback, useEffect, useState } from 'react';
import { byName } from './format';
import { cacheGet, cacheSet, isNetworkError, setOnline } from './offline';
import { supabase } from './supabase';

export type Section = 'mahsulot' | 'tikish' | 'ustanovka';
export type Product = {
  id: string; legacy_id: number | null; name: string; section: Section; price: number; unit: string; sort_order: number;
  /** Ishchi stavkasi (1 birlik uchun) — faqat tikish va o'rnatish xizmatlarida */
  worker_rate: number;
};

export const SECTION_TITLES: Record<Section, string> = {
  mahsulot: 'Mahsulotlar', tikish: 'Tikish narxlari', ustanovka: 'O‘rnatish narxlari',
};
export const SECTION_SHORT: Record<Section, string> = { mahsulot: 'Mahsulotlar', tikish: 'Tikish', ustanovka: 'O‘rnatish' };
export const SECTION_INITIAL: Record<Section, string> = { mahsulot: 'M', tikish: 'T', ustanovka: 'O' };
export const UNITS = [
  { key: 'm', label: 'Metr (m)' }, { key: 'dona', label: 'Dona' }, { key: 'juft', label: 'Juft' }, { key: 'm²', label: 'Metr kv (m²)' },
];

/** Katalog: bazadan o'qiydi va istalgan qurilmadagi o'zgarishni darhol oladi (realtime). */
export function useProducts() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('products').select('id, legacy_id, name, section, price, unit, sort_order, worker_rate')
      .is('deleted_at', null);
    if (e) {
      // Internet yo'q: oxirgi saqlangan katalog bilan ishlaymiz
      if (isNetworkError(e)) { setOnline(false); const c = await cacheGet<Product[]>('products'); setItems((prev) => prev ?? c ?? []); return; }
      setError(e.message); setItems((prev) => prev ?? []); return;
    }
    setError('');
    const list = ((data ?? []) as Product[]).map((p) => ({ ...p, price: Number(p.price), worker_rate: Number(p.worker_rate ?? 0) })).sort(byName);
    void cacheSet('products', list);
    setItems(list);
  }, []);

  useEffect(() => {
    cacheGet<Product[]>('products').then((c) => { if (c) setItems((prev) => prev ?? c); });
    load();
    const ch = supabase.channel(`catalog-products-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return { items, error, reload: load };
}

/** Internetsiz ishlash uchun katalogni oldindan telefonga saqlab qo'yadi */
export async function prefetchCatalog() {
  const { data, error } = await supabase.from('products').select('id, legacy_id, name, section, price, unit, sort_order, worker_rate').is('deleted_at', null);
  if (!error) await cacheSet('products', ((data ?? []) as Product[]).map((p) => ({ ...p, price: Number(p.price), worker_rate: Number(p.worker_rate ?? 0) })).sort(byName));
}

export async function saveProduct(p: { id?: string; name: string; section: Section; price: number; unit: string; worker_rate: number }) {
  if (p.id) {
    return supabase.from('products').update({ name: p.name, section: p.section, price: p.price, unit: p.unit, worker_rate: p.section === 'mahsulot' ? 0 : p.worker_rate }).eq('id', p.id);
  }
  return supabase.from('products').insert({ name: p.name, section: p.section, price: p.price, unit: p.unit, worker_rate: p.section === 'mahsulot' ? 0 : p.worker_rate });
}

/** O'chirish = arxivga yuborish (deleted_at). Eski buyurtmalardagi narxlar o'zgarmaydi. */
export const archiveProduct = (id: string) =>
  supabase.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', id);
export const restoreProduct = (id: string) =>
  supabase.from('products').update({ deleted_at: null }).eq('id', id);

// ---- CSV (eski Lobar-katalog.csv formati bilan mos: "ID";"Nomi";"Bolim";"Narx";"Birlik") ----
export function catalogCSV(items: Product[]) {
  const cell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+@-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const rows = [['ID', 'Nomi', 'Bolim', 'Narx', 'Birlik'], ...items.slice().sort(byName).map((p) => [p.legacy_id ?? '', p.name, p.section, p.price, p.unit])];
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ';') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cur); cur = ''; if (row.some((x) => x !== '')) rows.push(row); row = [];
    } else cur += c;
  }
  row.push(cur); if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

export type CsvItem = { legacy_id: number | null; name: string; section: Section; price: number; unit: string };
export function parseCatalogCSV(text: string): CsvItem[] {
  const rows = parseCSVRows(text);
  if (!rows.length || rows.shift()!.join('|') !== 'ID|Nomi|Bolim|Narx|Birlik') throw new Error('Ustunlar: ID;Nomi;Bolim;Narx;Birlik');
  const seen = new Set<string>();
  return rows.map((r0, i) => {
    if (r0.length !== 5) throw new Error(`${i + 2}-qator: 5 ta ustun kerak`);
    const r = r0.map((v) => v.trim().replace(/^'(?=[=+@-])/, ''));
    const price = Number(r[3].replace(/\s/g, '').replace(',', '.'));
    if (!r[1] || !r[4] || !['mahsulot', 'tikish', 'ustanovka'].includes(r[2]) || !r[3] || !Number.isFinite(price) || price < 0) {
      throw new Error(`${i + 2}-qator ma’lumotlari noto‘g‘ri`);
    }
    if (r[0] && (!/^\d+$/.test(r[0]) || seen.has(r[0]))) throw new Error(`${i + 2}-qator: ID noto‘g‘ri yoki takrorlangan`);
    if (r[0]) seen.add(r[0]);
    return { legacy_id: r[0] ? Number(r[0]) : null, name: r[1], section: r[2] as Section, price, unit: r[4] };
  });
}

/** Import: ID bo'yicha mavjudini yangilaydi, aks holda nomi bo'yicha, topilmasa yangi qo'shadi. */
export async function importCatalog(items: CsvItem[], existing: Product[]) {
  let updated = 0, added = 0;
  for (const it of items) {
    const match = (it.legacy_id != null && existing.find((p) => p.legacy_id === it.legacy_id))
      || existing.find((p) => p.name.trim().toLowerCase() === it.name.trim().toLowerCase());
    if (match) {
      const { error } = await supabase.from('products').update({ name: it.name, section: it.section, price: it.price, unit: it.unit }).eq('id', match.id);
      if (error) throw error; updated++;
    } else {
      let { error } = await supabase.from('products').insert({ legacy_id: it.legacy_id, name: it.name, section: it.section, price: it.price, unit: it.unit });
      if (error?.code === '23505') {
        // Bu ID arxivdagi mahsulotda band: ID'siz qo'shamiz
        ({ error } = await supabase.from('products').insert({ name: it.name, section: it.section, price: it.price, unit: it.unit }));
      }
      if (error) throw error; added++;
    }
  }
  return { updated, added };
}

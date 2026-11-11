// ============================================================
// Eski ilovadan ko'chirish: "Zaxira olish" tugmasi bergan parda_zaxira_YYYYMMDD.json fayli.
// Buyurtmalar (mijoz, xonalar, xarajatlar), to'lovlar, ish holati va andoza rasmlari serverga yoziladi.
// Asl yaratilgan sana va chek raqami saqlanadi (raqam band bo'lsa — yangisi beriladi).
// Har bir yozuvning id'si eski id'dan hosil qilinadi: faylni ikki marta yuklasangiz ham ikkilanmaydi.
// Faqat Admin bajara oladi (serverda ham tekshiriladi).
// ============================================================
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import type { Product } from './catalog';
import { uploadPhoto } from './offline';
import { STEP_GROUP, type StepKey } from './orders';
import { supabase } from './supabase';

type Old = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const arr = (v: unknown): Old[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') as Old[] : []);
const obj = (v: unknown): Old => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Old) : {});
const SECTIONS = ['mahsulot', 'tikish', 'ustanovka'] as const;

export type OldBackup = { orders: Old[]; products: Old[] };
export type ImportSummary = { orders: number; payments: number; photos: number; skipped: number };

export function parseBackup(text: string): OldBackup {
  let data: Old;
  try { data = JSON.parse(text); } catch { throw new Error('Fayl o‘qilmadi — bu JSON fayl emas.'); }
  if (!data || typeof data !== 'object' || (data.app && data.app !== 'parda_kalkulyatori') || !Array.isArray(data.orders)) {
    throw new Error('Bu Lobar Parda zaxira fayli emas.');
  }
  return { orders: arr(data.orders).filter((o) => typeof o.id === 'string' || typeof o.id === 'number'), products: arr(data.products) };
}

export function summarize(b: OldBackup): ImportSummary {
  let payments = 0, photos = 0, skipped = 0;
  for (const o of b.orders) {
    if (!SECTIONS.some((s) => arr(obj(o.rows)[s]).length)) { skipped++; continue; }
    payments += arr(o.payments).filter((p) => num(p.amount) > 0).length;
    photos += andoza(o).length;
  }
  return { orders: b.orders.length - skipped, payments, photos, skipped };
}

function andoza(o: Old) {
  return (Array.isArray(o.andoza) ? o.andoza : []).map((a) => {
    const src = typeof a === 'string' ? a : str(obj(a).src);
    return /^data:image\//i.test(src) ? { src, caption: typeof a === 'string' ? '' : str(obj(a).caption) } : null;
  }).filter((x): x is { src: string; caption: string } => !!x);
}

/** Eski id'dan barqaror UUID (har safar bir xil chiqadi) */
async function uuidFrom(key: string) {
  const h = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `lobar-import:${key}`);
  const v = `5${h.slice(13, 16)}`;
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${v}-${variant}-${h.slice(20, 32)}`;
}

export async function runImport(b: OldBackup, catalog: Product[], onProgress: (done: number, total: number) => void): Promise<{ summary: ImportSummary; errors: string[] }> {
  const errors: string[] = [];
  const summary: ImportSummary = { orders: 0, payments: 0, photos: 0, skipped: 0 };
  const oldProducts = new Map(b.products.map((p) => [num(p.id), p]));
  const findProduct = (prodId: unknown, name: string) => {
    const legacy = num(prodId, NaN);
    return catalog.find((p) => p.legacy_id === legacy) ?? catalog.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;
  };
  const list = b.orders;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    onProgress(i, list.length);
    const name = str(o.ism).trim() || 'Mijoz';
    try {
      const key = str(o.id);
      const orderId = await uuidFrom(`order:${key}`);
      const created = new Date(num(o.date, Date.now()));
      const roomIds = new Map<string, string>();
      const openIds = new Map<string, string>();
      const rooms = [];
      for (const [ri, r] of arr(o.rooms).entries()) {
        const rid = await uuidFrom(`room:${key}:${str(r.id)}`);
        roomIds.set(str(r.id), rid);
        const openings = [];
        for (const [pi, p] of arr(r.pardalar).entries()) {
          const pid = await uuidFrom(`op:${key}:${str(p.id)}`);
          openIds.set(str(p.id), pid);
          const off = obj(p.autoOff);
          openings.push({ id: pid, kind: p.tur === 'eshik' ? 'eshik' : 'deraza', height: str(p.boyi), width: str(p.eni),
            rail_type: str(p.karniz) || 'Truba', color: str(p.rang) || 'Oq', auto_off: { tikish: !!off.tikish, ustanovka: !!off.ustanovka }, sort_order: pi });
        }
        rooms.push({ id: rid, name: str(r.nomi) || `Xona ${ri + 1}`, sort_order: ri, openings });
      }
      const items = [];
      let n = 0;
      for (const s of SECTIONS) {
        for (const [ri, row] of arr(obj(o.rows)[s]).entries()) {
          const rowName = str(row.name) || '?';
          const prod = findProduct(row.prodId, rowName);
          const linked = row.linkParda != null && row.linkParda !== '' ? openIds.get(str(row.linkParda)) ?? null : null;
          const cost = row.costPardaId != null && row.costPardaId !== '' ? openIds.get(str(row.costPardaId)) ?? null : null;
          items.push({
            id: await uuidFrom(`item:${key}:${s}:${ri}`),
            room_id: row.roomId != null && row.roomId !== '' ? roomIds.get(str(row.roomId)) ?? null : null,
            opening_id: cost ?? linked, section: s,
            product_id: prod?.id ?? null, product_name: prod?.name ?? rowName,
            unit: prod?.unit ?? str(oldProducts.get(num(row.prodId))?.unit), quantity: num(row.miqdor), unit_price: num(row.price),
            linked_from_width: !!linked && !cost, auto_sync: row.autoSync !== false && !!linked, sort_order: n++,
          });
        }
      }
      if (!items.length) { summary.skipped++; continue; }

      // Andozalar
      const photos = andoza(o);
      const paths: string[] = [];
      for (const [pi, p] of photos.entries()) {
        const path = `${orderId}/old-${pi + 1}.jpg`;
        const r = await uploadPhoto(path, p.src);
        if (r.ok) { paths.push(path); summary.photos++; } else errors.push(`${name}: rasm yuklanmadi (${r.message})`);
      }
      const caps = photos.filter((_, pi) => paths.includes(`${orderId}/old-${pi + 1}.jpg`)).map((p) => p.caption);

      const { error } = await supabase.rpc('save_order', { p: {
        order_id: orderId, imported: true, created_at: created.toISOString(),
        order_year: created.getFullYear(), order_no: num(o.receiptNumber, 0) || null,
        client: { name, phone: str(o.tel), address: str(o.manzil) }, ready_date: /^\d{4}-\d{2}-\d{2}$/.test(str(o.tayyorSana)) ? str(o.tayyorSana) : null,
        photos: paths, photo_captions: caps, rooms, items,
      } });
      if (error) { errors.push(`${name}: ${error.message}`); continue; }
      summary.orders++;

      // To'lovlar
      const pays = [];
      for (const [pi, p] of arr(o.payments).entries()) {
        if (num(p.amount) <= 0) continue;
        pays.push({ id: await uuidFrom(`pay:${key}:${pi}`), order_id: orderId, amount: num(p.amount),
          paid_at: new Date(num(p.date, 0) || created.getTime()).toISOString() });
      }
      if (pays.length) {
        const r = await supabase.from('payments').upsert(pays, { onConflict: 'id', ignoreDuplicates: true });
        if (r.error) errors.push(`${name}: to‘lovlar yozilmadi (${r.error.message})`); else summary.payments += pays.length;
      }
      // Ish holati
      const st = obj(o.status);
      const steps = (Object.keys(STEP_GROUP) as StepKey[]).filter((k) => !!st[k]).map((k) => ({ order_id: orderId, step_key: k, done: true, deleted_at: null }));
      if (steps.length) {
        const r = await supabase.from('order_steps').upsert(steps, { onConflict: 'order_id,step_key' });
        if (r.error) errors.push(`${name}: holat yozilmadi (${r.error.message})`);
      }
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  onProgress(list.length, list.length);
  return { summary, errors };
}

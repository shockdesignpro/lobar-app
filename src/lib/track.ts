// Mijoz uchun kuzatish havolasi: https://parda.expo.app/?t=<kod>
// Kod — buyurtma id'sining (tasodifiy uuid) qisqa yozuvi, 22 belgi. Bazada track_order(kod).
import { supabase } from './supabase';

export const TRACK_BASE = 'https://parda.expo.app/';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function trackToken(orderId: string): string {
  const hex = orderId.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return orderId;
  const bytes = hex.match(/../g)!.map((h) => parseInt(h, 16));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
  }
  return out;
}
export const trackUrl = (orderId: string) => `${TRACK_BASE}?t=${trackToken(orderId)}`;

/** Brauzer manzilida ?t= bo'lsa — kuzatish kodi */
export function trackTokenFromUrl(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const t = new URLSearchParams(window.location.search).get('t');
  return t && /^[A-Za-z0-9_-]{10,40}$/.test(t) ? t : null;
}

export type TrackStep = { key: string; label: string; done: boolean; started?: boolean; at: string | null };
export type TrackItem = { section: 'mahsulot' | 'tikish' | 'ustanovka'; name: string; unit: string | null; qty: number | null; price: number; opening: string | null };
export type TrackOpening = { id: string; kind: 'deraza' | 'eshik'; height: string | null; width: string | null; rail: string | null; color: string | null };
export type TrackData =
  | { closed: true; order_no: number | null; client: string }
  | {
      closed: false; order_no: number | null; order_year: number | null; client: string; created_at: string; ready_date: string | null;
      steps: TrackStep[]; total: number; discount_percent: number; paid: number; remaining: number;
      rooms: { name: string; openings: TrackOpening[]; items: TrackItem[] }[]; general: TrackItem[];
      atelier: { phone: string | null; address: string | null };
    };

export async function fetchTrack(token: string): Promise<TrackData | null> {
  const { data, error } = await supabase.rpc('track_order', { p_token: token });
  if (error) throw error;
  return (data as TrackData | null) ?? null;
}

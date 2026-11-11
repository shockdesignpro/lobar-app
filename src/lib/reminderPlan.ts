// Topshirish eslatmalari: topshirishdan bir kun oldin va topshirish kuni, tanlangan soatda
// (eski ilovadagidek, standart 10:00). O'rnatilgan buyurtmalar bezovta qilmaydi.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stage, type OrderListItem } from './orders';

export type ReminderPrefs = { enabled: boolean; time: string };
const KEY = 'lobar.reminders';
export const DEFAULT_PREFS: ReminderPrefs = { enabled: true, time: '10:00' };

let prefs: ReminderPrefs | null = null;
const listeners = new Set<() => void>();
export async function loadReminderPrefs(): Promise<ReminderPrefs> {
  if (prefs) return prefs;
  try { prefs = { ...DEFAULT_PREFS, ...JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') }; } catch { prefs = { ...DEFAULT_PREFS }; }
  return prefs!;
}
export async function saveReminderPrefs(p: ReminderPrefs) {
  prefs = p;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
  listeners.forEach((f) => f());
}
export function onReminderPrefs(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

export type ReminderEntry = { id: string; orderId: string; at: Date; title: string; body: string };

/** Kelajakdagi barcha eslatmalar (eng yaqinidan) */
export function reminderEntries(orders: OrderListItem[], time: string, now = new Date()): ReminderEntry[] {
  const [hh, mm] = time.split(':').map((x) => Number(x) || 0);
  const out: ReminderEntry[] = [];
  for (const o of orders) {
    if (!o.ready_date || !/^\d{4}-\d{2}-\d{2}$/.test(o.ready_date) || stage(o) === 'O‘rnatildi') continue;
    const [y, m, d] = o.ready_date.split('-').map(Number);
    const day = new Date(y, m - 1, d, hh, mm, 0, 0);
    const before = new Date(y, m - 1, d - 1, hh, mm, 0, 0);
    const who = o.client_name + (o.client_phone ? ` · ${o.client_phone}` : '');
    if (before > now) out.push({ id: `${o.id}:1`, orderId: o.id, at: before, title: 'Ertaga buyurtma topshirish', body: who });
    if (day > now) out.push({ id: `${o.id}:0`, orderId: o.id, at: day, title: 'Bugun buyurtma topshirish', body: who });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
/** Taqvim fayli (.ics) — eski ilovadagi bilan bir xil */
export function calendarText(orders: OrderListItem[], time: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lobar Parda//UZ', 'CALSCALE:GREGORIAN'];
  for (const o of orders) {
    if (!o.ready_date || !/^\d{4}-\d{2}-\d{2}$/.test(o.ready_date) || stage(o) === 'O‘rnatildi') continue;
    lines.push('BEGIN:VEVENT', `UID:lobar-${esc(o.id)}@parda`, `DTSTAMP:${stamp}`,
      `DTSTART:${o.ready_date.replace(/-/g, '')}T${time.replace(':', '')}00`, 'DURATION:PT30M',
      `SUMMARY:${esc(`Buyurtma topshirish: ${o.client_name}`)}`, `DESCRIPTION:${esc(`Telefon: ${o.client_phone ?? ''}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', 'DESCRIPTION:Ertaga buyurtma topshirish', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', 'DESCRIPTION:Bugun buyurtma topshirish', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

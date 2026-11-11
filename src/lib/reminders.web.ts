// Brauzer (PWA): brauzer yopiq paytda rejalashtirilgan bildirishnoma chiqara olmaydi.
// Shuning uchun: 1) ilova ochilganda (kuniga bir marta) bugungi va ertangi topshirishlar haqida
// bildirishnoma; 2) eski ilovadagidek — taqvimga (.ics) eksport, telefon taqvimi o'zi eslatadi.
import type { OrderListItem } from './orders';
import { calendarText, type ReminderEntry } from './reminderPlan';

export const remindersKind = 'web' as const;
const hasApi = () => typeof window !== 'undefined' && 'Notification' in window;

export async function permissionState(): Promise<'granted' | 'denied' | 'ask'> {
  if (!hasApi()) return 'denied';
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'ask';
}
export async function requestPermission(): Promise<boolean> {
  if (!hasApi()) return false;
  return (await Notification.requestPermission()) === 'granted';
}

const DAY_KEY = 'lobar.reminders.shown';
export async function applyReminders(entries: ReminderEntry[]) {
  if (!hasApi() || Notification.permission !== 'granted') return;
  const now = new Date();
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  try { if (localStorage.getItem(DAY_KEY) === today) return; } catch { /* ignore */ }
  // Bugun yoki ertaga topshiriladiganlar (eslatma vaqti bugun kelgan/keladigan)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const soon = entries.filter((e) => e.at < end);
  const todayCount = new Set(soon.filter((e) => e.title.startsWith('Bugun')).map((e) => e.orderId)).size;
  const tomorrowCount = new Set(soon.filter((e) => e.title.startsWith('Ertaga')).map((e) => e.orderId)).size;
  if (!todayCount && !tomorrowCount) return;
  const parts = [todayCount ? `bugun ${todayCount} ta` : '', tomorrowCount ? `ertaga ${tomorrowCount} ta` : ''].filter(Boolean).join(', ');
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    const opts = { body: `Topshiriladigan buyurtmalar: ${parts}.`, icon: '/icons/icon-192.png', tag: 'lobar-due' };
    if (reg) await reg.showNotification('Lobar Parda', opts); else new Notification('Lobar Parda', opts);
    localStorage.setItem(DAY_KEY, today);
  } catch { /* ignore */ }
}
export async function clearReminders() { /* brauzerda rejalashtirilgan eslatma yo'q */ }

export function exportCalendar(orders: OrderListItem[], time: string) {
  const blob = new Blob([calendarText(orders, time)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'Lobar-eslatmalar.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

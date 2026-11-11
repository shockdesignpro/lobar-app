// Buyurtmalar o'zgarganda eslatmalar rejasini yangilab turadi (ko'rinmas komponent).
import { useEffect, useRef, useState } from 'react';
import { can, type Access } from './auth';
import { useOrders } from './orders';
import { loadReminderPrefs, onReminderPrefs, reminderEntries, type ReminderPrefs } from './reminderPlan';
import { applyReminders, clearReminders } from './reminders';

export function RemindersSync({ access }: { access: Access }) {
  const { items } = useOrders(can(access, 'orders.view_all'));
  const [prefs, setPrefs] = useState<ReminderPrefs | null>(null);
  const last = useRef('');
  useEffect(() => {
    const read = () => { loadReminderPrefs().then((p) => setPrefs({ ...p })); };
    read();
    return onReminderPrefs(read);
  }, []);
  useEffect(() => {
    if (!items || !prefs) return;
    const timer = setTimeout(() => {
      if (!prefs.enabled) { if (last.current !== 'off') { last.current = 'off'; void clearReminders(); } return; }
      const entries = reminderEntries(items, prefs.time);
      const sig = prefs.time + entries.map((e) => `${e.id}@${e.at.getTime()}|${e.body}`).join(',');
      if (sig === last.current) return;
      last.current = sig;
      void applyReminders(entries).catch(() => { last.current = ''; });
    }, 1500);
    return () => clearTimeout(timer);
  }, [items, prefs]);
  return null;
}

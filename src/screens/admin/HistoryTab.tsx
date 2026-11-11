import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Card, Loading, Note } from '../../ui/components';
import { useTheme } from '../../ui/ThemeContext';

type Ev = { id: number; at: string; staff_id: string | null; table_name: string; action: string };

const TABLES: Record<string, string> = {
  staff: 'Xodim', staff_secrets: 'Kod', permissions: 'Ruxsat', staff_overrides: 'Shaxsiy ruxsat', app_settings: 'Sozlama',
  products: 'Katalog', macros: 'Makros', clients: 'Mijoz', orders: 'Buyurtma', order_assignees: 'Biriktirish',
  rooms: 'Xona', openings: 'Deraza', order_items: 'Xarajat', order_steps: 'Ish bosqichi', payments: 'To‘lov',
};
const ACTIONS: Record<string, string> = {
  INSERT: 'qo‘shildi', UPDATE: 'o‘zgartirildi', DELETE: 'o‘chirildi', LOGIN: 'tizimga kirdi',
  LOGIN_LOCKED: 'bloklandi (ko‘p noto‘g‘ri urinish)', CODE_CHANGE: 'almashtirildi',
};

export function HistoryTab() {
  const { t } = useTheme();
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const [e, s] = await Promise.all([
        supabase.from('audit_log').select('id, at, staff_id, table_name, action').order('at', { ascending: false }).limit(60),
        supabase.from('staff').select('id, full_name'),
      ]);
      if (e.error) setErr(e.error.message);
      setEvents((e.data as Ev[]) ?? []);
      const n: Record<string, string> = {};
      (s.data ?? []).forEach((x: { id: string; full_name: string }) => { n[x.id] = x.full_name; });
      setNames(n);
    })();
  }, []);

  if (!events) return <Loading />;
  if (err) return <Note tone="error">{err}</Note>;

  return (
    <View style={{ gap: 8 }}>
      <Note>Oxirgi 60 ta o‘zgarish. Arxiv va to‘liq qidiruv keyingi bosqichda qo‘shiladi.</Note>
      {events.length === 0 && <Card><Text style={{ color: t.muted }}>Hali o‘zgarish yo‘q.</Text></Card>}
      {events.map((e) => {
        const d = new Date(e.at);
        const when = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const who = e.staff_id ? names[e.staff_id] ?? 'Xodim' : 'Tizim';
        const what = e.action.startsWith('LOGIN') ? `${who} ${ACTIONS[e.action]}` : `${TABLES[e.table_name] ?? e.table_name} ${ACTIONS[e.action] ?? e.action}`;
        return (
          <Card key={e.id} padded={false} style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: t.text }}>{what}</Text>
              <Text style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{who}</Text>
            </View>
            <Text style={{ fontSize: 11, color: t.muted }}>{when}</Text>
          </Card>
        );
      })}
    </View>
  );
}

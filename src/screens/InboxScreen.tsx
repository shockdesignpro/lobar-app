// Bildirishnomalar: menga kelgan barcha xabarlar (ilovaga kirmagan paytdagilari ham)
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Access } from '../lib/auth';
import { loadInbox, markAllRead, type InboxItem } from '../lib/inbox';
import { ReminderSettings } from './ReminderSettings';
import { isNetworkError } from '../lib/offline';
import { Card, Intro, Loading, Note } from '../ui/components';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ui/ThemeContext';
import { EmptyCard } from './home/CompactOrder';

const when = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} · ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function InboxScreen({ access, onOpen }: { access: Access; onOpen: (t: { orderId?: string; screen?: string }) => void }) {
  const { t } = useTheme();
  const [list, setList] = useState<InboxItem[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    loadInbox()
      .then((l) => { setList(l); if (l.some((x) => !x.read_at)) void markAllRead(); })
      .catch((e) => { setErr(isNetworkError(e) ? 'Internet yo‘q. Bildirishnomalar internet bilan ko‘rinadi.' : (e as { message?: string }).message ?? 'Xato'); setList([]); });
  }, []);

  return (
    <>
      <ReminderSettings access={access} />
      <Intro overline="XABARLAR" title="Bildirishnomalar" />
      {err ? <Note tone="error">{err}</Note> : null}
      {!list ? <Loading /> : list.length ? (
        <Card padded={false}>
          {list.map((n, i) => {
            const target = n.data?.orderId || n.data?.screen;
            return (
              <Pressable key={n.id} accessibilityRole="button" disabled={!target} onPress={() => onOpen(n.data ?? {})}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: t.divider, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ width: 10, paddingTop: 6 }}>
                  {!n.read_at && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.teal }} />}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: n.read_at ? '600' : '800', color: t.text }} numberOfLines={1}>{n.title}</Text>
                    <Text style={{ fontSize: 11, color: t.muted }}>{when(n.created_at)}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: t.muted, lineHeight: 18 }}>{n.body}</Text>
                </View>
                {!!target && <View style={{ justifyContent: 'center' }}><Icon name="chevron" color={t.muted} size={16} /></View>}
              </Pressable>
            );
          })}
        </Card>
      ) : <EmptyCard title="Bildirishnoma yo‘q" text="Sizga biriktirilgan buyurtma va to‘lovlar haqidagi xabarlar shu yerda turadi." />}
    </>
  );
}

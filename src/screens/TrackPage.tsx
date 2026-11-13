// Mijoz uchun kuzatish sahifasi (kirishsiz): https://parda.expo.app/?t=<kod>
// Pardasi qaysi bosqichda, qachon tayyor bo'ladi, to'lov holati va buyurtma tarkibi.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { fmtN } from '../lib/format';
import { mqText, openingLabel, type Opening } from '../lib/order/model';
import { fetchTrack, type TrackData, type TrackItem, type TrackOpening } from '../lib/track';
import { Icon, type IconName } from '../ui/Icon';

// Mijoz sahifasi doim yorug' rangda (telefon tungi rejimida ham chekdagidek)
const C = {
  bg: '#f4f6f5', card: '#ffffff', text: '#1a2420', muted: '#6b8076', border: '#dde8e4', divider: '#edf2f0',
  teal: '#0d7a5f', tealDark: '#095c47', tealLight: '#e6f5f1', amber: '#e8a020', purple: '#6b5fe0', red: '#d94040', redLight: '#fdeaea',
};
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const longDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return `${d.getDate()}-${OYLAR[d.getMonth()]}`;
};
const shortWhen = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}-${OYLAR[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const SECTION: Record<TrackItem['section'], { title: string; color: string; icon: IconName }> = {
  mahsulot: { title: 'Harajatlar', color: C.teal, icon: 'box' },
  tikish: { title: 'Tikish xizmati', color: C.amber, icon: 'scissors' },
  ustanovka: { title: 'O‘rnatish xizmati', color: C.purple, icon: 'wrench' },
};
const sum = (list: TrackItem[]) => list.reduce((n, i) => n + (Number(i.qty) || 0) * Number(i.price), 0);

export function TrackPage({ token }: { token: string }) {
  const [data, setData] = useState<TrackData | null | undefined>(undefined);
  const [err, setErr] = useState(false);

  const load = useCallback(() => {
    fetchTrack(token).then((d) => { setData(d); setErr(false); }).catch(() => setErr(true));
  }, [token]);
  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // har 30 soniyada yangilanadi
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => { if (typeof document !== 'undefined') document.title = 'Buyurtma holati — Lobar pardalar uyi'; }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
      <View style={{ alignItems: 'center', paddingVertical: 8, gap: 2 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: C.teal }}>Lobar</Text>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.muted }}>PARDALAR UYI</Text>
      </View>

      {data === undefined && !err ? (
        <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={C.teal} /></View>
      ) : err && !data ? (
        <Box><Text style={{ fontSize: 15, color: C.text, textAlign: 'center' }}>Internetga ulanib bo‘lmadi. Birozdan keyin sahifani yangilang.</Text></Box>
      ) : !data ? (
        <Box>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, textAlign: 'center' }}>Buyurtma topilmadi</Text>
          <Text style={{ fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 6 }}>Havola noto‘g‘ri yoki buyurtma bekor qilingan.</Text>
        </Box>
      ) : data.closed ? (
        <Box>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" color={C.teal} size={28} strokeWidth={3} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, textAlign: 'center' }}>Buyurtma yakunlangan</Text>
            <Text style={{ fontSize: 13, color: C.muted, textAlign: 'center' }}>Bizni tanlaganingiz uchun rahmat{data.client ? `, ${data.client}` : ''}!</Text>
          </View>
        </Box>
      ) : (
        <Tracked d={data} />
      )}
    </ScrollView>
  );
}

function Tracked({ d }: { d: Extract<TrackData, { closed: false }> }) {
  const current = d.steps.findIndex((s) => !s.done);
  const status = current === -1 ? 'O‘rnatildi' : d.steps[current].label;
  const pct = d.total > 0 ? Math.min(1, d.paid / d.total) : 1;
  const no = d.order_no ? `№${String(d.order_no).padStart(4, '0')}` : '';

  return (
    <>
      {/* Holat */}
      <Box>
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>Buyurtma {no}{d.client ? ` · ${d.client}` : ''}</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, marginTop: 4 }}>{status}</Text>
        {!!d.ready_date && current !== -1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Icon name="calendar" color={C.teal} size={15} />
            <Text style={{ fontSize: 14, color: C.tealDark, fontWeight: '700' }}>Topshirish: {longDate(d.ready_date)}</Text>
          </View>
        )}
        <View style={{ marginTop: 16 }}>
          {d.steps.map((s, i) => {
            const isCur = i === current;
            const last = i === d.steps.length - 1;
            return (
              <View key={s.key} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ alignItems: 'center', width: 26 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: s.done ? C.teal : isCur ? C.tealLight : C.card, borderWidth: s.done ? 0 : 2, borderColor: isCur ? C.teal : C.border }}>
                    {s.done ? <Icon name="check" color="#ffffff" size={14} strokeWidth={3} />
                      : isCur ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.teal }} /> : null}
                  </View>
                  {!last && <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: s.done ? C.teal : C.border }} />}
                </View>
                <View style={{ flex: 1, paddingBottom: last ? 0 : 16, paddingTop: 3 }}>
                  <Text style={{ fontSize: 15, fontWeight: s.done || isCur ? '800' : '600', color: s.done || isCur ? C.text : C.muted }}>{s.label}</Text>
                  {s.done && s.at ? <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{shortWhen(s.at)}</Text>
                    : isCur ? <Text style={{ fontSize: 12, color: C.teal, marginTop: 1, fontWeight: '600' }}>Hozir shu bosqichda</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      </Box>

      {/* To'lov */}
      <Box>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>To‘lov</Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: C.divider, overflow: 'hidden', marginTop: 10 }}>
          <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: C.teal }} />
        </View>
        <Line label="Umumiy summa" value={`${fmtN(d.total)} so‘m`} bold />
        {d.discount_percent > 0 && <Line label="Chegirma" value={`${fmtN(d.discount_percent)}%`} />}
        <Line label="To‘langan" value={`${fmtN(d.paid)} so‘m`} />
        <Line label="Qolgan" value={d.remaining > 0 ? `${fmtN(d.remaining)} so‘m` : 'To‘liq to‘langan ✓'} color={d.remaining > 0 ? C.red : C.teal} bold />
      </Box>

      {/* Tarkib */}
      {d.rooms.map((r, ri) => <RoomBox key={ri} idx={ri} name={r.name} openings={r.openings} items={r.items} />)}
      {d.general.length > 0 && <RoomBox idx={d.rooms.length} name="Umumiy" openings={[]} items={d.general} />}

      {/* Atelye */}
      {(!!d.atelier.phone || !!d.atelier.address) && (
        <Box>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Savollar bo‘lsa</Text>
          {!!d.atelier.address && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Icon name="home" color={C.muted} size={16} />
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{d.atelier.address}</Text>
            </View>
          )}
          {!!d.atelier.phone && (
            <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`tel:${d.atelier.phone!.replace(/[^\d+]/g, '')}`)}
              style={({ pressed }) => ({ marginTop: 12, minHeight: 48, borderRadius: 12, backgroundColor: C.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '800' }}>Qo‘ng‘iroq qilish · {d.atelier.phone}</Text>
            </Pressable>
          )}
        </Box>
      )}
      <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>Ma’lumot avtomatik yangilanib turadi</Text>
    </>
  );
}

function RoomBox({ idx, name, openings, items }: { idx: number; name: string; openings: TrackOpening[]; items: TrackItem[] }) {
  const ops = openings as unknown as Opening[];
  return (
    <Box>
      <Text style={{ fontSize: 16, fontWeight: '800', color: C.tealDark, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: C.teal }}>{idx + 1}. {name}</Text>
      {openings.map((o, i) => (
        <View key={o.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.divider }}>
          <Text style={{ fontSize: 13, color: C.text }}>{openingLabel(ops, i)} <Text style={{ color: C.muted }}>({[o.rail, o.color].filter(Boolean).join(', ')})</Text></Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{o.height} × {o.width} m</Text>
        </View>
      ))}
      {(['mahsulot', 'tikish', 'ustanovka'] as const).map((sec) => {
        const list = items.filter((i) => i.section === sec);
        if (!list.length) return null;
        const meta = SECTION[sec];
        // Bir nechta parda bo'lsa — har biri alohida (chekdagidek)
        const groups = openings.length < 2 ? [{ label: '', list }] : [
          ...openings.map((o, i) => ({ label: openingLabel(ops, i), list: list.filter((x) => x.opening === o.id) })),
          { label: 'Umumiy', list: list.filter((x) => !openings.some((o) => o.id === x.opening)) },
        ].filter((g) => g.list.length);
        return (
          <View key={sec} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: meta.color, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7 }}>
              <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800' }}>{meta.title}</Text>
              <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800' }}>{fmtN(sum(list))} so‘m</Text>
            </View>
            {groups.map((g) => (
              <View key={g.label || 'all'}>
                {!!g.label && <Text style={{ paddingTop: 8, paddingBottom: 3, fontSize: 12, fontWeight: '800', color: C.tealDark }}>{g.label}</Text>}
                {g.list.map((it, k) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.divider }}>
                    <Text style={{ flex: 1, fontSize: 13, color: C.text }}>{it.name}</Text>
                    <Text style={{ fontSize: 12, color: C.muted }}>{fmtN(it.price)} × {mqText(it.qty)}</Text>
                    <Text style={{ width: 80, textAlign: 'right', fontSize: 13, fontWeight: '700', color: C.text }}>{fmtN((Number(it.qty) || 0) * Number(it.price))}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>Xona jami</Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{fmtN(sum(items))} so‘m</Text>
      </View>
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 }}>{children}</View>;
}
function Line({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 }}>
      <Text style={{ fontSize: 14, color: C.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: bold ? '800' : '600', color: color ?? C.text }}>{value}</Text>
    </View>
  );
}

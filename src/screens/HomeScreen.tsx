import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { can, isAdmin, type Access } from '../lib/auth';
import { loadDraft } from '../lib/order/draft';
import type { Draft } from '../lib/order/model';
import { fmtN } from '../lib/format';
import { remaining, stage, useOrders } from '../lib/orders';
import { supabase } from '../lib/supabase';
import { RemindersSheet } from './RemindersSheet';
import { ImportSheet } from './ImportSheet';
import { pendingOps } from '../lib/offline';
import { confirmAsk } from '../ui/confirm';
import { CompactOrder, CurtainArt, EmptyCard, SectionTitle } from './home/CompactOrder';
import { Button, Card, Field, Intro, Note } from '../ui/components';
import { Icon, type IconName } from '../ui/Icon';
import { useTheme } from '../ui/ThemeContext';

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

export type OrdersPreset = { sort?: 'yangi' | 'muddat'; pay?: 'unpaid' };

export function MenuItem({ icon, title, sub, onPress, danger }: { icon: IconName; title: string; sub?: string; onPress: () => void; danger?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 15, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: danger ? t.redLight : t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={danger ? t.red : t.teal} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: danger ? t.red : t.text }}>{title}</Text>
        {sub && <Text style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{sub}</Text>}
      </View>
      {!danger && <Icon name="chevron" color={t.muted} />}
    </Pressable>
  );
}

export function HomeScreen({ access, onOpenAdmin, onSignOut, onNewOrder, onOpenOrder, onShowOrders }: {
  access: Access; onOpenAdmin: () => void; onSignOut: () => void; onNewOrder: (resume: Draft | null) => void;
  onOpenOrder: (id: string) => void; onShowOrders: (preset: OrdersPreset) => void;
}) {
  const { t } = useTheme();
  const d = new Date();
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [remOpen, setRemOpen] = useState(false);
  const [impOpen, setImpOpen] = useState(false);

  const saveCode = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('set_staff_code', { p_staff: access.staff_id, p_code: code });
    setBusy(false);
    if (error) setMsg({ tone: 'error', text: error.message });
    else { setMsg({ tone: 'ok', text: 'Kod almashtirildi.' }); setCode(''); setCodeOpen(false); }
  };

  const showAdmin = isAdmin(access) || can(access, 'staff.manage_workers');
  const canOrder = can(access, 'orders.edit');
  const [draft, setDraftState] = useState<Draft | null>(null);
  useEffect(() => { if (canOrder) loadDraft().then(setDraftState); }, [canOrder]);
  const full = can(access, 'orders.view_all');
  const money = full && can(access, 'prices.view');
  const { items } = useOrders(full);
  const orders = items ?? [];
  const active = orders.filter((o) => stage(o) !== 'O‘rnatildi');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(23, 59, 59, 999);
  const due = active.filter((o) => o.ready_date && new Date(`${o.ready_date}T00:00:00`) <= tomorrow)
    .sort((a, b) => (a.ready_date ?? '').localeCompare(b.ready_date ?? ''));
  const debt = orders.reduce((n, o) => n + remaining(o), 0);
  const recent = orders.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);

  return (
    <>
      <Intro overline={`${d.getDate()} ${MONTHS[d.getMonth()]} · ${DAYS[d.getDay()]}`.toUpperCase()} title={full ? 'Bugungi ishlar' : 'Mening ishlarim'} />

      {full && (
        <>
          <View style={{ borderRadius: 18, backgroundColor: t.tealDark === '#095c47' ? '#0b6a52' : t.tealMid, padding: 20, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: 14 }}>Faol buyurtmalar</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#ffffff' }} />
                <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '700', letterSpacing: 0.6 }}>ISH JARAYONIDA</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View style={{ flexShrink: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
                  <Text style={{ color: '#ffffff', fontSize: 46, fontWeight: '700' }}>{items ? active.length : '…'}</Text>
                  <Text style={{ color: '#ffffff', fontSize: 13 }}>ta buyurtma</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 10 }}>Har bir buyurtma — e’tiborda.</Text>
              </View>
              <CurtainArt color="rgba(255,255,255,0.5)" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Metric title="Yaqin muddat" value={String(due.length)} unit="ta" sub="Bugun va ertaga" onPress={() => onShowOrders({ sort: 'muddat' })} />
            {money && <Metric title="Qarzdorlik" value={fmtN(debt)} unit="so‘m" sub="To‘lov kutilmoqda" onPress={() => onShowOrders({ pay: 'unpaid' })} />}
          </View>
        </>
      )}

      {canOrder && (
        <Pressable accessibilityRole="button" onPress={() => onNewOrder(null)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 15, backgroundColor: t.primaryButton, opacity: pressed ? 0.9 : 1 })}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#ffffff' }}>Yangi buyurtma</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Mijoz va o‘lchamlarni kiriting</Text>
          </View>
          <Icon name="arrowRight" color="#ffffff" />
        </Pressable>
      )}
      {canOrder && draft && (
        <MenuItem icon="file" title="Tugallanmagan buyurtma" sub={`${draft.client.name || 'Ismsiz mijoz'} · davom ettirish`} onPress={() => onNewOrder(draft)} />
      )}

      {full ? (
        <>
          <SectionTitle title="Yaqin topshiriladigan" onAll={() => onShowOrders({ sort: 'muddat' })} />
          {due.length ? due.slice(0, 3).map((o) => <CompactOrder key={o.id} o={o} showMoney={money} onPress={() => onOpenOrder(o.id)} />)
            : <EmptyCard title="Yaqin muddatli buyurtma yo‘q" text="Bugun va ertaga topshiriladigan buyurtmalar shu yerda ko‘rinadi." />}
          <SectionTitle title="Oxirgi buyurtmalar" onAll={() => onShowOrders({ sort: 'yangi' })} />
          {recent.length ? recent.map((o) => <CompactOrder key={o.id} o={o} showMoney={money} onPress={() => onOpenOrder(o.id)} />)
            : <EmptyCard title="Birinchi buyurtmangizni yarating" text="Mijozni kiriting, o‘lchamlarni belgilang va chekni saqlang." />}
        </>
      ) : orders.length ? orders.map((o) => <CompactOrder key={o.id} o={o} showMoney={false} onPress={() => onOpenOrder(o.id)} />)
        : <EmptyCard title="Hozircha ish yo‘q" text="Sizga buyurtma biriktirilganda u shu yerda ko‘rinadi." />}

      <SectionTitle title="Sozlamalar" />
      <View style={{ gap: 10 }}>
        {showAdmin && <MenuItem icon="users" title="Admin panel" sub={isAdmin(access) ? 'Xodimlar, ruxsatlar, tarix' : 'Tikuvchi va ustalar'} onPress={onOpenAdmin} />}
        {isAdmin(access) && <MenuItem icon="cloud" title="Eski ilovadan ko‘chirish" sub="Zaxira faylidagi buyurtmalar va to‘lovlar" onPress={() => setImpOpen(true)} />}
        <MenuItem icon="bell" title="Eslatmalar" sub="Topshirish kuni va bir kun oldin" onPress={() => setRemOpen(true)} />
        <MenuItem icon="key" title="Kodni almashtirish" sub="Shaxsiy kirish kodingiz" onPress={() => { setCodeOpen(!codeOpen); setMsg(null); }} />
        {codeOpen && (
          <Card style={{ gap: 10 }}>
            <Field label="Yangi kod (harf va raqamlar)" value={code} onChangeText={(v) => setCode(v.replace(/\s/g, ''))}
              secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={32} />
            <Note>{access.level >= 100 ? 'Kamida 8 ta belgi, bo‘sh joysiz.' : access.level >= 50 ? 'Kamida 6 ta belgi, bo‘sh joysiz.' : 'Kamida 4 ta belgi, bo‘sh joysiz.'}</Note>
            <Button label="Saqlash" onPress={saveCode} busy={busy} />
          </Card>
        )}
        {msg && <Note tone={msg.tone}>{msg.text}</Note>}
        {impOpen && <ImportSheet visible onClose={() => setImpOpen(false)} />}
        <RemindersSheet visible={remOpen} onClose={() => setRemOpen(false)} access={access} />
        <MenuItem icon="logout" title="Chiqish" sub={`${access.full_name} · ${access.role_name}`} danger onPress={async () => {
          const n = pendingOps().length;
          if (n && !(await confirmAsk(`Internetsiz kiritilgan ${n} ta o‘zgarish hali serverga yuborilmagan. Chiqsangiz, ular yo‘qoladi. Baribir chiqamizmi?`, 'Chiqish'))) return;
          onSignOut();
        }} />
      </View>
    </>
  );
}

function Metric({ title, value, unit, sub, onPress }: { title: string; value: string; unit: string; sub: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${value} ${unit}`} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, gap: 6, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: t.muted }}>{title}</Text>
        <View style={{ transform: [{ rotate: '-45deg' }] }}><Icon name="arrowRight" color={t.teal} size={13} strokeWidth={2.4} /></View>
      </View>
      <Text style={{ fontSize: value.length > 9 ? 17 : 19, fontWeight: '800', color: t.text }} numberOfLines={1}>
        {value}<Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}> {unit}</Text>
      </Text>
      <Text style={{ fontSize: 11, color: t.muted }}>{sub}</Text>
    </Pressable>
  );
}

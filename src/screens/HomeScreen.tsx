import { useCallback, useEffect, useState } from 'react';
import { loadDetail, monthKey } from '../lib/payroll';
import { Pressable, Text, View } from 'react-native';
import { can, type Access } from '../lib/auth';
import { clearDraft, loadDraft } from '../lib/order/draft';
import { confirmAsk } from '../ui/confirm';
import type { Draft } from '../lib/order/model';
import { fmtN } from '../lib/format';
import { remaining, stage, useOrders } from '../lib/orders';
import { CompactOrder, CurtainArt, EmptyCard, SectionTitle } from './home/CompactOrder';
import { Intro } from '../ui/components';
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

export function HomeScreen({ access, onNewOrder, onOpenOrder, onShowOrders, onOpenPayroll }: {
  access: Access; onNewOrder: (resume: Draft | null) => void; onOpenPayroll: () => void;
  onOpenOrder: (id: string) => void; onShowOrders: (preset: OrdersPreset) => void;
}) {
  const { t } = useTheme();
  const d = new Date();
  const canOrder = can(access, 'orders.edit');
  const [draft, setDraftState] = useState<Draft | null>(null);
  useEffect(() => { if (canOrder) loadDraft().then(setDraftState); }, [canOrder]);
  const draftName = (x: Draft) => x.client.name.trim() || 'Ismsiz mijoz';
  const removeDraft = async () => {
    if (!draft || !(await confirmAsk(`Tugallanmagan buyurtma (${draftName(draft)}) o‘chirilsinmi? Kiritilgan ma’lumotlar qaytmaydi.`, 'O‘chirish'))) return;
    await clearDraft(); setDraftState(null);
  };
  // Tugallanmagan buyurtma bo'lsa, yangisini boshlashdan oldin so'raymiz (eski ilovadagidek)
  const startNew = async () => {
    if (draft) {
      if (!(await confirmAsk(`Tugallanmagan buyurtma bor (${draftName(draft)}). Uni o‘chirib, yangi buyurtma boshlaymizmi?`, 'O‘chirib, yangisini boshlash'))) return;
      await clearDraft(); setDraftState(null);
    }
    onNewOrder(null);
  };
  const full = can(access, 'orders.view_all');
  const money = full && can(access, 'prices.view');
  const { items } = useOrders(full);
  const orders = items ?? [];
  const active = orders.filter((o) => stage(o) !== 'O‘rnatildi');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(23, 59, 59, 999);
  const due = active.filter((o) => o.ready_date && new Date(`${o.ready_date}T00:00:00`) <= tomorrow)
    .sort((a, b) => (a.ready_date ?? '').localeCompare(b.ready_date ?? ''));
  const debt = orders.reduce((n, o) => n + remaining(o), 0);
  // Tikuvchi/usta: shu oyda hisoblangan haq va umumiy qoldiq
  const [pay, setPay] = useState<{ earned: number; balance: number } | null>(null);
  const loadPay = useCallback(() => {
    if (full) return;
    loadDetail(access.staff_id, monthKey())
      .then((x) => setPay({ earned: x.works.reduce((n, w) => n + w.amount, 0), balance: x.balance }))
      .catch(() => setPay((p) => p ?? { earned: 0, balance: 0 }));
  }, [full, access.staff_id]);
  useEffect(loadPay, [loadPay]);
  useEffect(() => { if (!full) loadPay(); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const recent = orders.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);

  return (
    <>
      <Intro overline={`${d.getDate()} ${MONTHS[d.getMonth()]} · ${DAYS[d.getDay()]}`.toUpperCase()} title={full ? 'Bugungi ishlar' : 'Mening ishlarim'} />

      {full ? (
        <>
          <BigCard label="Faol buyurtmalar" pill="ISH JARAYONIDA" value={items ? String(active.length) : '…'} unit="ta buyurtma" caption="Har bir buyurtma — e’tiborda." />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Metric title="Yaqin muddat" value={String(due.length)} unit="ta" sub="Bugun va ertaga" onPress={() => onShowOrders({ sort: 'muddat' })} />
            {money && <Metric title="Qarzdorlik" value={fmtN(debt)} unit="so‘m" sub="To‘lov kutilmoqda" onPress={() => onShowOrders({ pay: 'unpaid' })} />}
          </View>
        </>
      ) : (
        <>
          <BigCard label="Bu oy hisobingizga tushdi" pill="ISHBAY" value={pay ? fmtN(pay.earned) : '…'} unit="so‘m"
            caption="Bajargan ishlaringiz uchun hisoblangan haq." onPress={onOpenPayroll} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Metric title={pay && pay.balance < 0 ? 'Avans' : 'Qoldiq'} value={pay ? fmtN(Math.abs(pay.balance)) : '…'} unit="so‘m"
              sub={pay && pay.balance < 0 ? 'Oldindan olingan' : 'To‘lanishi kerak'} onPress={onOpenPayroll} />
            <Metric title="Mening buyurtmalarim" value={items ? String(active.length) : '…'} unit="ta" sub="Ish jarayonida" onPress={() => onShowOrders({ sort: 'muddat' })} />
          </View>
        </>
      )}

      {canOrder && (
        <Pressable accessibilityRole="button" onPress={startNew}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 6, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 15 }}>
          <Pressable accessibilityRole="button" onPress={() => onNewOrder(draft)}
            style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="file" color={t.teal} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: t.text }}>Tugallanmagan buyurtma</Text>
              <Text style={{ fontSize: 12, color: t.muted, marginTop: 2 }} numberOfLines={1}>{draftName(draft)} · davom ettirish</Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Tugallanmagan buyurtmani o‘chirish" onPress={removeDraft}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.input, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Icon name="trash" color={t.red} size={18} />
          </Pressable>
        </View>
      )}

      <SectionTitle title="Yaqin topshiriladigan" onAll={() => onShowOrders({ sort: 'muddat' })} />
      {due.length ? due.slice(0, 3).map((o) => <CompactOrder key={o.id} o={o} showMoney={money} onPress={() => onOpenOrder(o.id)} />)
        : <EmptyCard title="Yaqin muddatli buyurtma yo‘q" text="Bugun va ertaga topshiriladigan buyurtmalar shu yerda ko‘rinadi." />}
      <SectionTitle title="Oxirgi buyurtmalar" onAll={() => onShowOrders({ sort: 'yangi' })} />
      {recent.length ? recent.map((o) => <CompactOrder key={o.id} o={o} showMoney={money} onPress={() => onOpenOrder(o.id)} />)
        : full ? <EmptyCard title="Birinchi buyurtmangizni yarating" text="Mijozni kiriting, o‘lchamlarni belgilang va chekni saqlang." />
        : <EmptyCard title="Hozircha ish yo‘q" text="Sizga buyurtma biriktirilganda u shu yerda ko‘rinadi." />}
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

/** Asosiy yashil karta (eski bosh sahifadagi "Faol buyurtmalar" kartasi) */
function BigCard({ label, pill, value, unit, caption, onPress }: { label: string; pill: string; value: string; unit: string; caption: string; onPress?: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress}
      style={({ pressed }) => ({ borderRadius: 18, backgroundColor: t.tealDark === '#095c47' ? '#0b6a52' : t.tealMid, padding: 20, overflow: 'hidden', opacity: pressed ? 0.92 : 1 })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: '#ffffff', fontSize: 14, flexShrink: 1 }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#ffffff' }} />
          <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '700', letterSpacing: 0.6 }}>{pill}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ flexShrink: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <Text style={{ color: '#ffffff', fontSize: value.length > 7 ? 36 : 46, fontWeight: '700' }}>{value}</Text>
            <Text style={{ color: '#ffffff', fontSize: 13 }}>{unit}</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 10 }}>{caption}</Text>
        </View>
        <CurtainArt color="rgba(255,255,255,0.5)" />
      </View>
    </Pressable>
  );
}

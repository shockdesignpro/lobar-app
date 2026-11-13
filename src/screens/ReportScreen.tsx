// Hisobot (eski renderMobileFinance): davr bo'yicha summa, to'langan va qarzdorlik
import { useState } from 'react';
import { Text, View } from 'react-native';
import { can, type Access } from '../lib/auth';
import { fmtSom } from '../lib/format';
import { paidSum, remaining, useOrders, type OrderListItem } from '../lib/orders';
import { Card, Intro, Loading, Note } from '../ui/components';
import { Select } from '../ui/Select';
import { useTheme } from '../ui/ThemeContext';
import { CompactOrder, EmptyCard, SectionTitle } from './home/CompactOrder';

export type Period = 'day' | 'week' | 'month' | 'year' | 'all';

/** Davr boshlanishi (hafta dushanbadan) — eski ilovadagidek yaratilgan sana bo'yicha */
export function periodStart(p: Period, now = new Date()): Date | null {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === 'day') return d;
  if (p === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
  if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === 'year') return new Date(now.getFullYear(), 0, 1);
  return null;
}

export function reportTotals(list: OrderListItem[], p: Period, now = new Date()) {
  const from = periodStart(p, now);
  const orders = list.filter((o) => !from || new Date(o.created_at) >= from)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = orders.reduce((n, o) => n + (o.total ?? 0), 0);
  const paid = orders.reduce((n, o) => n + Math.min(paidSum(o), o.total ?? 0), 0);
  const debt = orders.reduce((n, o) => n + remaining(o), 0);
  return { orders, total, paid, debt };
}

export function ReportScreen({ access, onOpenOrder }: { access: Access; onOpenOrder: (id: string) => void }) {
  const { t } = useTheme();
  const [period, setPeriod] = useState<Period>('month');
  const allowed = can(access, 'reports.view') && can(access, 'orders.view_all');
  const { items, error } = useOrders(allowed);

  if (!allowed) return (<><Intro title="Hisobot" /><Note tone="error">Hisobotni ko‘rishga ruxsatingiz yo‘q.</Note></>);
  if (!items) return (<><Intro title="Hisobot" />{error ? <Note tone="error">{error}</Note> : <Loading />}</>);

  const r = reportTotals(items, period);
  return (
    <>
      <Intro overline="MOLIYA" title="Hisobot" />
      <Select label="Davr" value={period} onChange={setPeriod} options={[
        { key: 'day', label: 'Kunlik' }, { key: 'week', label: 'Haftalik' }, { key: 'month', label: 'Oylik' },
        { key: 'year', label: 'Yillik' }, { key: 'all', label: 'Barchasi' },
      ]} />

      <SectionTitle title="Buyurtmalar" />
      <View style={{ borderRadius: 15, backgroundColor: t.tealLight, padding: 18, gap: 6 }}>
        <Text style={{ fontSize: 13, color: t.teal, fontWeight: '600' }}>Buyurtmalar summasi</Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: t.teal }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{fmtSom(r.total)}</Text>
        <Text style={{ fontSize: 12, color: t.muted }}>{r.orders.length} ta buyurtma</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={{ fontSize: 12, color: t.muted }}>To‘liq to‘langan buyurtmalar</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: t.text }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{fmtSom(r.paid)}</Text>
        </Card>
        <Card style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={{ fontSize: 12, color: t.muted }}>Jami qarzdorlik</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: r.debt > 0 ? t.red : t.text }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{fmtSom(r.debt)}</Text>
        </Card>
      </View>

      <SectionTitle title="Davrdagi buyurtmalar" />
      {r.orders.length
        ? r.orders.map((o) => <CompactOrder key={o.id} o={o} showMoney showDebt onPress={() => onOpenOrder(o.id)} />)
        : <EmptyCard title="Buyurtmalar yo‘q" text="Tanlangan davrda buyurtma topilmadi." />}
    </>
  );
}

// Hisobot (eski renderMobileFinance): davr bo'yicha summa, to'langan va qarzdorlik
import { useCallback, useEffect, useState } from 'react';
import { loadProfit, useMoneyLive, type Profit } from '../lib/expenses';
import { isNetworkError } from '../lib/offline';
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

      <ProfitBlock period={period} />

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

/** Sof foyda (kassa bo'yicha): olingan to'lovlar − xarajatlar − hisoblangan ish haqi */
function ProfitBlock({ period }: { period: Period }) {
  const { t } = useTheme();
  const [p, setP] = useState<Profit | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    const from = periodStart(period) ?? new Date(2000, 0, 1);
    loadProfit(from, new Date(2100, 0, 1))
      .then((x) => { setP(x); setErr(''); })
      .catch((e) => setErr(isNetworkError(e) ? 'Internet yo‘q — foyda internet bilan hisoblanadi.' : (e as { message?: string }).message ?? 'Xato'));
  }, [period]);
  useEffect(() => { setP(null); load(); }, [load]);
  useMoneyLive(load);

  if (err) return <Note tone="error">{err}</Note>;
  if (!p) return <Loading />;
  const line = (label: string, value: number, sign: '+' | '−', color: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 13, color: t.muted, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color }}>{sign}{fmtSom(value)}</Text>
    </View>
  );
  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ fontSize: 13, color: t.muted, fontWeight: '600' }}>Sof foyda</Text>
      <Text style={{ fontSize: 28, fontWeight: '800', color: p.profit < 0 ? t.red : t.teal }} numberOfLines={1}>{p.profit < 0 ? '−' : ''}{fmtSom(Math.abs(p.profit))}</Text>
      <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.divider }}>
        {line('Kassaga tushdi (mijozlardan)', p.income, '+', t.teal)}
        {line('Xarajatlar', p.expenses, '−', t.red)}
        {p.categories.map((c) => (
          <View key={c.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingLeft: 12 }}>
            <Text style={{ fontSize: 12, color: t.muted, flex: 1 }} numberOfLines={1}>{c.name}</Text>
            <Text style={{ fontSize: 12, color: t.muted }}>{fmtSom(c.amount)}</Text>
          </View>
        ))}
        {line('Ishchilar ish haqi (hisoblangan)', p.payroll, '−', t.red)}
      </View>
    </Card>
  );
}

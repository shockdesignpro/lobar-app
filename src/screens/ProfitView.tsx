// Sof foyda (Xarajatlar sahifasida): olingan to'lovlar − xarajatlar − hisoblangan ish haqi
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { loadProfit, useMoneyLive, type Profit } from '../lib/expenses';
import { fmtSom } from '../lib/format';
import { isNetworkError } from '../lib/offline';
import { Card, Loading, Note } from '../ui/components';
import { Select } from '../ui/Select';
import { useTheme } from '../ui/ThemeContext';
import { periodStart, type Period } from './ReportScreen';

export function ProfitView() {
  const [period, setPeriod] = useState<Period>('month');
  return (
    <>
      <Select label="Davr" value={period} onChange={setPeriod} options={[
        { key: 'day', label: 'Kunlik' }, { key: 'week', label: 'Haftalik' }, { key: 'month', label: 'Oylik' },
        { key: 'year', label: 'Yillik' }, { key: 'all', label: 'Barchasi' },
      ]} />
      <ProfitBlock period={period} />
    </>
  );
}

/** Sof foyda (kassa bo'yicha): olingan to'lovlar − xarajatlar − hisoblangan ish haqi */
export function ProfitBlock({ period }: { period: Period }) {
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
      <Text style={{ fontSize: 14, fontWeight: '800', color: value ? color : t.muted }}>{value ? sign : ''}{fmtSom(value)}</Text>
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, padding: 10, borderRadius: 10, backgroundColor: t.input }}>
        <Text style={{ fontSize: 12, color: t.muted, flex: 1 }}>Ishchilarga qo‘lga berilgan pul (ma’lumot uchun, foydadan ayrilmaydi)</Text>
        <Text style={{ fontSize: 13, fontWeight: '800', color: t.text }}>{fmtSom(p.paid_out)}</Text>
      </View>
    </Card>
  );
}

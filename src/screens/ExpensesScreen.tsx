// Xarajatlar: oy bo'yicha ro'yxat, turlar bo'yicha jami, yangi xarajat qo'shish
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Access } from '../lib/auth';
import { addCategory, addExpense, deleteExpense, isoDay, loadCategories, loadExpenses, useMoneyLive, type Expense, type ExpenseCategory } from '../lib/expenses';
import { calcNumber, fmtN, fmtSom } from '../lib/format';
import { isNetworkError } from '../lib/offline';
import { useOrders } from '../lib/orders';
import { monthKey, monthOptions } from '../lib/payroll';
import { Button, Card, Field, Intro, Loading, Note, Sheet } from '../ui/components';
import { confirmAsk } from '../ui/confirm';
import { DateField } from '../ui/DateField';
import { Icon } from '../ui/Icon';
import { Select } from '../ui/Select';
import { useSnack } from '../ui/SnackContext';
import { useTheme } from '../ui/ThemeContext';
import { EmptyCard, SectionTitle } from './home/CompactOrder';

const errText = (e: unknown) => (isNetworkError(e) ? 'Internet yo‘q — xarajatlar internet bilan ishlaydi.' : (e as { message?: string })?.message ?? 'Xato');
const fmtDay = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
function monthDays(key: string): [string, string] {
  const [y, m] = key.split('-').map(Number);
  return [isoDay(new Date(y, m - 1, 1)), isoDay(new Date(y, m, 1))];
}

export function ExpensesScreen({ access }: { access: Access }) {
  const { t } = useTheme();
  const snack = useSnack();
  const [month, setMonth] = useState(monthKey());
  const [cats, setCats] = useState<ExpenseCategory[]>([]);
  const [list, setList] = useState<Expense[] | null>(null);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const { items: orders } = useOrders(true);

  const load = useCallback(() => {
    const [from, to] = monthDays(month);
    Promise.all([loadCategories(), loadExpenses(from, to)])
      .then(([c, l]) => { setCats(c); setList(l); setErr(''); })
      .catch((e) => { setErr(errText(e)); setList((x) => x ?? []); });
  }, [month]);
  useEffect(() => { setList(null); load(); }, [load]);
  useMoneyLive(load);

  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? '—';
  const orderName = (id: string | null) => {
    if (!id) return '';
    const o = orders?.find((x) => x.id === id);
    return o ? `${o.client_name}${o.order_no ? ` · №${String(o.order_no).padStart(4, '0')}` : ''}` : 'Buyurtma';
  };
  const total = (list ?? []).reduce((n, e) => n + e.amount, 0);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of list ?? []) m.set(e.category_id, (m.get(e.category_id) ?? 0) + e.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  const remove = async (e: Expense) => {
    if (!(await confirmAsk(`${catName(e.category_id)}: ${fmtSom(e.amount)} o‘chirilsinmi?`, 'O‘chirish'))) return;
    const { error } = await deleteExpense(e.id);
    if (error) snack(errText(error)); else { snack('O‘chirildi'); load(); }
  };

  return (
    <>
      <Intro overline="MOLIYA" title="Xarajatlar" sub="Xaridlar, ijara va boshqa chiqimlar. Sof foyda Hisobot sahifasida." />
      <Select label="Oy" value={month} options={monthOptions()} onChange={setMonth} />
      {err ? <Note tone="error">{err}</Note> : null}
      <Button label="Xarajat qo‘shish" icon="plus" onPress={() => setAdding(true)} />
      {!list ? <Loading /> : (
        <>
          <View style={{ borderRadius: 15, backgroundColor: t.tealLight, padding: 18, gap: 6 }}>
            <Text style={{ fontSize: 13, color: t.teal, fontWeight: '600' }}>Shu oydagi xarajatlar</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: t.teal }} numberOfLines={1}>{fmtSom(total)}</Text>
            {byCat.map(([id, sum]) => (
              <View key={id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontSize: 13, color: t.text, flex: 1 }} numberOfLines={1}>{catName(id)}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: t.text }}>{fmtN(sum)}</Text>
              </View>
            ))}
          </View>

          <SectionTitle title="Ro‘yxat" />
          {list.length ? (
            <Card padded={false}>
              {list.map((e, i) => (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.divider }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: t.text }} numberOfLines={1}>{catName(e.category_id)}</Text>
                    <Text style={{ fontSize: 12, color: t.muted }} numberOfLines={2}>
                      {fmtDay(e.spent_on)}{e.note ? ` · ${e.note}` : ''}{e.order_id ? ` · ${orderName(e.order_id)}` : ''}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: t.red }}>−{fmtN(e.amount)}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Xarajatni o‘chirish" onPress={() => remove(e)}
                    style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trash" color={t.muted} size={18} />
                  </Pressable>
                </View>
              ))}
            </Card>
          ) : <EmptyCard title="Bu oyda xarajat yo‘q" text="“Xarajat qo‘shish” tugmasi bilan kiriting." />}
        </>
      )}
      {adding && (
        <ExpenseSheet cats={cats} orders={(orders ?? []).map((o) => ({ key: o.id, label: orderName(o.id) }))}
          onCats={setCats} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); snack('Xarajat qo‘shildi'); load(); }} />
      )}
    </>
  );
}

function ExpenseSheet({ cats, orders, onCats, onClose, onSaved }: {
  cats: ExpenseCategory[]; orders: { key: string; label: string }[];
  onCats: (c: ExpenseCategory[]) => void; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTheme();
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState(cats[0]?.id ?? '');
  const [newCat, setNewCat] = useState('');
  const [day, setDay] = useState(isoDay(new Date()));
  const [note, setNote] = useState('');
  const [order, setOrder] = useState('__none');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = calcNumber(amount);
    if (!n || n <= 0) { setErr('Summani kiriting. Masalan: 150 000'); return; }
    if (!day) { setErr('Sanani tanlang'); return; }
    setBusy(true); setErr('');
    try {
      let catId = cat;
      if (cat === '__new') {
        if (!newCat.trim()) { setErr('Yangi tur nomini yozing'); setBusy(false); return; }
        const c = await addCategory(newCat);
        onCats([...cats, c]); catId = c.id;
      }
      const { error } = await addExpense({ category_id: catId, amount: n, spent_on: day, note, order_id: order === '__none' ? null : order });
      if (error) throw error;
      onSaved();
    } catch (e) { setErr(errText(e)); }
    setBusy(false);
  };

  return (
    <Sheet visible onClose={onClose} title="Yangi xarajat">
      <Field label="Summa (so‘m)" placeholder="Masalan: 150 000" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Select label="Turi" value={cat} onChange={setCat}
        options={[...cats.map((c) => ({ key: c.id, label: c.name })), { key: '__new', label: '+ Yangi tur qo‘shish' }]} />
      {cat === '__new' && <Field label="Yangi tur nomi" placeholder="Masalan: Reklama" value={newCat} onChangeText={setNewCat} maxLength={40} />}
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}>Sana</Text>
        <DateField label="Sana" value={day} onChange={setDay} />
      </View>
      <Field label="Izoh (ixtiyoriy)" placeholder="Masalan: oq tyul 20 m" value={note} onChangeText={setNote} maxLength={200} />
      <Select label="Buyurtmaga bog‘lash (ixtiyoriy)" value={order} onChange={setOrder}
        options={[{ key: '__none', label: 'Bog‘lanmagan — umumiy xarajat' }, ...orders]} />
      <Text style={{ fontSize: 12, color: t.muted, lineHeight: 17, marginTop: -4 }}>Bog‘lansa, buyurtma sahifasida shu buyurtmadan qolgan foyda ko‘rinadi.</Text>
      {!!err && <Note tone="error">{err}</Note>}
      <Button label="Saqlash" onPress={save} busy={busy} />
      <Pressable accessibilityRole="button" onPress={onClose} style={{ alignItems: 'center', paddingVertical: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: t.muted }}>Bekor qilish</Text>
      </Pressable>
    </Sheet>
  );
}

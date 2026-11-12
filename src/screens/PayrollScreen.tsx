// Ish haqi (ishbay). Admin/Direktor: hamma ishchilar, oy bo'yicha, pul berish.
// Tikuvchi/usta: faqat o'zining ishlari, berilgan pullar va qoldig'i.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { can, type Access } from '../lib/auth';
import { calcNumber, fmtN, fmtSom, groupTyping } from '../lib/format';
import {
  addPayout, cancelPayout, loadDetail, loadSummary, monthKey, monthOptions, usePayrollLive,
  type WorkerDetail, type WorkerSummary,
} from '../lib/payroll';
import { isNetworkError } from '../lib/offline';
import { Badge, Button, Card, Field, Intro, Loading, Note } from '../ui/components';
import { confirmAsk } from '../ui/confirm';
import { Icon } from '../ui/Icon';
import { Select } from '../ui/Select';
import { useSnack } from '../ui/SnackContext';
import { useTheme } from '../ui/ThemeContext';
import { EmptyCard, SectionTitle } from './home/CompactOrder';

const ROLE = { tikuvchi: 'Tikuvchi', usta: 'Usta' } as const;
const TASK = { tikish: 'Tikish', ornatish: 'O‘rnatish' } as const;
const errText = (e: unknown) => (isNetworkError(e) ? 'Internet yo‘q — ish haqi internet bilan ko‘rinadi.' : (e as { message?: string })?.message ?? 'Xato');
/** Miqdor: 1.6, 3.25 (butunlab yaxlitlamaymiz) */
const fmtQty = (q: number) => `Miqdor: ${String(Number(q.toFixed(2)))}`;
const fmtDate = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };

export function PayrollScreen({ access, staffId, setStaffId }: { access: Access; staffId: string | null; setStaffId: (id: string | null) => void }) {
  const manage = can(access, 'payroll.manage');
  const [month, setMonth] = useState(monthKey());
  if (!manage) return <WorkerView access={access} staffId={access.staff_id} name={access.full_name} month={month} setMonth={setMonth} manage={false} />;
  if (staffId) return <WorkerView access={access} staffId={staffId} month={month} setMonth={setMonth} manage />;
  return <Summary month={month} setMonth={setMonth} onOpen={setStaffId} />;
}

function MonthSelect({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return <Select label="Oy" value={month} options={monthOptions()} onChange={setMonth} />;
}

function Summary({ month, setMonth, onOpen }: { month: string; setMonth: (m: string) => void; onOpen: (id: string) => void }) {
  const { t } = useTheme();
  const [list, setList] = useState<WorkerSummary[] | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => { loadSummary(month).then((l) => { setList(l); setErr(''); }).catch((e) => { setErr(errText(e)); setList((x) => x ?? []); }); }, [month]);
  useEffect(() => { setList(null); load(); }, [load]);
  usePayrollLive(load);

  const earned = (list ?? []).reduce((n, w) => n + w.earned, 0);
  const paid = (list ?? []).reduce((n, w) => n + w.paid, 0);
  const owed = (list ?? []).reduce((n, w) => n + Math.max(0, w.balance), 0);

  return (
    <>
      <Intro overline="ISHCHILAR" title="Ish haqi" sub="Tikuvchi va ustalarning bajargan ishlari bo‘yicha hisob." />
      <MonthSelect month={month} setMonth={setMonth} />
      {err ? <Note tone="error">{err}</Note> : null}
      {!list ? <Loading /> : (
        <>
          <View style={{ borderRadius: 15, backgroundColor: t.tealLight, padding: 18, gap: 6 }}>
            <Text style={{ fontSize: 13, color: t.teal, fontWeight: '600' }}>To‘lanishi kerak (jami qoldiq)</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: t.teal }} numberOfLines={1}>{fmtSom(owed)}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Card style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={{ fontSize: 12, color: t.muted }}>Shu oyda hisoblandi</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: t.text }} numberOfLines={1}>{fmtSom(earned)}</Text>
            </Card>
            <Card style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={{ fontSize: 12, color: t.muted }}>Shu oyda berildi</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: t.text }} numberOfLines={1}>{fmtSom(paid)}</Text>
            </Card>
          </View>
          <SectionTitle title="Ishchilar" />
          {list.length ? list.map((w) => (
            <Pressable key={w.staff_id} accessibilityRole="button" accessibilityLabel={`${w.full_name}: ish haqi`} onPress={() => onOpen(w.staff_id)}
              style={({ pressed }) => ({ padding: 14, borderRadius: 15, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, gap: 10, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: t.teal, fontWeight: '800', fontSize: 16 }}>{w.full_name.trim().slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: t.text }} numberOfLines={1}>{w.full_name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Badge label={ROLE[w.role_id] ?? w.role_id} tone={w.role_id === 'usta' ? 'purple' : 'amber'} />
                    {!w.is_active && <Badge label="Bloklangan" tone="grey" />}
                  </View>
                </View>
                <Icon name="chevron" color={t.muted} size={18} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Mini label="Hisoblandi" value={fmtN(w.earned)} />
                <Mini label="Berildi" value={fmtN(w.paid)} />
                <Mini label={w.balance < 0 ? 'Avans' : 'Qoldiq'} value={fmtN(Math.abs(w.balance))} strong={w.balance > 0} />
              </View>
            </Pressable>
          )) : <EmptyCard title="Ishchi yo‘q" text="Admin panelda tikuvchi yoki usta qo‘shilgach, shu yerda ko‘rinadi." />}
          <Note>Ish haqi tikuvchiga “Dazmolandi”, ustaga “Pardani o‘rnatish” belgilanganda hisoblanadi: xizmat miqdori × katalogdagi ishchi stavkasi. Bir ishga bir necha kishi bo‘lsa, teng bo‘linadi.</Note>
        </>
      )}
    </>
  );
}

function Mini({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 0, padding: 8, borderRadius: 10, backgroundColor: t.input }}>
      <Text style={{ fontSize: 11, color: t.muted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '800', color: strong ? t.amber : t.text, marginTop: 2 }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function WorkerView({ access, staffId, name, month, setMonth, manage }: {
  access: Access; staffId: string; name?: string; month: string; setMonth: (m: string) => void; manage: boolean;
}) {
  const { t } = useTheme();
  const snack = useSnack();
  const [d, setD] = useState<WorkerDetail | null>(null);
  const [title, setTitle] = useState(name ?? '');
  const [err, setErr] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    loadDetail(staffId, month).then((x) => { setD(x); setErr(''); }).catch((e) => { setErr(errText(e)); setD((x) => x ?? { works: [], payouts: [], balance: 0 }); });
    if (manage && !name) loadSummary(month).then((l) => setTitle(l.find((w) => w.staff_id === staffId)?.full_name ?? '')).catch(() => {});
  }, [staffId, month, manage, name]);
  useEffect(() => { setD(null); load(); }, [load]);
  usePayrollLive(load);

  const pay = async () => {
    const n = calcNumber(amount);
    if (!n || n <= 0) { snack('Summani kiriting'); return; }
    setBusy(true);
    const { error } = await addPayout(staffId, n, note);
    setBusy(false);
    if (error) { snack(errText(error)); return; }
    setAmount(''); setNote(''); snack(`${title || 'Ishchi'}ga ${fmtSom(n)} to‘landi`); load();
  };
  const cancel = async (id: string, sum: number) => {
    if (!(await confirmAsk(`${fmtSom(sum)} bekor qilinsinmi?`, 'Bekor qilish'))) return;
    const { error } = await cancelPayout(id);
    if (error) snack(errText(error)); else { snack('Bekor qilindi'); load(); }
  };

  const earned = (d?.works ?? []).reduce((n, w) => n + w.amount, 0);
  return (
    <>
      <Intro overline={manage ? 'ISH HAQI' : 'MENING ISH HAQIM'} title={title || access.full_name} />
      <MonthSelect month={month} setMonth={setMonth} />
      {err ? <Note tone="error">{err}</Note> : null}
      {!d ? <Loading /> : (
        <>
          <View style={{ borderRadius: 15, backgroundColor: d.balance < 0 ? t.input : t.tealLight, padding: 18, gap: 6 }}>
            <Text style={{ fontSize: 13, color: t.teal, fontWeight: '600' }}>{d.balance < 0 ? 'Avans (oldindan berilgan)' : 'To‘lanishi kerak (qoldiq)'}</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: t.teal }} numberOfLines={1}>{fmtSom(Math.abs(d.balance))}</Text>
            <Text style={{ fontSize: 12, color: t.muted }}>Shu oyda ishlagani: {fmtSom(earned)}</Text>
          </View>

          {manage && (
            <Card style={{ gap: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: t.text }}>Ish haqini to‘lash</Text>
              <Field label="Summa (so‘m)" placeholder="Masalan: 500 000" value={amount} onChangeText={(v) => setAmount(groupTyping(v))} keyboardType="decimal-pad" />
              <Field label="Izoh (ixtiyoriy)" placeholder="Masalan: avans, oylik" value={note} onChangeText={setNote} maxLength={200} />
              <Button label="Ish haqini to‘lash" onPress={pay} busy={busy} />
            </Card>
          )}

          <SectionTitle title="Bajarilgan ishlar" />
          {d.works.length ? (
            <Card padded={false}>
              {d.works.map((w, i) => (
                <View key={`${w.order_id}${w.task}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.divider }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: t.text }} numberOfLines={1}>{w.client_name}{w.order_no ? ` · №${String(w.order_no).padStart(4, '0')}` : ''}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Badge label={TASK[w.task]} tone={w.task === 'ornatish' ? 'purple' : 'amber'} />
                      <Text style={{ fontSize: 12, color: t.muted }}>{fmtQty(w.quantity)} · {fmtDate(w.earned_at)}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: t.teal }}>{fmtN(w.amount)}</Text>
                </View>
              ))}
            </Card>
          ) : <EmptyCard title="Bu oyda bajarilgan ish yo‘q" text="Ish bosqichi belgilangach, shu yerda paydo bo‘ladi." />}

          <SectionTitle title="Berilgan pullar" />
          {d.payouts.length ? (
            <Card padded={false}>
              {d.payouts.map((p, i) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.divider }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: t.text }}>{fmtSom(p.amount)}</Text>
                    <Text style={{ fontSize: 12, color: t.muted, marginTop: 2 }} numberOfLines={1}>{fmtDate(p.paid_at)}{p.note ? ` · ${p.note}` : ''}</Text>
                  </View>
                  {manage && (
                    <Pressable accessibilityRole="button" accessibilityLabel="Berilgan pulni bekor qilish" onPress={() => cancel(p.id, p.amount)}
                      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="trash" color={t.muted} size={18} />
                    </Pressable>
                  )}
                </View>
              ))}
            </Card>
          ) : <EmptyCard title="Bu oyda pul berilmagan" text={manage ? 'Yuqoridagi “Ish haqini to‘lash” orqali yozing.' : 'Berilgan pullar shu yerda ko‘rinadi.'} />}
        </>
      )}
    </>
  );
}

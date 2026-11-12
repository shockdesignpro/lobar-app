// Ish haqi (ishbay). Admin/Direktor: hamma ishchilar, oy bo'yicha, pul berish.
// Tikuvchi/usta: faqat o'zining ishlari, berilgan pullar va qoldig'i.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { can, type Access } from '../lib/auth';
import { calcNumber, fmtN, fmtSom, groupTyping } from '../lib/format';
import {
  addPayout, cancelPayout, loadDetail, loadSummary, monthKey, monthOptions, payJobs, unpaidOf, usePayrollLive,
  type Work, type WorkerDetail, type WorkerSummary,
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
  const [paying, setPaying] = useState<string | null>(null);
  const [avansOpen, setAvansOpen] = useState(false);

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
    setAmount(''); setNote(''); setAvansOpen(false); snack(`${title || 'Ishchi'}ga ${fmtSom(n)} berildi`); load();
  };
  // Aynan bajarilgan ish uchun (yoki oydagi hamma to'lanmagan ishlar uchun) to'lash
  const payWorks = async (list: Work[], key: string) => {
    const sum = list.reduce((n, w) => n + unpaidOf(w), 0);
    if (sum <= 0 || paying) return;
    setPaying(key);
    const { error } = await payJobs(staffId, list);
    setPaying(null);
    if (error) { snack(errText(error)); return; }
    snack(list.length === 1 ? `${list[0].client_name}: ${fmtSom(sum)} to‘landi` : `${list.length} ta ish uchun ${fmtSom(sum)} to‘landi`);
    load();
  };
  const cancel = async (id: string, sum: number) => {
    if (!(await confirmAsk(`${fmtSom(sum)} bekor qilinsinmi?`, 'Bekor qilish'))) return;
    const { error } = await cancelPayout(id);
    if (error) snack(errText(error)); else { snack('Bekor qilindi'); load(); }
  };

  const earned = (d?.works ?? []).reduce((n, w) => n + w.amount, 0);
  const unpaid = (d?.works ?? []).filter((w) => unpaidOf(w) > 0);
  const unpaidSum = unpaid.reduce((n, w) => n + unpaidOf(w), 0);
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

          {manage && unpaid.length > 0 && (
            <Button label={`Hammasini to‘lash · ${fmtSom(unpaidSum)}`} busy={paying === 'all'} onPress={() => payWorks(unpaid, 'all')} />
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
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: t.teal }}>{fmtN(w.amount)}</Text>
                    {unpaidOf(w) <= 0 ? <Badge label="To‘landi" tone="teal" />
                      : manage ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`${w.client_name}: ${fmtN(unpaidOf(w))} to‘lash`} disabled={!!paying}
                          onPress={() => payWorks([w], `${w.order_id}${w.task}`)}
                          style={({ pressed }) => ({ minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: t.primaryButton, justifyContent: 'center', opacity: pressed || paying ? 0.7 : 1 })}>
                          <Text style={{ color: t.primaryButtonText, fontSize: 12, fontWeight: '800' }}>
                            {paying === `${w.order_id}${w.task}` ? '…' : `To‘lash ${fmtN(unpaidOf(w))}`}
                          </Text>
                        </Pressable>
                      ) : <Badge label={w.paid > 0 ? `Qoldi ${fmtN(unpaidOf(w))}` : 'To‘lanmagan'} tone="amber" />}
                  </View>
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
                    <Text style={{ fontSize: 12, color: t.muted, marginTop: 2 }} numberOfLines={1}>
                      {fmtDate(p.paid_at)} · {p.task ? `${p.client_name ?? 'Buyurtma'}${p.order_no ? ` №${String(p.order_no).padStart(4, '0')}` : ''}, ${TASK[p.task].toLowerCase()}` : `Avans${p.note ? ` — ${p.note}` : ''}`}
                    </Text>
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
          ) : <EmptyCard title="Bu oyda pul berilmagan" text={manage ? 'Bajarilgan ish yonidagi “To‘lash” tugmasi bilan to‘lang.' : 'Berilgan pullar shu yerda ko‘rinadi.'} />}

          {manage && (
            <Card style={{ gap: 10 }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: avansOpen }} onPress={() => setAvansOpen(!avansOpen)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: t.text }}>Avans berish</Text>
                <View style={{ transform: [{ rotate: avansOpen ? '90deg' : '0deg' }] }}><Icon name="chevron" color={t.muted} size={18} /></View>
              </Pressable>
              {avansOpen && (
                <>
                  <Text style={{ fontSize: 12, color: t.muted, lineHeight: 17 }}>Ish hali bajarilmagan bo‘lsa, oldindan beriladigan pul. Keyingi ishlaridan qoldiq sifatida ayriladi.</Text>
                  <Field label="Summa (so‘m)" placeholder="Masalan: 200 000" value={amount} onChangeText={(v) => setAmount(groupTyping(v))} keyboardType="decimal-pad" />
                  <Field label="Izoh (ixtiyoriy)" placeholder="Masalan: avans" value={note} onChangeText={setNote} maxLength={200} />
                  <Button kind="soft" label="Avans berish" onPress={pay} busy={busy} />
                </>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}

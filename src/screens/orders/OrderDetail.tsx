import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '../../ui/Avatar';
import { loadOrderProfit, useMoneyLive, type OrderProfit } from '../../lib/expenses';
import { Pressable, Text, View } from 'react-native';
import { can, type Access } from '../../lib/auth';
import { calcNumber, fmtN, fmtSom, groupTyping } from '../../lib/format';
import { costGroups, mqText, openingLabel, type Draft, type Section } from '../../lib/order/model';
import {
  addPayment, cancelPayment, loadOrderDraft, loadWorkers, ORDER_STEPS, paidSum, payStatus, progressTone, remaining,
  setAssignee, setStep, STEP_GROUP, stepsDone, type OrderListItem, type StaffLite, type StepKey,
} from '../../lib/orders';
import { Card, Loading } from '../../ui/components';
import { confirmAsk } from '../../ui/confirm';
import { Icon } from '../../ui/Icon';
import { useSnack } from '../../ui/SnackContext';
import { useTheme } from '../../ui/ThemeContext';
import { Input } from '../order/parts';
import { rowsByCurtain } from '../../lib/receipt';
import { PhotoGallery } from '../../ui/Photos';

/** Ochilgan buyurtma: xonalar, to'lovlar, ish holati va biriktirilganlar */
export function OrderDetail({ o, access }: { o: OrderListItem; access: Access }) {
  const full = can(access, 'orders.view_all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { loadOrderDraft(o, full).then(setDraft).catch((e) => setErr(e.message)); }, [o.id, full]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ gap: 10 }}>
      {err ? <Text style={{ color: '#d94040', fontSize: 13 }}>{err}</Text> : !draft ? <Loading /> : <RoomsDetails draft={draft} showMoney={can(access, 'prices.view')} />}
      <PhotoGallery paths={o.photos} captions={o.photo_captions}
        local={Object.fromEntries((draft?.photos ?? []).filter((p) => p.path && p.uri).map((p) => [p.path as string, p.uri]))} />
      {can(access, 'payments.view') && <PaymentBox o={o} access={access} />}
      {can(access, 'reports.view') && <OrderProfitBox orderId={o.id} />}
      <StatusPanel o={o} access={access} />
    </View>
  );
}

function RoomsDetails({ draft, showMoney }: { draft: Draft; showMoney: boolean }) {
  const { t } = useTheme();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const groups = costGroups(draft);
  if (!groups.length) return null;
  return (
    <>
      {groups.map((g, gi) => {
        const key = g.room?.id ?? 'other';
        const isOpen = open[key] ?? true;
        return (
          <Card key={key} padded={false}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen({ ...open, [key]: !isOpen })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
              <View style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}><Icon name="chevron" color={t.tealDark} size={14} strokeWidth={2.6} /></View>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: t.tealDark }}>{gi + 1}. {g.name}{g.room ? ` — ${g.room.openings.length} ta parda` : ''}</Text>
              {showMoney && <Text style={{ fontSize: 13, fontWeight: '800', color: t.text }}>{fmtSom(g.grand)}</Text>}
            </Pressable>
            {isOpen && (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 4 }}>
                {g.room?.openings.map((c, j) => (
                  <View key={c.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: t.divider }}>
                    <Text style={{ flex: 1, fontSize: 13, color: t.text }}>{openingLabel(g.room!.openings, j)} <Text style={{ color: t.muted }}>({c.rail}, {c.color})</Text></Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: t.text }}>{c.height} × {c.width} m</Text>
                  </View>
                ))}
                {(['mahsulot', 'tikish', 'ustanovka'] as Section[]).map((s, i) => g.rows[s].length ? (
                  <View key={s} style={{ marginTop: 8, gap: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: [t.teal, '#e8a020', '#6b5fe0'][i], borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 }}>
                      <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>{['Harajatlar', 'Tikish xizmati', 'O‘rnatish xizmati'][i]}</Text>
                      {showMoney && <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>{fmtSom(g.sums[s])}</Text>}
                    </View>
                    {rowsByCurtain(g.rows[s], g.room?.openings ?? [], openingLabel).map((cg) => (
                      <View key={cg.label || 'all'}>
                        {!!cg.label && (
                          <Text style={{ paddingTop: 7, paddingBottom: 3, paddingHorizontal: 4, fontSize: 12, fontWeight: '800', color: t.tealDark, borderBottomWidth: 1, borderBottomColor: t.divider }}>{cg.label}</Text>
                        )}
                        {cg.rows.map((r) => (
                          <View key={r.id} style={{ flexDirection: 'row', gap: 6, paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: t.divider }}>
                            <Text style={{ flex: 1, fontSize: 12, color: t.text }}>{r.productName}</Text>
                            {showMoney && <Text style={{ width: 58, fontSize: 12, color: t.muted }}>{fmtN(r.price)}</Text>}
                            <Text style={{ width: 40, fontSize: 12, color: t.muted }}>×{mqText(r.qty)}</Text>
                            {showMoney && <Text style={{ width: 70, fontSize: 12, fontWeight: '700', color: t.text, textAlign: 'right' }}>{fmtN((r.qty ?? 0) * r.price)}</Text>}
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : null)}
              </View>
            )}
          </Card>
        );
      })}
    </>
  );
}

function PaymentBox({ o, access }: { o: OrderListItem; access: Access }) {
  const { t } = useTheme();
  const snack = useSnack();
  const [amount, setAmount] = useState('');
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = payStatus(o);
  const info = {
    full: { label: '✅ To‘liq to‘landi', color: t.teal, bg: t.tealLight },
    partial: { label: '🟡 Bo‘nak olindi', color: t.amber, bg: t.amberLight },
    none: { label: '🔴 To‘lanmagan', color: t.red, bg: t.redLight },
  }[st];
  const rest = remaining(o);
  const add = async () => {
    const n = calcNumber(amount);
    if (!n || n <= 0) { setBad(true); snack('To‘lov summasini kiriting'); return; }
    if (n > rest) { setBad(true); snack(`Qolgan qarz ${fmtSom(rest)}. Shu summadan oshmagan to‘lov kiriting.`); return; }
    setBusy(true);
    const { error, queued } = await addPayment(o.id, n);
    setBusy(false);
    if (error) snack(error.message);
    else { setAmount(''); setBad(false); snack(queued ? 'To‘lov telefonda saqlandi — internet qaytganda yuboriladi' : 'To‘lov qo‘shildi'); }
  };
  const remove = async (id: string, sum: number) => {
    if (!(await confirmAsk(`${fmtSom(sum)} miqdoridagi to‘lovni bekor qilamizmi?`, 'Bekor qilish'))) return;
    const { error } = await cancelPayment(id);
    if (error) snack(error.message); else snack('To‘lov bekor qilindi');
  };
  const fmtDate = (iso: string) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  return (
    <View style={{ padding: 12, borderRadius: 12, backgroundColor: info.bg, gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: info.color }}>{info.label}</Text>
        <Text style={{ fontSize: 13, color: t.muted }}>{fmtSom(paidSum(o))} / {fmtSom(o.total ?? 0)}</Text>
      </View>
      {rest > 0 && <Text style={{ fontSize: 13, color: t.muted }}>Qoldiq: {fmtSom(rest)}</Text>}
      {o.payments.length > 0 && (
        <View style={{ marginTop: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' }}>
          {o.payments.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ flex: 1, fontSize: 13, color: t.muted }}>{fmtDate(p.paid_at)}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: t.text }}>{fmtSom(p.amount)}</Text>
              {can(access, 'payments.cancel') && (
                <Pressable accessibilityRole="button" accessibilityLabel="To‘lovni bekor qilish" onPress={() => remove(p.id, p.amount)} style={{ width: 36, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" color={t.red} size={14} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
      {rest > 0 && can(access, 'payments.add') && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {/* Summa maydoni; ichida o'ngda magnit — qolgan summani (hech narsa to'lanmagan bo'lsa — umumiy summani) birdan yozadi */}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Input accessibilityLabel="To‘lov summasi" placeholder="Summa" keyboardType="decimal-pad" value={amount} invalid={bad}
              onChangeText={(v) => { setAmount(groupTyping(v)); setBad(false); }} style={{ backgroundColor: t.card, paddingRight: 46 }} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Qolgan summani yozish: ${fmtN(rest)}`} onPress={() => { setAmount(fmtN(rest)); setBad(false); }} hitSlop={4}
              style={({ pressed }) => ({ position: 'absolute', right: 4, width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Icon name="magnet" color={t.red} size={21} strokeWidth={2.2} />
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" disabled={busy} onPress={add}
            style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: t.primaryButton, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed || busy ? 0.8 : 1 })}>
            <Icon name="plus" color={t.primaryButtonText} size={16} strokeWidth={2.4} />
            <Text style={{ color: t.primaryButtonText, fontWeight: '800', fontSize: 13 }}>Qo‘shish</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function StatusPanel({ o, access }: { o: OrderListItem; access: Access }) {
  const { t } = useTheme();
  const snack = useSnack();
  const [open, setOpen] = useState(false);
  const [workers, setWorkers] = useState<StaffLite[]>([]);
  const canAssign = can(access, 'orders.assign');
  // Ishchilar ro'yxati oldindan yuklanadi — panel ochilgach qatorlar siljimasin (noto'g'ri bosqich bosilib ketmasin)
  useEffect(() => { if (canAssign) loadWorkers().then(setWorkers); }, [canAssign]);
  const busy = useRef(new Set<StepKey>());
  const done = stepsDone(o);
  const pct = Math.round((done / ORDER_STEPS.length) * 100);
  const tone = progressTone(pct);
  const barColor = { teal: t.tealMid, amber: '#e8a020', red: '#d94040' }[tone];
  const mine = (k: StepKey) => can(access, 'steps.all')
    || (STEP_GROUP[k] === 'tikish' && can(access, 'steps.tikish'))
    || (STEP_GROUP[k] === 'ornatish' && can(access, 'steps.ornatish'));

  const toggle = async (k: StepKey) => {
    if (!mine(k)) { snack('Bu bosqichni belgilashga ruxsatingiz yo‘q'); return; }
    if (busy.current.has(k)) return; // shu bosqich hali saqlanmoqda — ikkinchi bosish e'tiborsiz
    busy.current.add(k);
    try {
      const { error } = await setStep(o.id, k, !o.steps[k]);
      if (error) snack(error.message);
    } finally { busy.current.delete(k); }
  };
  const missing = (['dazmolandi', 'parda_ornatish'] as StepKey[]).filter((k) => o.steps[k] && canAssign
    && !o.assignees.some((a) => a.task === (k === 'dazmolandi' ? 'tikish' : 'ornatish')));
  const assign = async (w: StaffLite, on: boolean) => {
    const { error } = await setAssignee(o.id, w.id, w.role_id === 'usta' ? 'ornatish' : 'tikish', on);
    if (error) snack(error.message);
  };

  return (
    <Card padded={false}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: t.tealDark }}>Buyurtma holati</Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: t.tealDark }}>{done}/{ORDER_STEPS.length}</Text>
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.greyLight, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: barColor }} />
          </View>
          <Text style={{ alignSelf: 'flex-end', fontSize: 11, fontWeight: '700', color: t.muted }}>{pct}%</Text>
          {ORDER_STEPS.map((s) => {
            const checked = !!o.steps[s.key];
            const allowed = mine(s.key);
            return (
              <View key={s.key}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: !allowed }} onPress={() => toggle(s.key)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, paddingVertical: 8, opacity: allowed ? 1 : 0.6 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? t.tealMid : t.card, borderWidth: checked ? 0 : 1.5, borderColor: t.border }}>
                    {checked && <Icon name="check" color="#ffffff" size={14} strokeWidth={3} />}
                  </View>
                  <Text style={{ fontSize: 14, color: checked ? t.text : t.muted, fontWeight: checked ? '700' : '400' }}>{s.label}</Text>
                </Pressable>
                {s.key === 'tikuvchiga_berildi' && canAssign && (
                  <AssignChips title="Tikuvchilar" list={workers.filter((w) => w.role_id === 'tikuvchi')} o={o} task="tikish" onToggle={assign} />
                )}
                {s.key === 'karniz_ustanovka' && canAssign && (
                  <AssignChips title="Ustalar" list={workers.filter((w) => w.role_id === 'usta')} o={o} task="ornatish" onToggle={assign} />
                )}
              </View>
            );
          })}
          {/* Ogohlantirish ro'yxat ostida — bosqichlar orasiga tushib, qatorlarni siljitmaydi */}
          {missing.map((k) => (
            <Text key={k} style={{ fontSize: 12, color: t.amber, lineHeight: 17 }}>
              {k === 'dazmolandi' ? 'Tikuvchi' : 'Usta'} biriktirilmagan — ish haqi hisoblanmaydi. Yuqorida {k === 'dazmolandi' ? 'tikuvchini' : 'ustani'} belgilang.
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}

function AssignChips({ title, list, o, task, onToggle }: { title: string; list: StaffLite[]; o: OrderListItem; task: 'tikish' | 'ornatish'; onToggle: (w: StaffLite, on: boolean) => void }) {
  const { t } = useTheme();
  return (
    <View style={{ marginLeft: 30, marginBottom: 6, gap: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted }}>{title}</Text>
      {list.length === 0 ? <Text style={{ fontSize: 12, color: t.muted }}>Hali {title.toLowerCase()} qo‘shilmagan (Admin panel → Xodimlar).</Text> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {list.map((w) => {
            const on = o.assignees.some((a) => a.staff_id === w.id && a.task === task);
            return (
              <Pressable key={w.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => onToggle(w, !on)}
                style={{ minHeight: 34, paddingLeft: 5, paddingRight: 12, borderRadius: 17, borderWidth: 1, borderColor: on ? t.teal : t.border, backgroundColor: on ? t.tealLight : t.card, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Avatar name={w.full_name} path={w.avatar_path} size={24} />
                {on && <Icon name="check" color={t.teal} size={12} strokeWidth={3} />}
                <Text style={{ fontSize: 12, fontWeight: on ? '700' : '500', color: on ? t.teal : t.text }}>{w.full_name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Buyurtma foydasi: summa − bog'langan xarajatlar − ish haqi */
function OrderProfitBox({ orderId }: { orderId: string }) {
  const { t } = useTheme();
  const [p, setP] = useState<OrderProfit | null>(null);
  const load = useCallback(() => { loadOrderProfit(orderId).then(setP).catch(() => {}); }, [orderId]);
  useEffect(load, [load]);
  useMoneyLive(load);
  if (!p) return null;
  const row = (label: string, v: string, color = t.text) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <Text style={{ fontSize: 13, color: t.muted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color }}>{v}</Text>
    </View>
  );
  return (
    <Card style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: t.text }}>Buyurtma foydasi</Text>
      {row('Buyurtma summasi', fmtSom(p.total))}
      {row('Bog‘langan xarajatlar', `${p.expenses ? '−' : ''}${fmtSom(p.expenses)}`, p.expenses ? t.red : t.muted)}
      {row('Ishchilar ish haqi', `${p.payroll ? '−' : ''}${fmtSom(p.payroll)}`, p.payroll ? t.red : t.muted)}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.divider }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: t.text }}>Foyda</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: p.profit < 0 ? t.red : t.teal }}>{p.profit < 0 ? '−' : ''}{fmtSom(Math.abs(p.profit))}</Text>
      </View>
    </Card>
  );
}

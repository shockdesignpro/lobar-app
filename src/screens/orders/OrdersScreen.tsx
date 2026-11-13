import { useMemo, useRef, useState } from 'react';
import type { OrdersPreset } from '../HomeScreen';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import { can, type Access } from '../../lib/auth';
import type { Draft } from '../../lib/order/model';
import {
  archiveOrder, createdFrom, loadOrderDraft, orderNumber, payStatus, readySoon, restoreOrder, useOrders, type OrderListItem,
} from '../../lib/orders';
import { receiptFileName, receiptHtml } from '../../lib/receipt';
import { trackUrl } from '../../lib/track';
import { downloadReceipt, isIOS, makeReceiptImage, shareReceipt, type ReceiptImage } from '../../lib/receiptImage';
import { Card, Intro, Loading, Note } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { Select } from '../../ui/Select';
import { useSnack } from '../../ui/SnackContext';
import { useTheme } from '../../ui/ThemeContext';
import { Input } from '../order/parts';
import { MiniAction, OrderHead } from './OrderCard';
import { OrderDetail } from './OrderDetail';

type PayF = 'all' | 'none' | 'partial' | 'full' | 'unpaid';
type DateF = 'all' | 'today' | 'week' | 'month';
type SortF = 'yangi' | 'muddat';

export function OrdersScreen({ access, onEdit, focusId, setFocusId, preset }: {
  access: Access; onEdit: (d: Draft) => void; focusId: string | null; setFocusId: (id: string | null) => void;
  preset?: OrdersPreset | null;
}) {
  const { t } = useTheme();
  const snack = useSnack();
  const full = can(access, 'orders.view_all');
  const money = can(access, 'prices.view') && full;
  const { items, error } = useOrders(full);
  const [q, setQ] = useState('');
  const [pay, setPay] = useState<PayF>(preset?.pay ?? 'all');
  const [dateF, setDateF] = useState<DateF>('all');
  const [sort, setSort] = useState<SortF>(preset?.sort ?? 'yangi');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const receipts = useRef(new Map<string, ReceiptImage>());

  const list = useMemo(() => {
    const raw = q.trim(); const digits = raw.replace(/\D/g, ''); const lower = raw.toLowerCase();
    const from = createdFrom(dateF);
    let r = (items ?? []).filter((o) => {
      const search = !raw || (digits && (o.client_phone ?? '').replace(/\D/g, '').includes(digits)) || o.client_name.toLowerCase().includes(lower);
      const dateOk = from === null || new Date(o.created_at).getTime() >= from;
      const payOk = pay === 'all' || (pay === 'unpaid' ? payStatus(o) !== 'full' : payStatus(o) === pay);
      return search && dateOk && payOk;
    });
    if (sort === 'muddat') r = r.slice().sort((a, b) => (a.ready_date ?? '9999').localeCompare(b.ready_date ?? '9999'));
    return r;
  }, [items, q, pay, dateF, sort]);

  const activeFilters = (pay !== 'all' ? 1 : 0) + (dateF !== 'all' ? 1 : 0) + (sort !== 'yangi' ? 1 : 0);
  const focused = focusId ? (items ?? []).find((o) => o.id === focusId) ?? null : null;

  const edit = async (o: OrderListItem) => {
    try { onEdit(await loadOrderDraft(o, true)); snack('Tahrirlash rejimi — o‘zgartirib, “Chek tayyorlash”ni bosing'); }
    catch (e) { snack(e instanceof Error ? e.message : 'Ochilmadi'); }
  };
  const share = async (o: OrderListItem) => {
    try {
      let img = receipts.current.get(o.id);
      if (!img) {
        snack('Rasm tayyorlanmoqda...');
        const d = await loadOrderDraft(o, true);
        const date = new Date(o.created_at).getTime();
        img = await makeReceiptImage(receiptHtml(d, { number: orderNumber(o), date, orderId: o.id }), receiptFileName(o.client_name, date));
        receipts.current.set(o.id, img);
        // iPhone'da ulashish oynasi faqat bevosita bosishda ochiladi: rasm tayyor, yana bir bor bosiladi
        if (isIOS()) { snack('Chek tayyor — ulashish uchun yana bir bor bosing'); return; }
        if (Platform.OS === 'web') void downloadReceipt(img);
      }
      if (!(await shareReceipt(img)) && !isIOS()) downloadReceipt(img);
    } catch (e) { snack(e instanceof Error ? e.message : 'Chek tayyorlanmadi'); }
  };
  const remove = async (o: OrderListItem) => {
    const { error: e } = await archiveOrder(o.id);
    if (e) { snack(e.message); return; }
    if (focusId === o.id) setFocusId(null);
    snack(`“${o.client_name}” buyurtmasi o‘chirildi`, { label: 'BEKOR QILISH', run: async () => { await restoreOrder(o.id); snack('Tiklandi'); } });
  };

  // Mijozga kuzatish havolasi: Telegram / SMS / WhatsApp (telefonning ulashish oynasi), bo'lmasa nusxa
  const shareTrack = async (o: OrderListItem) => {
    const url = trackUrl(o.id);
    const message = `Assalomu alaykum${o.client_name ? `, ${o.client_name}` : ''}! Pardangiz holatini shu havola orqali kuzatishingiz mumkin:\n${url}\n\n“Lobar” pardalar uyi`;
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text?: string; url?: string }) => Promise<void> };
        if (nav.share) { await nav.share({ text: message }); return; }
        await navigator.clipboard.writeText(message);
        snack('Havola nusxalandi — Telegram yoki SMS ga qo‘ying');
        return;
      }
      await Share.share({ message });
    } catch { /* bekor qilindi */ }
  };

  const actions = (o: OrderListItem) => (
    <>
      {can(access, 'orders.edit') && <MiniAction icon="edit" label="Buyurtmani tahrirlash" onPress={() => edit(o)} />}
      {money && <MiniAction icon="share" label="Chekni ulashish" onPress={() => share(o)} />}
      {money && <MiniAction icon="link" label="Mijozga kuzatish havolasini yuborish" onPress={() => shareTrack(o)} />}
      {can(access, 'archive.send') && <MiniAction icon="trash" label="Buyurtmani o‘chirish" danger onPress={() => remove(o)} />}
    </>
  );

  if (!items) return <Loading />;

  if (focused) {
    return (
      <>
        <Pressable accessibilityRole="button" onPress={() => setFocusId(null)}
          style={{ minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: t.teal, backgroundColor: t.tealLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="back" color={t.teal} size={16} />
          <Text style={{ color: t.teal, fontWeight: '700', fontSize: 14 }}>Orqaga</Text>
        </Pressable>
        <Card style={{ gap: 12 }}>
          <OrderHead o={focused} actions={actions(focused)} showMoney={money} />
          <OrderDetail o={focused} access={access} />
        </Card>
      </>
    );
  }

  const soon = readySoon(items);

  return (
    <>
      <Intro overline="MIJOZLAR VA ISH JARAYONI" title="Buyurtmalar" />

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="search" color={t.teal} size={16} strokeWidth={2.2} />
          <Text style={{ fontSize: 14, fontWeight: '800', color: t.tealDark }}>Mijozni qidirish</Text>
        </View>
        <Input accessibilityLabel="Mijoz ismi yoki telefon raqami" placeholder="Mijoz ismi yoki telefon raqami" value={q} onChangeText={setQ} />
      </Card>

      {soon.length > 0 && (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Icon name="clock" color={t.amber} size={16} />
            <Text style={{ fontSize: 14, fontWeight: '800', color: t.amber }}>Yaqin kunlarda tayyor bo‘ladigan</Text>
          </View>
          {soon.map(({ order: o, today }) => (
            <Pressable key={o.id} accessibilityRole="button" onPress={() => setFocusId(o.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.divider }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: today ? '#d94040' : '#e8a020' }} />
              <Text style={{ flex: 1, fontSize: 13, color: t.text }}>{today ? 'Bugun' : 'Ertaga'} — {o.client_name}</Text>
              <Text style={{ fontSize: 13, color: t.muted }}>{o.client_phone}</Text>
            </Pressable>
          ))}
        </Card>
      )}

      {full && (
        <Card padded={false}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(!filtersOpen)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 }}>
            <View style={{ transform: [{ rotate: filtersOpen ? '90deg' : '0deg' }] }}><Icon name="chevron" color={t.tealDark} size={14} strokeWidth={2.6} /></View>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: t.tealDark }}>Buyurtmalarni saralash {activeFilters ? `(${activeFilters})` : ''}</Text>
          </Pressable>
          {filtersOpen && (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: t.text }}>Filtrlar</Text>
                <Pressable accessibilityRole="button" onPress={() => { setPay('all'); setDateF('all'); setSort('yangi'); }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: t.teal }}>Tozalash</Text>
                </Pressable>
              </View>
              {money && <Select label="To‘lov holati" value={pay} onChange={setPay} options={[
                { key: 'all', label: 'Barcha to‘lovlar' }, { key: 'none', label: 'To‘lanmagan' }, { key: 'partial', label: 'Qisman to‘langan' },
                { key: 'full', label: 'To‘liq to‘langan' }, { key: 'unpaid', label: 'Barcha qarzdorlar' }]} />}
              <Select label="Buyurtma yaratilgan kun" value={dateF} onChange={setDateF} options={[
                { key: 'all', label: 'Barcha kunlar' }, { key: 'today', label: 'Bugun' }, { key: 'week', label: 'Shu hafta' }, { key: 'month', label: 'Shu oy' }]} />
              <Select label="Ko‘rsatish tartibi" value={sort} onChange={setSort} options={[
                { key: 'yangi', label: 'Yangi buyurtmalar avval' }, { key: 'muddat', label: 'Topshirish muddati bo‘yicha' }]} />
            </View>
          )}
        </Card>
      )}

      {!!error && <Note tone="error">{error}</Note>}
      {list.length === 0 ? (
        <Card><Text style={{ textAlign: 'center', color: t.muted, fontSize: 14, paddingVertical: 10 }}>
          {items.length ? 'Bu raqam yoki ism bo‘yicha buyurtma topilmadi.' : full ? 'Hali buyurtmalar yo‘q.' : 'Sizga hali buyurtma biriktirilmagan.'}
        </Text></Card>
      ) : list.map((o) => (
        <Card key={o.id}>
          <OrderHead o={o} onOpen={() => setFocusId(o.id)} actions={actions(o)} showMoney={money} />
        </Card>
      ))}
    </>
  );
}

import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { type Access } from '../../lib/auth';
import { useProducts } from '../../lib/catalog';
import { fmtSom } from '../../lib/format';
import { receiptFileName, receiptHtml } from '../../lib/receipt';
import { supabase } from '../../lib/supabase';
import { autoDownloadAfterSave, downloadReceipt, makeReceiptImage, shareReceipt, type ReceiptImage } from '../../lib/receiptImage';
import { clearDraft, loadMacros, loadUsage, saveDraftToServer, useDraft, type Macro } from '../../lib/order/draft';
import {
  emptyDraft, isDraftEmpty, resolveTarget, totals, validateCustomer, validateServices, type CatalogItem, type Draft,
} from '../../lib/order/model';
import { Button, Card, Loading, Screen } from '../../ui/components';
import { confirmAsk } from '../../ui/confirm';
import { Icon } from '../../ui/Icon';
import { useSnack } from '../../ui/SnackContext';
import { useTheme } from '../../ui/ThemeContext';
import { StepClient } from './StepClient';
import { StepServices } from './StepServices';
import { StepSummary } from './StepSummary';

const TITLES = { 1: 'Yangi buyurtma', 2: 'Mahsulot va xizmatlar', 3: 'Hisobni tekshirish' } as const;

export function OrderEditor({ initial, onExit }: { access: Access; initial: Draft | null; onExit: () => void }) {
  const { t } = useTheme();
  const snack = useSnack();
  const { items } = useProducts();
  const catalog: CatalogItem[] = useMemo(() => (items ?? []).map((p) => ({ id: p.id, name: p.name, section: p.section, price: p.price, unit: p.unit })), [items]);
  const [draft, setDraft] = useDraft(initial);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<{ roomId: string | null | undefined; openingId: string | null | undefined }>({ roomId: undefined, openingId: undefined });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ no: number; total: number } | null>(null);
  const [receipt, setReceipt] = useState<ReceiptImage | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => { loadMacros().then(setMacros).catch(() => {}); loadUsage().then(setUsage); }, []);

  const target = resolveTarget(draft, sel.roomId, sel.openingId);
  // Xato belgisi faqat muammo hali tuzatilmagan bo'lsa ko'rinadi (tuzatilishi bilan yo'qoladi)
  const liveProblem = draft.step === 1 ? validateCustomer(draft)?.field : draft.step === 2 ? validateServices(draft, catalog)?.field : undefined;
  const shownInvalid = invalid && invalid === liveProblem ? invalid : null;
  const step = draft.step;
  const tot = totals(draft);

  const goStep = (to: 1 | 2 | 3) => {
    if (to > 1) {
      const p = validateCustomer(draft);
      if (p) { setInvalid(p.field); snack(p.message); setDraft((d) => ({ ...d, step: 1 })); return; }
    }
    if (to > 2) {
      const p = validateServices(draft, catalog);
      if (p) { setInvalid(p.field); snack(p.message); setDraft((d) => ({ ...d, step: 2 })); return; }
    }
    setInvalid(null);
    if (to === 2 && step !== 2) setSel({ roomId: draft.rooms[0]?.id ?? null, openingId: undefined });
    setDraft((d) => ({ ...d, step: to }));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const save = async () => {
    const p1 = validateCustomer(draft); if (p1) { goStep(1); return; }
    const p2 = validateServices(draft, catalog); if (p2) { goStep(2); return; }
    setSaving(true);
    let result: { order_no: number; total: number } | null = null;
    try {
      result = await saveDraftToServer(draft, catalog);
      await clearDraft();
      setSaved({ no: result.order_no, total: Number(result.total) });
    } catch (e) {
      snack(e instanceof Error ? e.message : 'Saqlanmadi');
      setSaving(false);
      return;
    }
    setSaving(false);
    // Chek rasmi (eski ilovadagidek darhol tayyorlanadi)
    setReceiptBusy(true);
    try {
      let now = Date.now();
      if (draft.orderId) {
        // Tahrirlangan buyurtma chekida asl yaratilgan sana qoladi (eski ilovadagidek)
        const { data } = await supabase.from('orders').select('created_at').eq('id', draft.orderId).maybeSingle();
        if (data?.created_at) now = new Date(data.created_at).getTime();
      }
      const img = await makeReceiptImage(receiptHtml(draft, { number: String(result.order_no).padStart(4, '0'), date: now }), receiptFileName(draft.client.name, now));
      setReceipt(img);
      if (autoDownloadAfterSave()) { downloadReceipt(img); snack('Chek rasmi saqlandi'); }
    } catch (e) {
      snack('Chek rasmini tayyorlab bo‘lmadi: ' + (e instanceof Error ? e.message : ''));
    } finally { setReceiptBusy(false); }
  };

  const newClient = async () => {
    if (isDraftEmpty(draft)) return;
    if (!(await confirmAsk('Yangi mijoz uchun boshlaymiz? Joriy kiritilgan ma’lumotlar (mijoz, xonalar, hisob) tozalanadi.', 'Boshlash'))) return;
    setDraft(() => emptyDraft()); setInvalid(null); snack('Yangi mijoz');
  };

  if (saved) {
    return (
      <Screen title="Chek tayyor" onBack={onExit}>
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" color={t.teal} size={28} strokeWidth={2.4} />
          </View>
          <Text style={{ fontSize: 19, fontWeight: '800', color: t.text, textAlign: 'center' }}>Buyurtma №{String(saved.no).padStart(4, '0')} saqlandi</Text>
          <Text style={{ fontSize: 15, color: t.muted }}>Jami: {fmtSom(saved.total)}</Text>
        </Card>
        {receiptBusy && <Loading />}
        {receipt && Platform.OS === 'web' && (
          <View style={{ alignItems: 'center' }}>
            <Image accessibilityLabel="Chek" source={{ uri: receipt.uri }} resizeMode="contain"
              style={{ width: '100%', maxWidth: 400, aspectRatio: receipt.width / Math.max(1, receipt.height), borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: '#ffffff' }} />
          </View>
        )}
        {receipt && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Ulashish" icon="upload" style={{ flex: 1 }} onPress={async () => { if (!(await shareReceipt(receipt))) snack('Bu qurilmada ulashish yo‘q — “Yuklab olish”ni bosing'); }} />
            {Platform.OS === 'web' && <Button kind="soft" label="Yuklab olish" icon="download" style={{ flex: 1 }} onPress={() => downloadReceipt(receipt)} />}
          </View>
        )}
        <Text style={{ fontSize: 12, color: t.muted, textAlign: 'center', lineHeight: 18 }}>
          {Platform.OS === 'web' ? 'iPhone’da “Ulashish” → “Rasmni saqlash” orqali chek galereyaga tushadi.' : 'Chek PDF fayl sifatida ulashiladi: Telegram, galereya yoki fayllarga.'}
        </Text>
        <Button kind="soft" label="Bosh sahifa" onPress={onExit} />
        <Button kind="soft" label="Yangi buyurtma" icon="plus" onPress={() => { setSaved(null); setReceipt(null); setDraft(() => emptyDraft()); }} />
      </Screen>
    );
  }

  const dock = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: t.card, borderTopWidth: 1, borderTopColor: t.border, justifyContent: 'center' }}>
      <View style={{ flex: 1, maxWidth: 640 - 180 }}>
        <Text style={{ fontSize: 12, color: t.muted }}>Jami hisob</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: t.text }}>{fmtSom(tot.grand)}</Text>
      </View>
      <Button
        label={step === 3 ? 'Chek tayyorlash' : 'Davom etish'} icon={step === 3 ? 'check' : undefined}
        busy={saving} onPress={() => (step === 3 ? save() : goStep((step + 1) as 2 | 3))}
        style={{ minWidth: 150 }}
      />
    </View>
  );

  return (
    <Screen
      title={draft.orderId ? 'Buyurtma tahriri' : TITLES[step]} caption={`BUYURTMA · ${step} / 3`}
      onBack={() => (step === 1 ? onExit() : goStep((step - 1) as 1 | 2))}
      dock={dock} scrollRef={scrollRef}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 14 }}>
        {(['Mijoz', 'Xizmatlar', 'Hisob'] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3; const on = n === step;
          return (
            <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => goStep(n)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: on ? t.tealLight : 'transparent' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: on ? t.teal : t.greyLight, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#ffffff' : t.muted }}>{n}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: on ? '700' : '500', color: on ? t.teal : t.muted }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!items ? <Loading /> : step === 1 ? (
        <StepClient draft={draft} setDraft={setDraft} catalog={catalog} invalid={shownInvalid} onNewClient={newClient} />
      ) : step === 2 ? (
        <StepServices draft={draft} setDraft={setDraft} catalog={catalog} target={target} macros={macros} usage={usage} invalid={shownInvalid}
          setTarget={(roomId, openingId) => setSel({ roomId, openingId })} />
      ) : (
        <StepSummary draft={draft} />
      )}
    </Screen>
  );
}


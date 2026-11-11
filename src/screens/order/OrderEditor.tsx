import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Access } from '../../lib/auth';
import { useProducts } from '../../lib/catalog';
import { fmtSom } from '../../lib/format';
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
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => { loadMacros().then(setMacros).catch(() => {}); loadUsage().then(setUsage); }, []);

  const target = resolveTarget(draft, sel.roomId, sel.openingId);
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
    try {
      const r = await saveDraftToServer(draft, catalog);
      await clearDraft();
      setSaved({ no: r.order_no, total: Number(r.total) });
    } catch (e) {
      snack(e instanceof Error ? e.message : 'Saqlanmadi');
    } finally { setSaving(false); }
  };

  const newClient = async () => {
    if (isDraftEmpty(draft)) return;
    if (!(await confirmAsk('Yangi mijoz uchun boshlaymiz? Joriy kiritilgan ma’lumotlar (mijoz, xonalar, hisob) tozalanadi.', 'Boshlash'))) return;
    setDraft(() => emptyDraft()); setInvalid(null); snack('Yangi mijoz');
  };

  if (saved) {
    return (
      <Screen title="Buyurtma saqlandi" onBack={onExit}>
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" color={t.teal} size={30} strokeWidth={2.4} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: t.text }}>Buyurtma №{String(saved.no).padStart(4, '0')} saqlandi</Text>
          <Text style={{ fontSize: 15, color: t.muted }}>Jami: {fmtSom(saved.total)}</Text>
          <Text style={{ fontSize: 12, color: t.muted, textAlign: 'center', lineHeight: 18 }}>Buyurtma hamma qurilmada ko‘rinadi. Chekni rasm qilib saqlash keyingi qismda qo‘shiladi.</Text>
        </Card>
        <Button label="Bosh sahifa" onPress={onExit} />
        <Button kind="soft" label="Yangi buyurtma" icon="plus" onPress={() => { setSaved(null); setDraft(() => emptyDraft()); }} />
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
        label={step === 3 ? 'Buyurtmani saqlash' : 'Davom etish'} icon={step === 3 ? 'check' : undefined}
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
        <StepClient draft={draft} setDraft={setDraft} catalog={catalog} invalid={invalid} onNewClient={newClient} />
      ) : step === 2 ? (
        <StepServices draft={draft} setDraft={setDraft} catalog={catalog} target={target} macros={macros} usage={usage} invalid={invalid}
          setTarget={(roomId, openingId) => setSel({ roomId, openingId })} />
      ) : (
        <StepSummary draft={draft} />
      )}
    </Screen>
  );
}

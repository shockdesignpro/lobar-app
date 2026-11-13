import { Pressable, Text, View } from 'react-native';
import { fmtN, fmtSom } from '../../lib/format';
import {
  addRow, applyMacro, currentSectionSum, isCurrentRow, isRoomRow, openingLabel, removeRow, roomDimensions, roomHasGeneralRows,
  roomTotal, rowSum, sectionProducts, setRowPrice, setRowProduct, setRowQty, type CatalogItem, type CostTarget, type Draft, type Section,
} from '../../lib/order/model';
import { newId, type Macro } from '../../lib/order/draft';
import { Card } from '../../ui/components';
import { Icon, type IconName } from '../../ui/Icon';
import { useSnack } from '../../ui/SnackContext';
import { useTheme } from '../../ui/ThemeContext';
import { Select } from '../../ui/Select';
import { NumberInput, priceText, SectionHeader, SoftButton } from './parts';

const META: Record<Section, { icon: IconName; title: string; add: string; total: string; color: 'teal' | 'amber' | 'purple' }> = {
  mahsulot: { icon: 'box', title: 'Xarajatlar', add: 'Mahsulot qo‘shish', total: 'Xarajatlar jami:', color: 'teal' },
  tikish: { icon: 'scissors', title: 'Tikish xizmati', add: 'Tikish xizmati', total: 'Tikish jami:', color: 'amber' },
  ustanovka: { icon: 'wrench', title: 'O‘rnatish xizmati', add: 'O‘rnatish xizmati', total: 'O‘rnatish jami:', color: 'purple' },
};

export function StepServices({ draft, setDraft, catalog, target, setTarget, macros, usage, invalid }: {
  draft: Draft; setDraft: (fn: (d: Draft) => Draft) => void; catalog: CatalogItem[];
  target: CostTarget; setTarget: (roomId: string | null, openingId?: string | null) => void;
  macros: Macro[]; usage: Record<string, number>; invalid: string | null;
}) {
  const { t } = useTheme();
  const snack = useSnack();
  const room = draft.rooms.find((r) => r.id === target.roomId) ?? null;
  const hasUnassigned = draft.rows.some((r) => r.roomId == null);
  const roomOptions: { id: string | null; label: string }[] = [
    ...draft.rooms.map((r, i) => ({ id: r.id as string | null, label: `${i + 1}. ${r.name}` })),
    ...((hasUnassigned || !draft.rooms.length || target.roomId === null) ? [{ id: null, label: 'Umumiy / xonaga biriktirilmagan' }] : []),
  ];
  const tabs = room && room.openings.length >= 2
    ? [...room.openings.map((o, i) => ({ id: o.id as string | null, label: openingLabel(room.openings, i) })), ...(roomHasGeneralRows(draft, room.id) ? [{ id: null, label: 'Umumiy' }] : [])]
    : [];

  const colorOf = (c: 'teal' | 'amber' | 'purple') => ({ teal: t.teal, amber: t.amber, purple: t.purple }[c]);

  const add = (section: Section, productId?: string) => {
    const next = addRow(draft, section, catalog, target, newId, productId);
    if (!next) { snack('Avval katalogga mahsulot qo‘shing!'); return; }
    setDraft(() => next);
    if (productId) snack(`${catalog.find((p) => p.id === productId)?.name ?? ''} qo‘shildi`);
  };

  const runMacro = (m: Macro) => {
    const pool = catalog.filter((p) => p.section === 'mahsulot');
    const list = m.product_ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is CatalogItem => !!p);
    if (!list.length) { snack(`“${m.name}” makrosiga mahsulot biriktirilmagan`); return; }
    setDraft((d) => applyMacro(d, list, target, newId));
    const missing = m.product_ids.length - list.length;
    snack(`${m.name}: ${list.length} ta mahsulot qo‘shildi — miqdorlarini kiriting${missing ? ` (${missing} tasi katalogda topilmadi)` : ''}`);
  };

  return (
    <>
      {/* Xona tanlash */}
      <View style={{ backgroundColor: t.tealDark === '#095c47' ? '#0b6a52' : t.tealMid, borderRadius: 15, padding: 14, gap: 10 }}>
        <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>Xona xarajatlari</Text>
        <Select variant="light" accessibilityLabel="Xona" value={target.roomId ?? '__general'}
          options={roomOptions.map((o) => ({ key: o.id ?? '__general', label: o.label }))}
          onChange={(k) => setTarget(k === '__general' ? null : k)} />
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17 }}>{room ? roomDimensions(room) : 'Xonaga biriktirilmagan xarajatlar'}</Text>
        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '800' }}>Shu xona jami: {fmtSom(roomTotal(draft, target.roomId))}</Text>
        {/* Deraza/eshik tanlash — xona kartasi ichida */}
        {tabs.length > 0 && (
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
            {tabs.map((tb) => {
              const on = (tb.id ?? '') === (target.openingId ?? '');
              return (
                <Pressable key={tb.id ?? 'general'} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTarget(target.roomId, tb.id)}
                  style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: on ? '#ffffff' : 'rgba(255,255,255,0.55)', backgroundColor: on ? '#ffffff' : 'transparent', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#0b6a52' : '#ffffff' }}>{tb.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {(['mahsulot', 'tikish', 'ustanovka'] as Section[]).map((section) => {
        const meta = META[section];
        const prods = sectionProducts(catalog, section);
        const rows = draft.rows.filter((r) => r.section === section && isCurrentRow(draft, r, target));
        return (
          <View key={section} style={{ gap: 8 }}>
            <SectionHeader icon={meta.icon} title={meta.title} right={section === 'mahsulot' ? (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {macros.map((m) => <SoftButton key={m.id} label={m.name} small onPress={() => runMacro(m)} />)}
              </View>
            ) : undefined} />
            <Card style={{ gap: 10 }}>
              {!prods.length ? (
                <Text style={{ fontSize: 14, color: t.muted }}>Bu bo‘limda mahsulot yo‘q.</Text>
              ) : (
                <>
                  {rows.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Text style={[colHead(t.muted), { flex: 2.1 }]}>Nomi</Text>
                      <Text style={[colHead(t.muted), { flex: 1.3, textAlign: 'center' }]}>Narx</Text>
                      <Text style={[colHead(t.muted), { flex: 0.85, textAlign: 'center' }]}>Miqdor</Text>
                      <Text style={[colHead(t.muted), { flex: 1.45, textAlign: 'center' }]}>Summa</Text>
                      <View style={{ width: 26 }} />
                    </View>
                  )}
                  {rows.map((row) => {
                    const known = prods.some((p) => p.id === row.productId);
                    return (
                      <View key={row.id} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                        <View style={{ flex: 2.1, minWidth: 0 }}>
                          <Select compact accessibilityLabel={section === 'mahsulot' ? 'Mahsulot' : 'Xizmat'} value={known ? (row.productId as string) : ''}
                            placeholder="Mahsulot topilmadi — tanlang" invalid={!known}
                            options={prods.map((p) => ({ key: p.id, label: p.name }))}
                            onChange={(id) => { const p = prods.find((x) => x.id === id); if (p) setDraft((d) => setRowProduct(d, row.id, p)); }} />
                        </View>
                        <NumberInput accessibilityLabel={`${row.productName} narxi`} value={row.price} format={priceText} money
                          onValue={(v) => setDraft((d) => setRowPrice(d, row.id, v ?? 0))}
                          style={{ flex: 1.3, textAlign: 'center', fontSize: 14, paddingHorizontal: 2 }} />
                        <NumberInput accessibilityLabel={`${row.productName} miqdori`} value={row.qty} allowEmpty placeholder="1"
                          invalid={invalid === `row:${row.id}` && known}
                          onValue={(v) => setDraft((d) => setRowQty(d, row.id, v))}
                          style={{ flex: 0.85, textAlign: 'center', fontSize: 14, paddingHorizontal: 2 }} />
                        <Text style={{ flex: 1.45, minWidth: 0, textAlign: 'center', fontSize: 12.5, fontWeight: '700', color: t.text }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{fmtN(rowSum(row))}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={`${row.productName} qatorini o‘chirish`} onPress={() => setDraft((d) => removeRow(d, row.id))}
                          style={{ width: 26, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="trash" color={t.muted} size={17} />
                        </Pressable>
                      </View>
                    );
                  })}
                  <SoftButton label={meta.add} onPress={() => add(section)} />
                </>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: t.divider }}>
                <Text style={{ fontSize: 13, color: t.muted }}>{meta.total}</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colorOf(meta.color) }}>{fmtSom(currentSectionSum(draft, section, target))}</Text>
              </View>
            </Card>
          </View>
        );
      })}

      {!draft.rows.some((r) => isRoomRow(r, target.roomId)) && draft.rooms.length > 0 && (
        <Text style={{ fontSize: 12, color: t.muted }}>Har bir xona uchun xarajatlarni yuqoridagi tanlovdan xonani almashtirib kiriting.</Text>
      )}
    </>
  );
}

const colHead = (color: string) => ({ fontSize: 12, color, fontWeight: '500' as const });

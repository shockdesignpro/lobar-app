import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import {
  addOpening, addRoom, COLORS, isoDatePlus, normalizePhone, openingLabel, RAIL_TYPES, removeOpening, removeRoom,
  updateOpening, updateRoomName, type CatalogItem, type Draft,
} from '../../lib/order/model';
import { newId } from '../../lib/order/draft';
import { Card } from '../../ui/components';
import { Select } from '../../ui/Select';
import { DateField } from '../../ui/DateField';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../ui/ThemeContext';
import { Input, Label, SectionHeader, SoftButton } from './parts';
import { PhotoEditor } from '../../ui/Photos';

export function StepClient({ draft, setDraft, catalog, invalid, onNewClient }: {
  draft: Draft; setDraft: (fn: (d: Draft) => Draft) => void; catalog: CatalogItem[]; invalid: string | null; onNewClient: () => void;
}) {
  const { t } = useTheme();
  const wide = useWindowDimensions().width >= 760;
  const c = draft.client;
  const setClient = (patch: Partial<Draft['client']>) => setDraft((d) => ({ ...d, client: { ...d.client, ...patch } }));
  const chipDays = [3, 5, 7];
  const activeChip = chipDays.find((n) => c.readyDate === isoDatePlus(n));

  return (
    <>
      <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderLeftWidth: 4, borderLeftColor: t.teal, borderRadius: 15, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.divider }}>
          <Icon name="user" color={t.teal} size={18} />
          <Text accessibilityRole="header" style={{ flex: 1, fontSize: 16, fontWeight: '800', color: t.text }}>Mijoz ma’lumotlari</Text>
          <SoftButton label="Yangi" small onPress={onNewClient} />
        </View>
        <View>
          <Label>Mijoz (ism, familya) *</Label>
          <Input accessibilityLabel="Mijoz ismi" autoComplete="off" importantForAutofill="no" value={c.name} onChangeText={(v) => setClient({ name: v })} invalid={invalid === 'name'} autoCapitalize="words" />
        </View>
        <View>
          <Label>Manzil *</Label>
          <Input accessibilityLabel="Manzil" autoComplete="off" importantForAutofill="no" value={c.address} onChangeText={(v) => setClient({ address: v })} invalid={invalid === 'address'} />
        </View>
        <View>
          <Label>Tel raqam *</Label>
          <Input accessibilityLabel="Telefon raqami" autoComplete="off" importantForAutofill="no" value={c.phone} keyboardType="phone-pad" invalid={invalid === 'phone'}
            onChangeText={(v) => setClient({ phone: normalizePhone(v) })} />
        </View>
        <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: t.divider }}>
          <Label>Tayyor bo‘lish sanasi (ixtiyoriy)</Label>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {chipDays.map((n) => {
              const on = activeChip === n;
              return (
                <Pressable key={n} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setClient({ readyDate: isoDatePlus(n) })}
                  style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: on ? t.teal : t.border, backgroundColor: on ? t.tealLight : t.card, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: on ? '700' : '500', color: on ? t.teal : t.muted }}>+{n} kun</Text>
                </Pressable>
              );
            })}
          </View>
          <DateField label="Tayyor bo‘lish sanasi" value={c.readyDate} onChange={(v) => setClient({ readyDate: v })} />
          <Text style={{ fontSize: 11, color: t.muted, marginTop: 8, lineHeight: 16 }}>Topshirish sanasi bosh sahifada va buyurtmalar ro‘yxatida ko‘rinadi.</Text>
        </View>
        <Text style={{ fontSize: 11, color: t.muted }}>* To‘ldirilishi kerak bo‘lgan maydonlar</Text>
      </View>

      <SectionHeader icon="layout" title="Xona o‘lchamlari" />

      {draft.rooms.length === 0 && (
        <Card><Text style={{ fontSize: 14, fontWeight: '700', color: t.text, textAlign: 'center' }}>Birinchi xonani qo‘shing</Text>
          <Text style={{ fontSize: 12, color: t.muted, textAlign: 'center', marginTop: 4 }}>Deraza yoki eshik o‘lchamlarini alohida saqlang.</Text></Card>
      )}

      {draft.rooms.map((room, idx) => (
        <Card key={room.id} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: t.teal, fontWeight: '800', fontSize: 12 }}>{String(idx + 1).padStart(2, '0')}</Text>
            </View>
            <Input accessibilityLabel="Xona nomi" placeholder="Xona nomi" maxLength={80} value={room.name} style={{ flex: 1 }}
              onChangeText={(v) => setDraft((d) => updateRoomName(d, room.id, v))} />
            <Pressable accessibilityRole="button" accessibilityLabel="Xonani olib tashlash" onPress={() => setDraft((d) => removeRoom(d, room.id))}
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash" color={t.muted} size={18} />
            </Pressable>
          </View>

          {room.openings.map((o, oi) => (
            <View key={o.id} style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: t.divider, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name={o.kind === 'eshik' ? 'door' : 'window'} color={t.teal} size={16} />
                <Text style={{ flex: 1, marginLeft: 6, fontSize: 13, fontWeight: '800', color: t.text }}>{openingLabel(room.openings, oi)}</Text>
                {room.openings.length > 1 && (
                  <Pressable accessibilityRole="button" accessibilityLabel={`${openingLabel(room.openings, oi)}ni olib tashlash`}
                    onPress={() => setDraft((d) => removeOpening(d, room.id, o.id))} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="close" color={t.muted} size={16} />
                  </Pressable>
                )}
              </View>
              {/* Keng ekranda (iPad, kompyuter) to'rttasi bir qatorda — eski ilovadagidek (760px dan) */}
              <View style={{ flexDirection: wide ? 'row' : 'column', gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8, flex: wide ? 1 : undefined }}>
                <View style={{ flex: 1 }}>
                  <Label>Bo‘yi · m</Label>
                  <Input accessibilityLabel={`${openingLabel(room.openings, oi)} bo‘yi`} placeholder="0.00" keyboardType="decimal-pad" value={o.height}
                    invalid={invalid === `opening:${o.id}:height`}
                    onChangeText={(v) => setDraft((d) => updateOpening(d, room.id, o.id, 'height', v, catalog, newId))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Label>Eni · m</Label>
                  <Input accessibilityLabel={`${openingLabel(room.openings, oi)} eni`} placeholder="0.00" keyboardType="decimal-pad" value={o.width}
                    invalid={invalid === `opening:${o.id}:width`}
                    onChangeText={(v) => setDraft((d) => updateOpening(d, room.id, o.id, 'width', v, catalog, newId))} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flex: wide ? 1 : undefined }}>
                <View style={{ flex: 1 }}>
                  <Select label="Karniz turi" value={o.rail} options={RAIL_TYPES.map((x) => ({ key: x, label: x }))}
                    onChange={(v) => setDraft((d) => updateOpening(d, room.id, o.id, 'rail', v, catalog, newId))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Select label="Rangi" value={o.color} options={COLORS.map((x) => ({ key: x, label: x }))}
                    onChange={(v) => setDraft((d) => updateOpening(d, room.id, o.id, 'color', v, catalog, newId))} />
                </View>
              </View>
              </View>
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SoftButton label="Deraza" style={{ flex: 1 }} onPress={() => setDraft((d) => addOpening(d, room.id, 'deraza', newId))} />
            <SoftButton label="Eshik" style={{ flex: 1 }} onPress={() => setDraft((d) => addOpening(d, room.id, 'eshik', newId))} />
          </View>
        </Card>
      ))}

      <SoftButton label="Xona qo‘shish" style={{ minHeight: 50 }} onPress={() => setDraft((d) => addRoom(d, newId))} />
      <Text style={{ fontSize: 12, color: t.muted, lineHeight: 17 }}>O‘lchamlarni metrda kiriting. Eni tikish va o‘rnatish hisobiga avtomatik o‘tadi.</Text>

      <SectionHeader icon="image" title="Andozalar" />
      <PhotoEditor photos={draft.photos ?? []} onChange={(fn) => setDraft((d) => ({ ...d, photos: fn(d.photos ?? []) }))} />
    </>
  );
}

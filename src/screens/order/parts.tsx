// Buyurtma ekranlari uchun kichik umumiy qismlar
import { useEffect, useState } from 'react';
import { groupTyping } from '../../lib/format';
import { Platform, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { type CatalogItem, type Section } from '../../lib/order/model';
import { fmtN } from '../../lib/format';
import { SearchBox, Sheet } from '../../ui/components';
import { Icon, type IconName } from '../../ui/Icon';
import { useTheme } from '../../ui/ThemeContext';

export function Label({ children }: { children: string }) {
  const { t } = useTheme();
  return <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted, marginBottom: 6 }}>{children}</Text>;
}

/** Ixcham kiritish maydoni (xatoli holatda qizil, yozilayotganda yashil chegara) */
export function Input({ invalid, style, onFocus, onBlur, ...p }: TextInputProps & { invalid?: boolean }) {
  const { t } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...p}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      style={[{
        minHeight: 44, borderRadius: 10, borderWidth: invalid || focused ? 1.5 : 1, borderColor: invalid ? t.red : focused ? t.teal : t.border,
        backgroundColor: t.input, paddingHorizontal: 12, fontSize: 16, color: t.text, minWidth: 0,
      }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object), style]}
    />
  );
}

/** Raqam maydoni: yozayotganda matn o'zgarmaydi, chiqqanda chiroyli formatlanadi */
export function NumberInput({ value, onValue, allowEmpty, format, money, ...p }: Omit<TextInputProps, 'value'> & {
  value: number | null; onValue: (v: number | null) => boolean | void; allowEmpty?: boolean; format?: (v: number | null) => string; invalid?: boolean;
  /** summa: yozish paytida mingliklarga ajratib ko'rsatiladi (1 000, 50 000, 1 000 000) */
  money?: boolean;
}) {
  const show = format ?? ((v: number | null) => (v == null ? '' : String(v)));
  const [text, setText] = useState(show(value));
  const [focused, setFocused] = useState(false);
  const [bad, setBad] = useState(false);
  useEffect(() => { if (!focused) setText(show(value)); }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Input
      {...p}
      invalid={bad || p.invalid}
      keyboardType="decimal-pad"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setBad(false); setText(show(value)); }}
      onChangeText={(input) => {
        const v = money ? groupTyping(input) : input;
        setText(v);
        const raw = v.replace(/\s/g, '').replace(',', '.');
        if (raw === '' && allowEmpty) { setBad(false); onValue(null); return; }
        const n = raw === '' ? 0 : /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) ? Number(raw) : NaN;
        if (!Number.isFinite(n)) { setBad(true); return; }
        setBad(false); onValue(n);
      }}
    />
  );
}

export const priceText = (v: number | null) => (v == null ? '' : String(v).replace(/^(\d+)/, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')));

export function SectionHeader({ icon, title, right }: { icon: IconName; title: string; right?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
      <Icon name={icon} color={t.text} size={18} />
      <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '800', color: t.text, flex: 1 }}>{title}</Text>
      {right}
    </View>
  );
}

export function SoftButton({ label, onPress, icon = 'plus', style, small }: { label: string; onPress: () => void; icon?: IconName; style?: object; small?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [{
        minHeight: small ? 36 : 44, paddingHorizontal: small ? 12 : 14, borderRadius: small ? 18 : 10, borderWidth: 1, borderColor: t.teal,
        backgroundColor: t.tealLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.8 : 1,
      }, style]}>
      <Icon name={icon} color={t.teal} size={small ? 14 : 16} strokeWidth={2} />
      <Text style={{ color: t.teal, fontWeight: '700', fontSize: small ? 12 : 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Mahsulot tanlash oynasi (qidiruv bilan) */
export function ProductPicker({ visible, section, catalog, onPick, onClose }: {
  visible: boolean; section: Section; catalog: CatalogItem[]; onPick: (p: CatalogItem) => void; onClose: () => void;
}) {
  const { t } = useTheme();
  const [q, setQ] = useState('');
  useEffect(() => { if (visible) setQ(''); }, [visible]);
  const list = catalog.filter((p) => p.section === section && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())));
  const titles: Record<Section, string> = { mahsulot: 'Mahsulot tanlang', tikish: 'Tikish xizmatini tanlang', ustanovka: 'O‘rnatish xizmatini tanlang' };
  return (
    <Sheet visible={visible} onClose={onClose} title={titles[section]}>
      <SearchBox value={q} onChange={setQ} placeholder="Qidirish" />
      <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 12, overflow: 'hidden' }}>
        {list.length === 0 && <Text style={{ padding: 14, color: t.muted }}>Hech narsa topilmadi.</Text>}
        {list.map((p, i) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => onPick(p)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: t.divider, backgroundColor: pressed ? t.tealLight : t.card })}>
            <Text style={{ flex: 1, fontSize: 15, color: t.text }}>{p.name}</Text>
            <Text style={{ fontSize: 13, color: t.muted }}>{fmtN(p.price)} so‘m / {p.unit}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

// Telefon ilovasi: tizimning o'z ro'yxati.
// iPhone — iOS pastdan chiqadigan tanlov oynasi, Android — Android tanlov oynasi.
import { Picker } from '@react-native-picker/picker';
import { ActionSheetIOS, Platform, Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from './ThemeContext';

export type SelectProps<K extends string> = {
  label?: string;
  value: K;
  options: { key: K; label: string }[];
  onChange: (k: K) => void;
  /** 'light' — rangli karta ichidagi oq maydon */
  variant?: 'default' | 'light';
  /** jadval ichidagi ixcham ko'rinish */
  compact?: boolean;
  invalid?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
};

export function Select<K extends string>({ label, value, options, onChange, variant = 'default', compact, invalid, placeholder, accessibilityLabel }: SelectProps<K>) {
  const { t } = useTheme();
  const light = variant === 'light';
  const current = options.find((o) => o.key === value);
  const text = current?.label ?? placeholder ?? 'Tanlang';

  const box = (
    <View style={{
      minHeight: compact ? 44 : light ? 48 : 46, borderRadius: 10, borderWidth: light ? 0 : invalid ? 1.5 : 1,
      borderColor: invalid ? t.red : t.border, backgroundColor: light ? '#ffffff' : t.input,
      paddingLeft: compact ? 8 : 14, paddingRight: compact ? 4 : 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    }}>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: compact ? 13 : 16, fontWeight: compact ? '600' : '400', color: light ? '#1a2420' : current ? t.text : invalid ? t.red : t.muted }}>{text}</Text>
      <View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="chevron" color={light ? '#5f7369' : t.muted} size={compact ? 14 : 18} /></View>
    </View>
  );

  const control = Platform.OS === 'ios' ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${accessibilityLabel ?? label ?? ''}: ${text}`}
      onPress={() => ActionSheetIOS.showActionSheetWithOptions(
        { title: label ?? accessibilityLabel, options: [...options.map((o) => o.label), 'Bekor qilish'], cancelButtonIndex: options.length },
        (i) => { if (i < options.length) onChange(options[i].key); },
      )}>
      {box}
    </Pressable>
  ) : (
    // Android: ko'rinadigan maydon ustida shaffof Picker — bosilganda tizim oynasi ochiladi
    <View>
      {box}
      <Picker
        accessibilityLabel={accessibilityLabel ?? label}
        selectedValue={current ? value : undefined}
        onValueChange={(v) => { if (v != null && v !== '') onChange(v as K); }}
        mode="dialog" prompt={label ?? accessibilityLabel}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}>
        {!current && <Picker.Item label={placeholder ?? 'Tanlang'} value="" enabled={false} />}
        {options.map((o) => <Picker.Item key={o.key} label={o.label} value={o.key} />)}
      </Picker>
    </View>
  );

  if (!label) return control;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}>{label}</Text>
      {control}
    </View>
  );
}

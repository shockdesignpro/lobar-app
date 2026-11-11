// Brauzer: haqiqiy <select>. Telefon brauzerida tizimning o'z ro'yxati ochiladi
// (iPhone'da iOS g'ildiragi, Android'da Android oynasi) — eski PWA'dagidek.
import { Text, View } from 'react-native';
import { unstable_createElement } from 'react-native-web';
import { useTheme } from './ThemeContext';
import type { SelectProps } from './Select';

export function Select<K extends string>({ label, value, options, onChange, variant = 'default', compact, invalid, placeholder, accessibilityLabel }: SelectProps<K>) {
  const { t, mode } = useTheme();
  const light = variant === 'light';
  const known = options.some((o) => o.key === value);
  const fg = light ? '#1a2420' : known ? t.text : t.red;
  const chevron = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='${light ? '#5f7369' : t.muted}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>`);
  const select = unstable_createElement('select', {
    value: known ? value : '',
    'aria-label': accessibilityLabel ?? label,
    'aria-invalid': invalid ? 'true' : undefined,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value as K),
    style: {
      boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: compact ? 44 : light ? 48 : 46,
      borderRadius: 10, border: light ? '0' : `${invalid ? 1.5 : 1}px solid ${invalid ? t.red : t.border}`,
      background: `${light ? '#ffffff' : t.input} url("data:image/svg+xml,${chevron}") no-repeat right ${compact ? 6 : 12}px center`,
      color: fg, paddingTop: 0, paddingBottom: 0, paddingLeft: compact ? 8 : 14, paddingRight: compact ? 22 : 38, fontSize: compact ? 13 : 16, fontWeight: compact ? 600 : 400,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', outline: 'none',
      textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', colorScheme: light ? 'light' : mode, cursor: 'pointer',
    },
    children: [
      ...(!known ? [unstable_createElement('option', { key: '__none', value: '', disabled: true, children: placeholder ?? 'Tanlang' })] : []),
      ...options.map((o) => unstable_createElement('option', { key: o.key, value: o.key, children: o.label })),
    ],
  });
  if (!label) return select;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}>{label}</Text>
      {select}
    </View>
  );
}

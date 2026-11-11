// Brauzer: oddiy <input type="date">
import { unstable_createElement } from 'react-native-web';
import { useTheme } from './ThemeContext';

export function DateField({ value, onChange, label }: { value: string; onChange: (iso: string) => void; label: string }) {
  const { t, mode } = useTheme();
  return unstable_createElement('input', {
    type: 'date',
    value,
    'aria-label': label,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    style: {
      boxSizing: 'border-box', width: '100%', minHeight: 46, borderRadius: 10, border: `1px solid ${t.border}`,
      background: t.input, color: t.text, paddingTop: 0, paddingBottom: 0, paddingLeft: 14, paddingRight: 12, fontSize: 16, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", colorScheme: mode, outline: 'none',
    },
  });
}

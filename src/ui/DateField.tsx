// Telefon: tugma bosilganda tizimning sana tanlash oynasi ochiladi
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useTheme } from './ThemeContext';

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const isoToText = (iso: string) => (iso ? iso.split('-').reverse().join('.') : '');

export function DateField({ value, onChange, label }: { value: string; onChange: (iso: string) => void; label: string }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)}
        style={{ minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.input, paddingHorizontal: 14, justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, color: value ? t.text : t.muted }}>{value ? isoToText(value) : 'kk.oo.yyyy'}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={value ? new Date(`${value}T12:00:00`) : new Date()}
          mode="date"
          onChange={(e, d) => { setOpen(false); if (e.type === 'set' && d) onChange(toIso(d)); }}
        />
      )}
    </>
  );
}

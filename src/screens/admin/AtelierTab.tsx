// Atelye ma'lumotlari: mijozning kuzatish sahifasida "Savollar bo'lsa" qismida ko'rinadi
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Button, Card, Field, Loading, Note } from '../../ui/components';
import { useTheme } from '../../ui/ThemeContext';

export function AtelierTab() {
  const { t } = useTheme();
  const [phone, setPhone] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    supabase.from('app_settings').select('key, value').in('key', ['atelier_phone', 'atelier_address']).then(({ data }) => {
      const get = (k: string) => String((data ?? []).find((r) => r.key === k)?.value ?? '');
      setPhone(get('atelier_phone')); setAddress(get('atelier_address'));
    });
  }, []);

  if (phone === null) return <Loading />;

  const save = async () => {
    setBusy(true); setMsg(null);
    const rows = [{ key: 'atelier_phone', value: phone.trim() }, { key: 'atelier_address', value: address.trim() }];
    let error: { message: string } | null = null;
    for (const r of rows) {
      ({ error } = await supabase.from('app_settings').update({ value: r.value }).eq('key', r.key));
      if (error) break;
    }
    setBusy(false);
    setMsg(error ? { tone: 'error', text: error.message } : { tone: 'ok', text: 'Saqlandi' });
  };

  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ fontSize: 13, color: t.muted, lineHeight: 19 }}>
        Mijoz kuzatish havolasini ochganda shu telefon (qo‘ng‘iroq tugmasi bilan) va manzil ko‘rinadi.
      </Text>
      <Field label="Telefon" placeholder="+998 90 123 45 67" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Manzil" placeholder="Masalan: Toshkent, Chilonzor 5-mavze" value={address} onChangeText={setAddress} />
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <View><Button label="Saqlash" onPress={save} busy={busy} /></View>
    </Card>
  );
}

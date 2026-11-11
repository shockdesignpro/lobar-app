// Makroslar: "Xarajatlar" bo'limida bir bosishda bir nechta mahsulot qo'shadigan tugmalar
// (eski ilovadagi Sozlamalar → Makroslar). O'zgarish hamma qurilmaga darhol tarqaladi.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Product } from '../lib/catalog';
import { loadMacros, type Macro } from '../lib/order/draft';
import { supabase } from '../lib/supabase';
import { Button, Note, Sheet } from '../ui/components';
import { Icon } from '../ui/Icon';
import { Select } from '../ui/Select';
import { useTheme } from '../ui/ThemeContext';
import { Input } from './order/parts';

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export function MacrosSheet({ visible, onClose, products, onSaved }: { visible: boolean; onClose: () => void; products: Product[]; onSaved: (msg: string) => void }) {
  const { t } = useTheme();
  const [macros, setMacros] = useState<Macro[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pool = products.filter((p) => p.section === 'mahsulot');

  useEffect(() => { if (visible) { setErr(''); loadMacros().then(setMacros); } }, [visible]);

  const update = (i: number, patch: Partial<Macro>) => setMacros((m) => m && m.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    if (!macros) return;
    setBusy(true); setErr('');
    for (const [i, m] of macros.entries()) {
      const row = { kind: m.kind, name: m.name.trim().slice(0, 40) || (m.kind === 'baget' ? 'Baget' : 'Potolok karniz'), product_ids: m.product_ids, sort_order: i };
      const { error } = isUuid(m.id)
        ? await supabase.from('macros').update(row).eq('id', m.id)
        : await supabase.from('macros').insert(row);
      if (error) { setErr(error.message); setBusy(false); return; }
    }
    setBusy(false);
    onSaved('Makroslar saqlandi');
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Makroslar">
      <Note>Makros — bir nechta mahsulotdan iborat tayyor to‘plam. Buyurtma kiritayotganda “Xarajatlar” bo‘limidagi tugma bosilsa, shu mahsulotlar miqdori bo‘sh holda qo‘shiladi.</Note>
      {!macros ? null : macros.map((m, i) => {
        const attached = m.product_ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Product => !!p);
        const free = pool.filter((p) => !m.product_ids.includes(p.id));
        return (
          <View key={m.kind} style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.border }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}>Tugma nomi</Text>
            <Input accessibilityLabel="Makros tugmasi nomi" value={m.name} maxLength={40} onChangeText={(v) => update(i, { name: v })} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted, marginTop: 4 }}>Mahsulotlar ({attached.length})</Text>
            {attached.length === 0 && <Text style={{ fontSize: 13, color: t.muted }}>Hali mahsulot biriktirilmagan.</Text>}
            {attached.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                <Text style={{ flex: 1, fontSize: 14, color: t.text }}>{p.name}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`${p.name}ni olib tashlash`} onPress={() => update(i, { product_ids: m.product_ids.filter((x) => x !== p.id) })}
                  style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" color={t.red} size={16} />
                </Pressable>
              </View>
            ))}
            {free.length > 0 && (
              <Select accessibilityLabel="Mahsulot qo‘shish" value="" placeholder="+ Mahsulot qo‘shish"
                options={free.map((p) => ({ key: p.id, label: p.name }))}
                onChange={(id) => update(i, { product_ids: [...m.product_ids, id] })} />
            )}
          </View>
        );
      })}
      {!!err && <Note tone="error">{err}</Note>}
      <Button label="Saqlash" onPress={save} busy={busy} />
      <Pressable accessibilityRole="button" onPress={onClose} style={{ alignItems: 'center', paddingVertical: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: t.muted }}>Bekor qilish</Text>
      </Pressable>
    </Sheet>
  );
}

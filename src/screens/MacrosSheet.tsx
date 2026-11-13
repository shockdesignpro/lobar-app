// Makroslar: buyurtma kiritishda bir bosishda bir nechta mahsulot yoki xizmat qo'shadigan tugmalar.
// Har bir makros Xarajatlar, Tikish yoki O'rnatish bo'limiga tegishli. O'zgarish hamma qurilmaga tarqaladi.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Product } from '../lib/catalog';
import { fmtN } from '../lib/format';
import { loadMacros, type Macro } from '../lib/order/draft';
import type { Section } from '../lib/order/model';
import { supabase } from '../lib/supabase';
import { Button, Note, Sheet } from '../ui/components';
import { confirmAsk } from '../ui/confirm';
import { Icon, type IconName } from '../ui/Icon';
import { Select } from '../ui/Select';
import { useTheme } from '../ui/ThemeContext';
import { Input } from './order/parts';

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const SECTIONS: { key: Section; label: string; icon: IconName }[] = [
  { key: 'mahsulot', label: 'Xarajatlar', icon: 'box' },
  { key: 'tikish', label: 'Tikish', icon: 'scissors' },
  { key: 'ustanovka', label: 'O‘rnatish', icon: 'wrench' },
];
let tmp = 0;

export function MacrosSheet({ visible, onClose, products, onSaved }: { visible: boolean; onClose: () => void; products: Product[]; onSaved: (msg: string) => void }) {
  const { t } = useTheme();
  const [macros, setMacros] = useState<Macro[] | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const tone = (s: Section) => ({ mahsulot: t.teal, tikish: t.amber, ustanovka: t.purple }[s]);

  useEffect(() => { if (visible) { setErr(''); setRemoved([]); loadMacros().then(setMacros); } }, [visible]);

  const update = (id: string, patch: Partial<Macro>) => setMacros((m) => m && m.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addMacro = () => setMacros((m) => [...(m ?? []), { id: `new-${++tmp}`, name: '', section: 'mahsulot', product_ids: [] }]);
  const removeMacro = async (m: Macro) => {
    if (!(await confirmAsk(`“${m.name || 'Nomsiz makros'}” o‘chirilsinmi?`, 'O‘chirish'))) return;
    setMacros((list) => list && list.filter((x) => x.id !== m.id));
    if (isUuid(m.id)) setRemoved((r) => [...r, m.id]);
  };
  const setSection = (m: Macro, s: Section) => {
    // Boshqa bo'limga o'tganda, u bo'limga tegishli bo'lmagan mahsulotlar olib tashlanadi
    const keep = m.product_ids.filter((id) => products.find((p) => p.id === id)?.section === s);
    update(m.id, { section: s, product_ids: keep });
  };

  const save = async () => {
    if (!macros) return;
    const unnamed = macros.find((m) => !m.name.trim());
    if (unnamed) { setErr('Har bir makrosga nom bering'); return; }
    setBusy(true); setErr('');
    for (const id of removed) {
      const { error } = await supabase.from('macros').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) { setErr(error.message); setBusy(false); return; }
    }
    for (const [i, m] of macros.entries()) {
      const row = { name: m.name.trim().slice(0, 40), section: m.section, product_ids: m.product_ids, sort_order: i };
      const { error } = isUuid(m.id)
        ? await supabase.from('macros').update(row).eq('id', m.id)
        : await supabase.from('macros').insert({ ...row, kind: 'custom' });
      if (error) { setErr(error.message); setBusy(false); return; }
    }
    setBusy(false);
    onSaved('Makroslar saqlandi');
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Makroslar">
      <Text style={{ fontSize: 13, color: t.muted, lineHeight: 19 }}>
        Makros — tayyor to‘plam. Buyurtma kiritayotganda tegishli bo‘lim yonidagi tugma bosilsa, shu mahsulotlar miqdori bo‘sh holda qo‘shiladi.
      </Text>

      {!macros ? null : macros.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 18 }}>
          <Icon name="zap" color={t.muted} size={26} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: t.text }}>Hali makros yo‘q</Text>
          <Text style={{ fontSize: 12, color: t.muted }}>Pastdagi tugma bilan birinchisini qo‘shing.</Text>
        </View>
      ) : macros.map((m) => {
        const pool = products.filter((p) => p.section === m.section);
        const attached = m.product_ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Product => !!p);
        const free = pool.filter((p) => !m.product_ids.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
        const color = tone(m.section);
        return (
          <View key={m.id} style={{ borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, overflow: 'hidden' }}>
            {/* Rangli chiziq — qaysi bo'limga tegishli */}
            <View style={{ height: 4, backgroundColor: color }} />
            <View style={{ padding: 12, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Input accessibilityLabel="Makros nomi" placeholder="Makros nomi (masalan: Baget)" value={m.name} maxLength={40}
                    onChangeText={(v) => update(m.id, { name: v })} />
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Makrosni o‘chirish" onPress={() => removeMacro(m)}
                  style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.redLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trash" color={t.red} size={18} />
                </Pressable>
              </View>

              {/* Bo'lim tanlash */}
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 6 }}>
                {SECTIONS.map((s) => {
                  const on = m.section === s.key;
                  const c = tone(s.key);
                  return (
                    <Pressable key={s.key} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setSection(m, s.key)}
                      style={{ flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: on ? c : t.border, backgroundColor: on ? c : 'transparent',
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 }}>
                      <Icon name={s.icon} color={on ? '#ffffff' : t.muted} size={14} />
                      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: on ? '#ffffff' : t.muted }}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Mahsulotlar ro'yxati */}
              <View style={{ borderRadius: 10, backgroundColor: t.input, overflow: 'hidden' }}>
                {attached.length === 0 ? (
                  <Text style={{ fontSize: 13, color: t.muted, padding: 12 }}>Hali mahsulot qo‘shilmagan</Text>
                ) : attached.map((p, j) => (
                  <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 4, minHeight: 46,
                    borderTopWidth: j ? 1 : 0, borderTopColor: t.divider }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>{j + 1}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: t.text }} numberOfLines={1}>{p.name}</Text>
                      <Text style={{ fontSize: 11, color: t.muted }}>{fmtN(p.price)} so‘m / {p.unit}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${p.name}ni olib tashlash`} hitSlop={4}
                      onPress={() => update(m.id, { product_ids: m.product_ids.filter((x) => x !== p.id) })}
                      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="close" color={t.muted} size={16} />
                    </Pressable>
                  </View>
                ))}
              </View>
              {free.length > 0 ? (
                <Select accessibilityLabel="Mahsulot qo‘shish" value="" placeholder={`+ ${m.section === 'mahsulot' ? 'Mahsulot' : 'Xizmat'} qo‘shish`}
                  options={free.map((p) => ({ key: p.id, label: p.name }))}
                  onChange={(id) => update(m.id, { product_ids: [...m.product_ids, id] })} />
              ) : pool.length === 0 ? (
                <Text style={{ fontSize: 12, color: t.muted }}>Katalogda bu bo‘limda mahsulot yo‘q.</Text>
              ) : null}
            </View>
          </View>
        );
      })}

      <Button label="Yangi makros" icon="plus" kind="soft" onPress={addMacro} />
      {!!err && <Note tone="error">{err}</Note>}
      <Button label="Saqlash" onPress={save} busy={busy} />
    </Sheet>
  );
}

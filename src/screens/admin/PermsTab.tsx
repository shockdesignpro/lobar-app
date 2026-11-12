import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { PERM_GROUPS } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';
import { Button, Card, Chips, Loading, Note, SectionTitle, SwitchRow } from '../../ui/components';
import { useTheme } from '../../ui/ThemeContext';

type Row = { action: string; allowed: boolean; limit_value: number | null };
type RoleKey = 'direktor' | 'tikuvchi' | 'usta';

export function PermsTab() {
  const { t } = useTheme();
  const [role, setRole] = useState<RoleKey>('direktor');
  const [orig, setOrig] = useState<Record<string, Row> | null>(null);
  const [vals, setVals] = useState<Record<string, Row>>({});
  const [lock, setLock] = useState(5);
  const [lockOrig, setLockOrig] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setOrig(null);
    const [p, s] = await Promise.all([
      supabase.from('permissions').select('action, allowed, limit_value').eq('role_id', role),
      supabase.from('app_settings').select('value').eq('key', 'auto_lock_minutes').maybeSingle(),
    ]);
    const m: Record<string, Row> = {};
    ((p.data as Row[]) ?? []).forEach((r) => { m[r.action] = r; });
    setOrig(m); setVals(m);
    const v = Number(s.data?.value ?? 5);
    setLock(v); setLockOrig(v);
  }, [role]);

  useEffect(() => { load(); setMsg(null); }, [load]);

  if (!orig) return <Loading />;

  const set = (k: string, patch: Partial<Row>) => setVals({ ...vals, [k]: { ...(vals[k] ?? { action: k, allowed: false, limit_value: null }), ...patch } });

  const save = async () => {
    setBusy(true); setMsg(null);
    const changed = Object.values(vals).filter((r) => {
      const o = orig[r.action];
      return !o || o.allowed !== r.allowed || (o.limit_value ?? null) !== (r.limit_value ?? null);
    });
    let error: { message: string } | null = null;
    if (changed.length) {
      ({ error } = await supabase.from('permissions')
        .upsert(changed.map((r) => ({ role_id: role, action: r.action, allowed: r.allowed, limit_value: r.limit_value })), { onConflict: 'role_id,action' }));
    }
    if (!error && lock !== lockOrig) {
      ({ error } = await supabase.from('app_settings').update({ value: lock }).eq('key', 'auto_lock_minutes'));
    }
    setBusy(false);
    if (error) setMsg({ tone: 'error', text: error.message });
    else { setMsg({ tone: 'ok', text: 'Saqlandi. O‘zgarish hamma qurilmada kuchga kirdi.' }); load(); }
  };

  const discount = vals['discount.give'];

  return (
    <View style={{ gap: 12 }}>
      <Chips label="Rol" value={role} onChange={setRole}
        items={[{ key: 'direktor', label: 'Direktor' }, { key: 'tikuvchi', label: 'Tikuvchi' }, { key: 'usta', label: 'Usta' }]} />

      {PERM_GROUPS.map((g) => (
        <Card key={g.title} padded={false} style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          <SectionTitle>{g.title}</SectionTitle>
          {g.items.map((it, i) => (
            <View key={it.key}>
              <SwitchRow label={it.label} hint={it.hint} value={!!vals[it.key]?.allowed}
                last={i === g.items.length - 1 && !it.limit} onChange={(v) => set(it.key, { allowed: v })} />
              {it.limit === 'percent' && vals[it.key]?.allowed && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: i === g.items.length - 1 ? 0 : 1, borderBottomColor: t.divider }}>
                  <Text style={{ flex: 1, fontSize: 13, color: t.muted }}>Chegirma chegarasi</Text>
                  <TextInput accessibilityLabel="Chegirma chegarasi, foiz" keyboardType="number-pad" maxLength={3}
                    value={String(discount?.limit_value ?? 0)}
                    onChangeText={(v) => set(it.key, { limit_value: Math.min(100, Number(v.replace(/\D/g, '') || 0)) })}
                    style={{ width: 70, height: 40, borderRadius: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.input, textAlign: 'center', fontSize: 16, fontWeight: '700', color: t.text }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: t.text }}>%</Text>
                </View>
              )}
            </View>
          ))}
        </Card>
      ))}

      <Card style={{ gap: 10 }}>
        <SectionTitle>Tizim (hamma uchun)</SectionTitle>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 14, color: t.text }}>Avtomatik qulflash (standart)</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: t.teal }}>{lock} daqiqa</Text>
        </View>
        <Slider accessibilityLabel="Avtomatik qulflash, daqiqa" minimumValue={1} maximumValue={10} step={1} value={lock}
          onValueChange={(v) => setLock(Math.round(v))} minimumTrackTintColor={t.teal} maximumTrackTintColor={t.switchOff} thumbTintColor={t.teal}
          style={{ width: '100%', height: 36 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11, color: t.muted }}>1 daqiqa</Text>
          <Text style={{ fontSize: 11, color: t.muted }}>10 daqiqa</Text>
        </View>
        <Note>Ilova shu vaqt ishlatilmasa, qayta kod so‘raydi. Har bir xodim o‘z telefonida ☰ → “Kod va qulflash” sahifasida boshqa vaqt yoki “Qulflanmasin”ni tanlashi mumkin — bu standart faqat tanlamaganlarga amal qiladi.</Note>
      </Card>

      <Button label="Saqlash" onPress={save} busy={busy} />
      {msg ? <Note tone={msg.tone}>{msg.text}</Note> : <Note>O‘zgarish internet bor hamma qurilmada darhol kuchga kiradi va tarixga yoziladi.</Note>}
    </View>
  );
}

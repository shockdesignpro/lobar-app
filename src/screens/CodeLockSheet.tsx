// Kod va qulflash: o'z kodini almashtirish (eski kod + yangi kod ikki marta) va avtomatik qulflanish vaqti
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { autoLockMinutes, changeMyCode, getLockPref, setLockPref, type Access } from '../lib/auth';
import { Button, Field, NO_SAVE, Note, Sheet } from '../ui/components';
import { Select } from '../ui/Select';
import { useSnack } from '../ui/SnackContext';
import { useTheme } from '../ui/ThemeContext';

const LOCK_OPTIONS = [
  ...Array.from({ length: 10 }, (_, i) => ({ key: String(i + 1), label: `${i + 1} daqiqa` })),
  { key: '0', label: 'Qulflanmasin' },
];

export function CodeLockSheet({ access, onClose }: { access: Access; onClose: () => void }) {
  const { t } = useTheme();
  const snack = useSnack();
  const minLen = access.level >= 100 ? 8 : access.level >= 50 ? 6 : 4;
  const [oldCode, setOld] = useState('');
  const [code, setCode] = useState('');
  const [code2, setCode2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lock, setLock] = useState<string>(String(autoLockMinutes(access)));

  useEffect(() => { getLockPref(access.staff_id).then((p) => { if (p != null) setLock(String(p)); }); }, [access.staff_id]);

  const clean = (v: string) => v.replace(/\s/g, '');
  const save = async () => {
    setErr('');
    if (!oldCode) { setErr('Eski kodni kiriting'); return; }
    if (code.length < minLen) { setErr(`Yangi kod kamida ${minLen} ta belgidan iborat bo‘lsin`); return; }
    if (code !== code2) { setErr('Yangi kod ikki marta bir xil yozilmadi'); return; }
    setBusy(true);
    const r = await changeMyCode(access.login, oldCode, code);
    setBusy(false);
    if (!r.ok) { setErr(r.error); setOld(''); return; }
    setOld(''); setCode(''); setCode2('');
    snack('Kod almashtirildi');
    onClose();
  };
  const pickLock = async (v: string) => {
    setLock(v);
    await setLockPref(access.staff_id, Number(v));
    snack(v === '0' ? 'Ilova o‘zi qulflanmaydi' : `Ilova ${v} daqiqa ishlatilmasa qulflanadi`);
  };

  return (
    <Sheet visible onClose={onClose} title="Kod va qulflash">
      <Text style={{ fontSize: 15, fontWeight: '800', color: t.text }}>Kodni almashtirish</Text>
      <Field label="Eski kod" value={oldCode} onChangeText={(v) => setOld(clean(v))} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={32} {...NO_SAVE} />
      <Field label={`Yangi kod (kamida ${minLen} ta harf yoki raqam)`} value={code} onChangeText={(v) => setCode(clean(v))} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={32} {...NO_SAVE} />
      <Field label="Yangi kodni takrorlang" value={code2} onChangeText={(v) => setCode2(clean(v))} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={32} {...NO_SAVE} />
      {!!code2 && code2 !== code && <Text style={{ fontSize: 12, color: t.red, marginTop: -6 }}>Kodlar bir xil emas</Text>}
      {!!err && <Note tone="error">{err}</Note>}
      <Button label="Kodni saqlash" onPress={save} busy={busy} />

      <View style={{ height: 1, backgroundColor: t.divider, marginVertical: 4 }} />
      <Text style={{ fontSize: 15, fontWeight: '800', color: t.text }}>Avtomatik qulflash</Text>
      <Select label="Ilova ishlatilmasa, qulflansin" value={lock} options={LOCK_OPTIONS} onChange={pickLock} />
      <Text style={{ fontSize: 12, color: t.muted, lineHeight: 17 }}>
        {lock === '0'
          ? 'Ilova o‘zi qulflanmaydi. Telefon boshqa birovning qo‘liga tushsa, ichidagi ma’lumotlar ochiq bo‘ladi.'
          : 'Tanlangan vaqt davomida hech narsa bosilmasa, ilova qulflanadi va qayta kod so‘raydi. Bu sozlama shu qurilmaga tegishli.'}
      </Text>
    </Sheet>
  );
}

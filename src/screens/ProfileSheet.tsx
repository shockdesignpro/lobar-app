// Shaxsiy profil: rasm, ism, kod va avtomatik qulflash — hammasi bitta sahifada
import { useState } from 'react';
import { Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { type Access } from '../lib/auth';
import { pickAvatar } from '../lib/photos';
import { saveProfile } from '../lib/profile';
import { Avatar } from '../ui/Avatar';
import { Button, Field, Note, Sheet } from '../ui/components';
import { Icon, type IconName } from '../ui/Icon';
import { useSnack } from '../ui/SnackContext';
import { useTheme } from '../ui/ThemeContext';
import { CodeLockForm } from './CodeLockForm';

const AV = 112;

// Kamera oynasi faqat kerak bo'lganda yuklanadi: kamera moduli yo'q eski APK'da
// (havodan yangilanganda) ilova yiqilmasin — o'shanda telefonning oddiy kamerasi ochiladi.
type CamProps = { onClose: () => void; onPicked: (d: string) => void; onError: (m: string) => void };
let CamComp: ((p: CamProps) => import("react").ReactElement | null) | null | undefined;
function loadCamera() {
  if (CamComp === undefined) {
    try { CamComp = require('../ui/AvatarCamera').AvatarCamera; } catch { CamComp = null; }
  }
  return CamComp;
}

export function ProfileSheet({ access, onClose, onSaved }: { access: Access; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { t } = useTheme();
  const snack = useSnack();
  const [name, setName] = useState(access.full_name);
  // undefined — o'zgarmagan, null — olib tashlangan, string — yangi rasm
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cam, setCam] = useState(false);

  const shownUri = photo === undefined ? undefined : photo;
  const hasPhoto = photo === undefined ? !!access.avatar : !!photo;
  const dirty = photo !== undefined || name.trim().replace(/\s+/g, ' ') !== access.full_name;

  const pick = (src: 'camera' | 'library') => {
    setErr('');
    // Telefonda: o'zimizning kamera oynasi (chap pastda galereya)
    if (src === 'camera' && Platform.OS !== 'web' && loadCamera()) { setCam(true); return; }
    pickAvatar(src).then((p) => { if (p) setPhoto(p); }).catch((e: Error) => setErr(e.message));
  };
  const save = async () => {
    const n = name.trim().replace(/\s+/g, ' ');
    if (n.length < 2) { setErr('Ismni kiriting'); return; }
    setBusy(true); setErr('');
    const r = await saveProfile(access.staff_id, n, photo, access.avatar);
    if (!r.ok) { setBusy(false); setErr(r.error); return; }
    await onSaved();
    setBusy(false); setPhoto(undefined);
    snack('Profil saqlandi');
  };

  return (
    <Sheet visible onClose={onClose} title="Profil">
      <View style={{ alignItems: 'center', gap: 10 }}>
        <View style={{ width: AV, height: AV }}>
          {hasPhoto ? (
            <Avatar name={name || access.full_name} path={photo === undefined ? access.avatar : null} uri={shownUri} size={AV} />
          ) : (
            // Rasm yo'q: fotoapparat belgisi — bosilsa kamera ochiladi
            <Pressable accessibilityRole="button" accessibilityLabel="Rasmga olish" onPress={() => pick('camera')}
              style={({ pressed }) => ({ width: AV, height: AV, borderRadius: AV / 2, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
              <Icon name="camera" color={t.teal} size={38} strokeWidth={1.6} />
            </Pressable>
          )}
          {/* Chap pastda — qalamcha (kamerada qayta olish), o'ng pastda — rasmni olib tashlash */}
          {hasPhoto && <RoundBtn icon="pen" label="Rasmni o‘zgartirish (kamera)" onPress={() => pick('camera')} style={{ left: -2 }} />}
          {hasPhoto && <RoundBtn icon="trash" label="Rasmni olib tashlash" danger onPress={() => setPhoto(null)} style={{ right: -2 }} />}
        </View>
      </View>
      <Field label="Ism" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" autoComplete="off" />
      <Text style={{ fontSize: 12, color: t.muted, marginTop: -6 }}>Login: {access.login}</Text>
      {!!err && <Note tone="error">{err}</Note>}
      <Button label="Profilni saqlash" onPress={save} busy={busy} disabled={!dirty} />

      <View style={{ height: 1, backgroundColor: t.divider, marginVertical: 4 }} />
      <CodeLockForm access={access} />
      {cam && CamComp && <CamComp onClose={() => setCam(false)} onPicked={(d) => { setCam(false); setPhoto(d); }} onError={(m) => { setCam(false); setErr(m); }} />}
    </Sheet>
  );
}

function RoundBtn({ icon, label, onPress, style, danger }: { icon: IconName; label: string; onPress: () => void; style: ViewStyle; danger?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [{ position: 'absolute', bottom: -2, width: 38, height: 38, borderRadius: 19, backgroundColor: danger ? t.red : t.teal,
        borderWidth: 3, borderColor: t.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 }, style]}>
      <Icon name={icon} color="#ffffff" size={16} strokeWidth={2.2} />
    </Pressable>
  );
}

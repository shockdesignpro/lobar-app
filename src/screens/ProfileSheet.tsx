// Shaxsiy profil: rasm, ism, kod va avtomatik qulflash — hammasi bitta sahifada
import { useState } from 'react';
import { Text, View } from 'react-native';
import { type Access } from '../lib/auth';
import { pickAvatar } from '../lib/photos';
import { saveProfile } from '../lib/profile';
import { Avatar } from '../ui/Avatar';
import { Badge, Button, Field, Note, Sheet } from '../ui/components';
import { useSnack } from '../ui/SnackContext';
import { useTheme } from '../ui/ThemeContext';
import { CodeLockForm } from './CodeLockForm';

export function ProfileSheet({ access, onClose, onSaved }: { access: Access; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { t } = useTheme();
  const snack = useSnack();
  const [name, setName] = useState(access.full_name);
  // undefined — o'zgarmagan, null — olib tashlangan, string — yangi rasm
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const shownUri = photo === undefined ? undefined : photo;
  const hasPhoto = photo === undefined ? !!access.avatar : !!photo;
  const dirty = photo !== undefined || name.trim().replace(/\s+/g, ' ') !== access.full_name;

  const pick = (src: 'camera' | 'library') => {
    setErr('');
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
        <Avatar name={name || access.full_name} path={photo === undefined ? access.avatar : null} uri={shownUri} size={96} />
        <Badge label={access.role_name} tone="teal" />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Rasmga olish" icon="camera" kind="soft" onPress={() => pick('camera')} style={{ flex: 1 }} />
        <Button label="Galereyadan" icon="image" kind="soft" onPress={() => pick('library')} style={{ flex: 1 }} />
      </View>
      {hasPhoto && (
        <Button label="Rasmni olib tashlash" icon="trash" kind="soft" onPress={() => setPhoto(null)} />
      )}
      <Field label="Ism" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" autoComplete="off" />
      <Text style={{ fontSize: 12, color: t.muted, marginTop: -6 }}>Login: {access.login}</Text>
      {!!err && <Note tone="error">{err}</Note>}
      <Button label="Profilni saqlash" onPress={save} busy={busy} disabled={!dirty} />

      <View style={{ height: 1, backgroundColor: t.divider, marginVertical: 4 }} />
      <CodeLockForm access={access} />
    </Sheet>
  );
}

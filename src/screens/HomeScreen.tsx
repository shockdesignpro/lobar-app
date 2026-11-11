import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { can, isAdmin, type Access } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button, Card, Field, Intro, Note } from '../ui/components';
import { Icon, type IconName } from '../ui/Icon';
import { useTheme } from '../ui/ThemeContext';

const MONTHS = ['YANVAR', 'FEVRAL', 'MART', 'APREL', 'MAY', 'IYUN', 'IYUL', 'AVGUST', 'SENTABR', 'OKTABR', 'NOYABR', 'DEKABR'];
const DAYS = ['YAKSHANBA', 'DUSHANBA', 'SESHANBA', 'CHORSHANBA', 'PAYSHANBA', 'JUMA', 'SHANBA'];

export function MenuItem({ icon, title, sub, onPress, danger }: { icon: IconName; title: string; sub?: string; onPress: () => void; danger?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 15, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: danger ? t.redLight : t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={danger ? t.red : t.teal} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: danger ? t.red : t.text }}>{title}</Text>
        {sub && <Text style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{sub}</Text>}
      </View>
      {!danger && <Icon name="chevron" color={t.muted} />}
    </Pressable>
  );
}

export function HomeScreen({ access, onOpenAdmin, onSignOut }: { access: Access; onOpenAdmin: () => void; onSignOut: () => void }) {
  const { t } = useTheme();
  const d = new Date();
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const saveCode = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('set_staff_code', { p_staff: access.staff_id, p_code: code });
    setBusy(false);
    if (error) setMsg({ tone: 'error', text: error.message });
    else { setMsg({ tone: 'ok', text: 'Kod almashtirildi.' }); setCode(''); setCodeOpen(false); }
  };

  const showAdmin = isAdmin(access) || can(access, 'staff.manage_workers');

  return (
    <>
      <Intro overline={`${d.getDate()} ${MONTHS[d.getMonth()]} · ${DAYS[d.getDay()]}`} title="Bugungi ishlar" />

      <Card>
        <Text style={{ fontSize: 13, color: t.muted }}>Xush kelibsiz</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: t.text, marginTop: 2 }}>{access.full_name}</Text>
        <Text style={{ fontSize: 12, color: t.teal, fontWeight: '700', marginTop: 4 }}>{access.role_name} · {access.login}</Text>
      </Card>

      <Card style={{ backgroundColor: t.tealLight, borderColor: t.tealLight }}>
        <Text style={{ fontSize: 13, lineHeight: 19, color: t.text }}>
          Buyurtmalar, katalog, kalkulyator va hisobot keyingi bosqichda eski ilovadan shu yerga ko‘chiriladi.
        </Text>
      </Card>

      <View style={{ gap: 10 }}>
        {showAdmin && <MenuItem icon="users" title="Admin panel" sub={isAdmin(access) ? 'Xodimlar, ruxsatlar, tarix' : 'Tikuvchi va ustalar'} onPress={onOpenAdmin} />}
        <MenuItem icon="key" title="Kodni almashtirish" sub="Shaxsiy kirish kodingiz" onPress={() => { setCodeOpen(!codeOpen); setMsg(null); }} />
        {codeOpen && (
          <Card style={{ gap: 10 }}>
            <Field label="Yangi kod (harf va raqamlar)" value={code} onChangeText={(v) => setCode(v.replace(/\s/g, ''))}
              secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={32} />
            <Note>{access.level >= 100 ? 'Kamida 8 ta belgi, bo‘sh joysiz.' : access.level >= 50 ? 'Kamida 6 ta belgi, bo‘sh joysiz.' : 'Kamida 4 ta belgi, bo‘sh joysiz.'}</Note>
            <Button label="Saqlash" onPress={saveCode} busy={busy} />
          </Card>
        )}
        {msg && <Note tone={msg.tone}>{msg.text}</Note>}
        <MenuItem icon="logout" title="Chiqish" danger onPress={onSignOut} />
      </View>
    </>
  );
}

export function SoonScreen({ title }: { title: string }) {
  const { t } = useTheme();
  return (
    <>
      <Intro title={title} />
      <Card>
        <Text style={{ fontSize: 14, lineHeight: 20, color: t.text }}>Bu bo‘lim 5-bosqichda eski ilovadan ko‘chiriladi.</Text>
      </Card>
    </>
  );
}

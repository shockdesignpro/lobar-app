// O'ng tomondan chiqadigan "Sozlamalar" menyusi (yuqoridagi burger tugmasi orqali):
// Admin panel, eslatmalar, kodni almashtirish, tungi rejim va chiqish — hammasi bir joyda.
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can, isAdmin, type Access } from '../lib/auth';
import { pendingOps } from '../lib/offline';
import { supabase } from '../lib/supabase';
import { Badge, Button, Field, Note, SwitchRow } from '../ui/components';
import { confirmAsk } from '../ui/confirm';
import { Icon, type IconName } from '../ui/Icon';
import { useTheme } from '../ui/ThemeContext';
import { RemindersSheet } from './RemindersSheet';

export function SettingsMenu({ visible, onClose, access, onOpenAdmin, onSignOut }: {
  visible: boolean; onClose: () => void; access: Access; onOpenAdmin: () => void; onSignOut: () => void;
}) {
  const { t, mode, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelW = Math.min(360, Math.round(width * 0.86));
  const x = useRef(new Animated.Value(panelW)).current;
  const [shown, setShown] = useState(visible);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [remOpen, setRemOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setShown(true);
      x.setValue(panelW);
      Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: false }).start();
    } else if (shown) {
      Animated.timing(x, { toValue: panelW, duration: 180, useNativeDriver: false }).start(() => {
        setShown(false); setCodeOpen(false); setMsg(null); setCode('');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const showAdmin = isAdmin(access) || can(access, 'staff.manage_workers');
  const saveCode = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('set_staff_code', { p_staff: access.staff_id, p_code: code });
    setBusy(false);
    if (error) setMsg({ tone: 'error', text: error.message });
    else { setMsg({ tone: 'ok', text: 'Kod almashtirildi.' }); setCode(''); setCodeOpen(false); }
  };
  const go = (fn: () => void) => { onClose(); fn(); };

  return (
    <>
      <Modal visible={shown} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
        <View style={{ flex: 1 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Menyuni yopish" onPress={onClose}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          <Animated.View accessibilityViewIsModal
            style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: panelW, backgroundColor: t.bg, transform: [{ translateX: x }],
              borderTopLeftRadius: 20, borderBottomLeftRadius: 20, overflow: 'hidden', paddingTop: insets.top, paddingBottom: insets.bottom }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, gap: 10 }}>
              <Text accessibilityRole="header" style={{ flex: 1, fontSize: 22, fontWeight: '800', color: t.text }}>Sozlamalar</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose}
                style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" color={t.teal} size={18} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 10 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Kim kirgan */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 15, backgroundColor: t.tealLight }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.teal, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '800' }}>{(access.full_name || '?').trim().slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: t.text }} numberOfLines={1}>{access.full_name}</Text>
                  <View style={{ flexDirection: 'row' }}><Badge label={access.role_name} tone="teal" /></View>
                </View>
              </View>

              {showAdmin && (
                <Row icon="users" title="Admin panel" sub={isAdmin(access) ? 'Xodimlar, ruxsatlar, tarix' : 'Tikuvchi va ustalar'} onPress={() => go(onOpenAdmin)} />
              )}
              <Row icon="bell" title="Eslatmalar" sub="Topshirish kuni va bir kun oldin" onPress={() => go(() => setTimeout(() => setRemOpen(true), 260))} />
              <Row icon="key" title="Kodni almashtirish" sub="Shaxsiy kirish kodingiz" open={codeOpen} onPress={() => { setCodeOpen(!codeOpen); setMsg(null); }} />
              {codeOpen && (
                <View style={{ gap: 10, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}>
                  <Field label="Yangi kod (harf va raqamlar)" value={code} onChangeText={(v) => setCode(v.replace(/\s/g, ''))}
                    secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={32} />
                  <Note>{access.level >= 100 ? 'Kamida 8 ta belgi, bo‘sh joysiz.' : access.level >= 50 ? 'Kamida 6 ta belgi, bo‘sh joysiz.' : 'Kamida 4 ta belgi, bo‘sh joysiz.'}</Note>
                  <Button label="Saqlash" onPress={saveCode} busy={busy} />
                </View>
              )}
              {msg && <Note tone={msg.tone}>{msg.text}</Note>}
              <View style={{ paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}>
                <SwitchRow label="Tungi rejim" value={mode === 'dark'} onChange={toggle} last />
              </View>

              <View style={{ height: 6 }} />
              <Row icon="logout" title="Chiqish" danger onPress={async () => {
                const n = pendingOps().length;
                if (n && !(await confirmAsk(`Internetsiz kiritilgan ${n} ta o‘zgarish hali serverga yuborilmagan. Chiqsangiz, ular yo‘qoladi. Baribir chiqamizmi?`, 'Chiqish'))) return;
                go(onSignOut);
              }} />
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
      <RemindersSheet visible={remOpen} onClose={() => setRemOpen(false)} access={access} />
    </>
  );
}

function Row({ icon, title, sub, onPress, danger, open }: { icon: IconName; title: string; sub?: string; onPress: () => void; danger?: boolean; open?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 15, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: danger ? t.redLight : t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={danger ? t.red : t.teal} size={20} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: danger ? t.red : t.text }}>{title}</Text>
        {sub && <Text style={{ fontSize: 12, color: t.muted, marginTop: 2 }} numberOfLines={1}>{sub}</Text>}
      </View>
      {!danger && <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Icon name="chevron" color={t.muted} size={18} /></View>}
    </Pressable>
  );
}

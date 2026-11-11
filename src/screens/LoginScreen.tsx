import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLastLogin, signIn } from '../lib/auth';
import { Button, Field } from '../ui/components';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ui/ThemeContext';

export function LoginScreen({ lockedFor, onSuccess, onSwitchUser }: {
  /** Ilova avtomatik qulflangan bo'lsa: kimning hisobi */
  lockedFor?: { login: string; name: string } | null;
  onSuccess: () => void;
  onSwitchUser?: () => void;
}) {
  const { t } = useTheme();
  const [login, setLogin] = useState(lockedFor?.login ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (lockedFor) return;
    getLastLogin().then((l) => { if (l) { setLogin(l); setTimeout(() => codeRef.current?.focus(), 150); } });
  }, [lockedFor]);

  const submit = async () => {
    if (!login.trim() || !code.trim()) { setError('Login va kodni kiriting.'); return; }
    setBusy(true); setError('');
    const r = await signIn(login, code);
    setBusy(false);
    if (r.ok) { setCode(''); onSuccess(); } else { setError(r.error); setCode(''); }
  };

  return (
    <LinearGradient colors={[...t.loginBg]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
            showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{
              width: '100%', maxWidth: 380, backgroundColor: t.card, borderWidth: 1, borderColor: t.border,
              borderRadius: 24, paddingTop: 32, paddingHorizontal: 26, paddingBottom: 26, alignItems: 'center',
            }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="lock" size={28} color={t.teal} />
              </View>
              <Text accessibilityRole="header" style={{ marginTop: 14, marginBottom: 6, fontSize: 27, fontWeight: '800', letterSpacing: -0.7, color: t.text }}>
                Lobar Parda
              </Text>
              <Text style={{ marginBottom: 22, fontSize: 12, lineHeight: 19, color: t.muted, textAlign: 'center' }}>
                {lockedFor ? `Ilova qulflandi. ${lockedFor.name}, davom etish uchun kodingizni kiriting` : 'Davom etish uchun login va kodingizni kiriting'}
              </Text>

              <View style={{ width: '100%', gap: 12 }}>
                {!lockedFor && (
                  <Field label="Login" value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false}
                    autoComplete="username" textContentType="username" returnKeyType="next"
                    onSubmitEditing={() => codeRef.current?.focus()} />
                )}
                <Field ref={codeRef} label="Shaxsiy kod" big value={code} onChangeText={(v) => setCode(v.replace(/\s/g, ''))}
                  secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="password" textContentType="password"
                  maxLength={32} returnKeyType="go" onSubmitEditing={submit} />
              </View>

              <Button label="Kirish" onPress={submit} busy={busy} style={{ marginTop: 16, width: '100%' }} />

              <Text accessibilityLiveRegion="polite" style={{ marginTop: 12, minHeight: 16, fontSize: 12, fontWeight: '700', color: t.red, textAlign: 'center' }}>
                {error}
              </Text>

              {lockedFor && onSwitchUser && (
                <Pressable accessibilityRole="button" onPress={onSwitchUser} style={{ paddingVertical: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: t.teal }}>Boshqa xodim bilan kirish</Text>
                </Pressable>
              )}

              <View style={{ width: '100%', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.border, flexDirection: 'row', gap: 10 }}>
                <Icon name="shield" size={18} color={t.teal} />
                <Text style={{ flex: 1, fontSize: 11, lineHeight: 17, color: t.muted }}>
                  5 marta noto‘g‘ri kiritilsa, hisob 15 daqiqaga bloklanadi. Kodni unutsangiz, rahbaringiz yangisini beradi.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

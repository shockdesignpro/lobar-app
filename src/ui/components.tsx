import { useEffect, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CONTENT_MAX_WIDTH, radius, type Theme } from '../theme';
import { Icon, type IconName } from './Icon';
import { useTheme } from './ThemeContext';
import { useSync } from '../lib/offline';

// ------------------------------------------------------------------
// Ekran: yuqori panel + o'rtada aylanadigan kontent + pastki menyu.
// Kontent eng ko'pi 640 px, katta ekranda o'rtada. Eniga aylanish yo'q,
// aylantirish chiziqlari ko'rinmaydi.
// ------------------------------------------------------------------
export type Tab = 'home' | 'orders' | 'catalog' | 'reports';

/**
 * Kod maydonlari uchun: brauzer va telefon kodni eslab qolmasin, o'zi to'ldirmasin
 * (aks holda brauzerning "parollar" bo'limida saqlanib qoladi).
 */
export const NO_SAVE = {
  autoComplete: (Platform.OS === 'web' ? 'one-time-code' : 'off') as TextInputProps['autoComplete'],
  importantForAutofill: 'no' as const,
  textContentType: 'oneTimeCode' as const,
};

export function Screen({
  title, caption = 'PARDALAR UYI', onBack, children, tab, onTab, right, dock, scrollRef, onMenu,
}: {
  title: string; caption?: string; onBack?: () => void; children: ReactNode; tab?: Tab; onTab?: (t: Tab) => void; right?: ReactNode;
  /** O'ng burchakdagi burger tugmasi — "Sozlamalar" menyusini ochadi */
  onMenu?: () => void;
  /** Pastki menyu o'rniga ko'rsatiladigan panel (masalan, buyurtma kiritishda "Jami hisob") */
  dock?: ReactNode;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
}) {
  const { t } = useTheme();
  const s = styles(t);
  return (
    <SafeAreaView style={s.shell} edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.topbar}>
        {onBack && (
          <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={onBack} style={s.circleBtn}>
            <Icon name="back" color={t.teal} strokeWidth={1.9} />
          </Pressable>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.topTitle} numberOfLines={1}>{title}</Text>
          <Text style={s.brand}>{caption}</Text>
        </View>
        {right}
        {onMenu && (
          <Pressable accessibilityRole="button" accessibilityLabel="Sozlamalar menyusi" onPress={onMenu} style={s.circleBtn}>
            <Icon name="menu" color={t.teal} size={20} strokeWidth={2} />
          </Pressable>
        )}
      </View>
      <SyncBar />

      {/* Klaviatura ochilganda sahifa uning ustidan ko'tariladi — yozilayotgan maydon yopilib qolmaydi */}
      <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={s.content}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>

      {dock ?? (tab && onTab && (
        <View style={s.nav} accessibilityRole="tablist">
          {([['home', 'home', 'Asosiy'], ['orders', 'clock', 'Buyurtmalar'], ['catalog', 'scissors', 'Katalog'], ['reports', 'receipt', 'Hisobot']] as [Tab, IconName, string][]).map(([k, icon, label]) => {
            const active = tab === k;
            return (
              <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onTab(k)} style={s.navBtn}>
                <View style={[s.navIcon, active && { backgroundColor: t.tealLight }]}>
                  <Icon name={icon} color={active ? t.teal : t.muted} />
                </View>
                <Text style={[s.navLabel, { color: active ? t.teal : t.muted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </SafeAreaView>
  );
}

export function Intro({ overline, title, sub }: { overline?: string; title: string; sub?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ marginBottom: 4 }}>
      {overline && <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 1.1, color: t.muted, marginBottom: 5 }}>{overline}</Text>}
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.4, color: t.text }}>{title}</Text>
      {sub && <Text style={{ fontSize: 12, color: t.muted, marginTop: 5, lineHeight: 17 }}>{sub}</Text>}
    </View>
  );
}

export function Card({ children, style, padded = true, highlighted }: { children: ReactNode; style?: ViewStyle; padded?: boolean; highlighted?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={[{
      backgroundColor: t.card, borderRadius: radius.card, borderWidth: highlighted ? 1.5 : 1,
      borderColor: highlighted ? t.teal : t.border, overflow: 'hidden',
    }, padded && { padding: 14 }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const { t } = useTheme();
  return <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: '800', color: t.tealDark, marginTop: 10, marginBottom: 2 }}>{children}</Text>;
}

type BtnKind = 'primary' | 'soft' | 'danger';
export function Button({ label, onPress, kind = 'primary', icon, busy, disabled, style }: {
  label: string; onPress: () => void; kind?: BtnKind; icon?: IconName; busy?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  const { t } = useTheme();
  const look = {
    primary: { bg: t.primaryButton, fg: t.primaryButtonText, border: t.primaryButton, h: 49, size: 15 },
    soft: { bg: t.tealLight, fg: t.teal, border: t.teal, h: 44, size: 13 },
    danger: { bg: t.redLight, fg: t.red, border: t.red, h: 44, size: 13 },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => [{
        minHeight: look.h, borderRadius: kind === 'primary' ? radius.button : 10, borderWidth: 1, borderStyle: 'solid',
        borderColor: look.border, backgroundColor: look.bg, alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8, paddingHorizontal: 12, opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      }, style]}>
      {busy ? <ActivityIndicator color={look.fg} /> : (<>
        {icon && <Icon name={icon} color={look.fg} size={18} strokeWidth={2} />}
        <Text style={{ color: look.fg, fontWeight: '700', fontSize: look.size, textAlign: 'center' }}>{label}</Text>
      </>)}
    </Pressable>
  );
}

export type BadgeTone = 'teal' | 'blue' | 'amber' | 'purple' | 'red' | 'grey';
export function toneColors(t: Theme, tone: BadgeTone) {
  return {
    teal: [t.tealLight, t.teal], blue: [t.blueLight, t.blue], amber: [t.amberLight, t.amber],
    purple: [t.purpleLight, t.purple], red: [t.redLight, t.red], grey: [t.greyLight, t.grey],
  }[tone] as [string, string];
}

export function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  const { t } = useTheme();
  const [bg, fg] = toneColors(t, tone);
  return (
    <View style={{ backgroundColor: bg, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, flexShrink: 0 }}>
      <Text style={{ color: fg, fontSize: 10, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Field({ label, big, ...input }: TextInputProps & { label: string; big?: boolean; ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const { t } = useTheme();
  return (
    <View style={{ gap: 6, width: '100%' }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        {...input}
        style={[{
          minHeight: big ? 60 : 46, borderRadius: big ? 12 : 10, borderWidth: big ? 1.5 : 1,
          borderColor: big ? t.teal : t.border, backgroundColor: t.input, paddingHorizontal: 14,
          fontSize: big ? 25 : 16, letterSpacing: big ? 10 : 0, textAlign: big ? 'center' : 'left', color: t.text,
          width: '100%',
        }, input.style]}
      />
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange, last, disabled }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean; disabled?: boolean;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch" accessibilityState={{ checked: value, disabled }} accessibilityLabel={label}
      disabled={disabled} onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.divider }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ fontSize: 14, color: t.text }}>{label}</Text>
        {hint && <Text style={{ fontSize: 11, color: t.muted }}>{hint}</Text>}
      </View>
      <Switch
        value={value} onValueChange={onChange} disabled={disabled}
        trackColor={{ false: t.switchOff, true: t.teal }} thumbColor="#ffffff"
        {...({ activeThumbColor: '#ffffff' } as object)}
      />
    </Pressable>
  );
}

export function Segmented<K extends string>({ items, value, onChange, label }: {
  items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label: string;
}) {
  const { t } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 12 }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(it.key)}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: on ? t.tealLight : 'transparent', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: on ? '700' : '600', color: on ? t.teal : t.muted }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips<K extends string>({ items, value, onChange, label }: {
  items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label: string;
}) {
  const { t } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(it.key)}
            style={{ flexGrow: 1, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: on ? t.teal : t.border, backgroundColor: on ? t.primaryButton : t.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: on ? '700' : '600', color: on ? t.primaryButtonText : t.text }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'error' | 'ok' }) {
  const { t } = useTheme();
  const color = tone === 'error' ? t.red : tone === 'ok' ? t.teal : t.muted;
  return <Text style={{ fontSize: tone === 'muted' ? 11 : 12, lineHeight: 17, color, fontWeight: tone === 'muted' ? '400' : '700' }}>{children}</Text>;
}

export function Loading() {
  const { t } = useTheme();
  return <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator color={t.teal} /></View>;
}

const styles = (t: Theme) => StyleSheet.create({
  shell: { flex: 1, backgroundColor: t.bg },
  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: t.topbar, borderBottomWidth: 1, borderBottomColor: t.border,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: t.border, backgroundColor: t.card,
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: t.text },
  brand: { fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: t.teal },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24 },
  content: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, gap: 12 },
  nav: {
    flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8,
    backgroundColor: t.card, borderTopWidth: 1, borderTopColor: t.border, justifyContent: 'center',
  },
  navBtn: { flex: 1, maxWidth: 160, alignItems: 'center', gap: 3, paddingVertical: 4 },
  navIcon: { width: 44, height: 27, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 10, fontWeight: '600' },
});

// ------------------------------------------------------------------
// Pastdan chiqadigan oyna (eski ilovadagi modal kabi). Katta ekranda o'rtada, 640 px gacha.
// ------------------------------------------------------------------
/**
 * Alohida sahifa bo'lib ochiladigan oyna (Makroslar, Eslatmalar, yangi xarajat, mahsulot qo'shish...):
 * tepada "Orqaga" va sarlavha, ostida oddiy sahifadagidek karta.
 */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useTheme();
  const s = styles(t);
  return (
    <Modal visible={visible} animationType="none" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={s.shell} edges={['top', 'bottom', 'left', 'right']}>
          <View style={s.topbar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={onClose} style={s.circleBtn}>
              <Icon name="back" color={t.teal} strokeWidth={1.9} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text accessibilityRole="header" style={s.topTitle} numberOfLines={1}>{title}</Text>
              <Text style={s.brand}>PARDALAR UYI</Text>
            </View>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, alignItems: 'center' }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, gap: 14, padding: 16, borderRadius: 15, borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}>
                {children}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}>
      <Icon name="search" color={t.muted} size={18} />
      <TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={t.muted} value={value} onChangeText={onChange}
        style={[{ flex: 1, minWidth: 0, fontSize: 16, color: t.text, paddingVertical: 10 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} autoCorrect={false} />
    </View>
  );
}

/** Pastda qisqa xabar, ixtiyoriy "Bekor qilish" tugmasi bilan. */
export function Snack({ text, action, onAction, onHide }: { text: string; action?: string; onAction?: () => void; onHide: () => void }) {
  const { t } = useTheme();
  useEffect(() => { const id = setTimeout(onHide, 5000); return () => clearTimeout(id); }, [text, onHide]);
  return (
    <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 16, right: 16, bottom: 86, alignItems: 'center' }} pointerEvents="box-none">
      <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.text }}>
        <Text style={{ flex: 1, color: t.bg, fontSize: 14 }}>{text}</Text>
        {action && onAction && (
          <Pressable accessibilityRole="button" onPress={() => { onAction(); onHide(); }} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
            <Text style={{ color: t.tealLight, fontWeight: '800', fontSize: 13 }}>{action}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Internet yo'qligi va yuborilishi kutilayotgan o'zgarishlar haqida ingichka chiziq */
export function SyncBar() {
  const { t } = useTheme();
  const { online, pending } = useSync();
  if (online && !pending) return null;
  const [bg, fg] = toneColors(t, online ? 'teal' : 'amber');
  const text = online
    ? `${pending} ta o‘zgarish serverga yuborilmoqda…`
    : `Internet yo‘q — ishlashda davom eting, o‘zgarishlar telefonda saqlanadi${pending ? ` (${pending} ta kutmoqda)` : ''}`;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: bg, paddingHorizontal: 16, paddingVertical: 7, alignItems: 'center' }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700', textAlign: 'center', maxWidth: CONTENT_MAX_WIDTH }}>{text}</Text>
    </View>
  );
}

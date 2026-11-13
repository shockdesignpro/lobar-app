// Eslatmalar (Bildirishnomalar sahifasining tepasida, ixcham): yoqish/o'chirish va vaqt.
// Topshirishdan bir kun oldin va topshirish kuni eslatadi.
import { useEffect, useState } from 'react';
import { Platform, Pressable, Switch, Text, View } from 'react-native';
import { can, type Access } from '../lib/auth';
import { useOrders } from '../lib/orders';
import { DEFAULT_PREFS, loadReminderPrefs, saveReminderPrefs, type ReminderPrefs } from '../lib/reminderPlan';
import { exportCalendar, permissionState, requestPermission } from '../lib/reminders';
import { Icon } from '../ui/Icon';
import { Select } from '../ui/Select';
import { useSnack } from '../ui/SnackContext';
import { useTheme } from '../ui/ThemeContext';

const TIMES = Array.from({ length: 33 }, (_, i) => {
  const m = 6 * 60 + i * 30; // 06:00 … 22:00
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

export function ReminderSettings({ access }: { access: Access }) {
  const { t } = useTheme();
  const snack = useSnack();
  const web = Platform.OS === 'web';
  const { items } = useOrders(can(access, 'orders.view_all'));
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [perm, setPerm] = useState<'granted' | 'denied' | 'ask'>('ask');

  useEffect(() => {
    loadReminderPrefs().then((p) => setPrefs({ ...p }));
    permissionState().then(setPerm).catch(() => setPerm('denied'));
  }, []);

  const update = async (p: ReminderPrefs) => { setPrefs(p); await saveReminderPrefs(p); };
  const enable = async (on: boolean) => {
    if (on && perm !== 'granted') {
      const ok = await requestPermission().catch(() => false);
      setPerm(ok ? 'granted' : 'denied');
      if (!ok && !web) { snack('Ruxsat berilmadi. Telefon sozlamalari → Lobar Parda → Bildirishnomalar.'); return; }
    }
    await update({ ...prefs, enabled: on });
  };
  const on = prefs.enabled && (web || perm === 'granted');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 14, paddingRight: 10,
      borderRadius: 15, borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}>
      <Icon name="bell" color={t.teal} size={18} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: t.text }} numberOfLines={1}>Eslatma</Text>
      {on && (
        <View style={{ width: 92 }}>
          <Select compact accessibilityLabel="Eslatma vaqti" value={prefs.time} options={TIMES.map((x) => ({ key: x, label: x }))}
            onChange={(v) => { void update({ ...prefs, time: v }); }} />
        </View>
      )}
      {web && on && (
        <Pressable accessibilityRole="button" accessibilityLabel="Taqvimga eksport qilish" hitSlop={6}
          onPress={() => { exportCalendar(items ?? [], prefs.time); snack('Lobar-eslatmalar.ics yuklandi — ochib, taqvimga qo‘shing'); }}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="calendar" color={t.teal} size={17} />
        </Pressable>
      )}
      <Switch value={on} onValueChange={enable} trackColor={{ false: t.switchOff, true: t.teal }} thumbColor="#ffffff"
        {...({ activeThumbColor: '#ffffff' } as object)} accessibilityLabel="Topshirish eslatmasi" />
    </View>
  );
}

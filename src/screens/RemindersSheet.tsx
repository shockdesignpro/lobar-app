// Eslatmalar sozlamasi (eski "Bildirishnomalar" bo'limi): yoqish/o'chirish, vaqt, taqvimga eksport.
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { can, type Access } from '../lib/auth';
import { useOrders } from '../lib/orders';
import { DEFAULT_PREFS, loadReminderPrefs, saveReminderPrefs, type ReminderPrefs } from '../lib/reminderPlan';
import { exportCalendar, permissionState, requestPermission } from '../lib/reminders';
import { Button, Note, Sheet, SwitchRow } from '../ui/components';
import { Select } from '../ui/Select';
import { useSnack } from '../ui/SnackContext';
import { useTheme } from '../ui/ThemeContext';

const TIMES = Array.from({ length: 33 }, (_, i) => {
  const m = 6 * 60 + i * 30; // 06:00 … 22:00
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

export function RemindersSheet({ visible, onClose, access }: { visible: boolean; onClose: () => void; access: Access }) {
  const { t } = useTheme();
  const snack = useSnack();
  const { items } = useOrders(can(access, 'orders.view_all'));
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [perm, setPerm] = useState<'granted' | 'denied' | 'ask'>('ask');
  const web = Platform.OS === 'web';

  useEffect(() => {
    if (!visible) return;
    loadReminderPrefs().then((p) => setPrefs({ ...p }));
    permissionState().then(setPerm).catch(() => setPerm('denied'));
  }, [visible]);

  const update = async (p: ReminderPrefs) => {
    setPrefs(p);
    await saveReminderPrefs(p);
  };
  const enable = async (on: boolean) => {
    if (on && perm !== 'granted') {
      const ok = await requestPermission().catch(() => false);
      setPerm(ok ? 'granted' : 'denied');
      if (!ok && !web) { snack('Bildirishnomaga ruxsat berilmadi. Telefon sozlamalaridan yoqing.'); return; }
    }
    await update({ ...prefs, enabled: on });
    snack(on ? 'Eslatmalar yoqildi' : 'Eslatmalar o‘chirildi');
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Eslatmalar">
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 13, color: t.muted, lineHeight: 19 }}>
          Topshirishdan bir kun oldin va topshirish kuni eslatiladi. O‘rnatilgan buyurtmalar bezovta qilmaydi.
        </Text>
        <SwitchRow label="Eslatmalar" hint={web ? 'Ilova ochilganda bugungi va ertangi topshirishlar haqida xabar' : 'Telefon o‘zi eslatadi — internet bo‘lmasa ham'}
          value={prefs.enabled && (web || perm === 'granted')} onChange={enable} last />
        <Select label="Eslatma vaqti" value={prefs.time} options={TIMES.map((x) => ({ key: x, label: x }))}
          onChange={(v) => { void update({ ...prefs, time: v }); snack(`Eslatma vaqti: ${v}`); }} />
        {perm === 'denied' && (
          <Note tone="error">{web ? 'Brauzer bildirishnomasi o‘chirilgan. Taqvimga eksport qilish orqali eslatma oling.' : 'Bildirishnomaga ruxsat yo‘q. Telefon sozlamalari → Lobar Parda → Bildirishnomalar.'}</Note>
        )}
        {web && (
          <>
            <Button kind="soft" icon="calendar" label="Taqvimga eksport qilish" onPress={() => {
              exportCalendar(items ?? [], prefs.time);
              snack('Lobar-eslatmalar.ics yuklandi — ochib, taqvimga qo‘shing');
            }} />
            <Note>Brauzer yopiq paytda o‘zi eslata olmaydi. Taqvimga qo‘shilgan buyurtmalarni telefon taqvimi eslatadi. Sana o‘zgarsa, taqvimni qayta eksport qiling.</Note>
          </>
        )}
      </View>
    </Sheet>
  );
}

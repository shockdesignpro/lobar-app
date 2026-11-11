// Telefon ilovasi: eslatmalar telefonning o'zida rejalashtiriladi — internet bo'lmasa ham,
// ilova yopiq bo'lsa ham o'z vaqtida chiqadi.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { OrderListItem } from './orders';
import type { ReminderEntry } from './reminderPlan';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export const remindersKind = 'native' as const;

export async function permissionState(): Promise<'granted' | 'denied' | 'ask'> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'denied';
}
export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Topshirish eslatmalari', importance: Notifications.AndroidImportance.HIGH, sound: 'default',
    });
  }
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

/** Eski rejani o'chirib, yangisini qo'yadi (iPhone 64 tagacha ruxsat beradi — eng yaqin 60 tasi) */
export async function applyReminders(entries: ReminderEntry[]) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const e of entries.slice(0, 60)) {
    await Notifications.scheduleNotificationAsync({
      identifier: e.id,
      content: { title: e.title, body: e.body, data: { orderId: e.orderId }, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: e.at, channelId: 'reminders' },
    });
  }
}
export async function clearReminders() {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
}

// Brauzerga xos imkoniyat — telefonda kerak emas
export function exportCalendar(_orders: OrderListItem[], _time: string) { /* telefonda eslatmalar o'zi chiqadi */ }

// Telefonga bildirishnoma (push): telefon manzilini bazaga yozadi va xabar bosilganda
// kerakli sahifani ochadi. Xabarlarni baza o'zi yuboradi (0013_push.sql).
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const KEY = 'lobar.pushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export type PushTarget = { orderId?: string; screen?: 'payroll' | 'orders' };

/** Kirgandan keyin chaqiriladi. Xato bo'lsa (internet yo'q va h.k.) jim o'tadi — keyingi safar qayta urinadi. */
export async function registerPush(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Buyurtmalar', importance: Notifications.AndroidImportance.HIGH, sound: 'default',
      });
    }
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain) p = await Notifications.requestPermissionsAsync();
    if (!p.granted) return;
    const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (!error) await AsyncStorage.setItem(KEY, token);
  } catch { /* Firebase sozlanmagan eski APK yoki internet yo'q */ }
}

/** Chiqishdan oldin: bu telefonga endi oldingi xodimning xabarlari kelmasin */
export async function unregisterPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(KEY);
    if (!token) return;
    await supabase.rpc('unregister_push_token', { p_token: token });
    await AsyncStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

const targetOf = (r: Notifications.NotificationResponse | null): PushTarget | null => {
  const d = r?.notification.request.content.data as Record<string, unknown> | undefined;
  if (!d) return null;
  const t: PushTarget = {};
  if (typeof d.orderId === 'string') t.orderId = d.orderId;
  if (d.screen === 'payroll' || d.screen === 'orders') t.screen = d.screen;
  return t.orderId || t.screen ? t : null;
};

/** Bildirishnoma (yoki eslatma) bosilganda — ilova yopiq bo'lsa ham */
export function onPushOpen(cb: (t: PushTarget) => void): () => void {
  const handle = (r: Notifications.NotificationResponse | null) => {
    const t = targetOf(r);
    if (t) cb(t);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

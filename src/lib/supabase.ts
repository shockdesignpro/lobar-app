import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export type ConnectionState =
  | { kind: 'ok' }
  | { kind: 'no-schema'; message: string }
  | { kind: 'offline'; message: string };

/** Baza ulanishini va sxema o'rnatilganini tekshiradi (kirishsiz ham ishlaydi). */
export async function checkConnection(): Promise<ConnectionState> {
  try {
    const { error } = await supabase.from('roles').select('id').limit(1);
    if (!error) return { kind: 'ok' };
    // Kirmagan foydalanuvchiga ruxsat yo'q = baza ishlayapti, jadval bor va himoyalangan.
    if (error.code === '42501' || /permission denied/i.test(error.message)) return { kind: 'ok' };
    if (error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message)) {
      return { kind: 'no-schema', message: error.message };
    }
    return { kind: 'offline', message: error.message };
  } catch (e) {
    return { kind: 'offline', message: e instanceof Error ? e.message : String(e) };
  }
}

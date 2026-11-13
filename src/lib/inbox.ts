// Bildirishnomalar ro'yxati (burger menyu → Bildirishnomalar): oxirgi 60 kun
import { supabase } from './supabase';

export type InboxItem = { id: number; title: string; body: string; data: { orderId?: string; screen?: string }; created_at: string; read_at: string | null };

export async function loadInbox(): Promise<InboxItem[]> {
  const { data, error } = await supabase.from('notifications').select('id, title, body, data, created_at, read_at')
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as InboxItem[];
}

export async function unreadCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return error ? 0 : count ?? 0;
}

export const markAllRead = () => supabase.rpc('mark_notifications_read').then(() => {}, () => {});

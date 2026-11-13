// Bildirishnomalar ro'yxati (yuqoridagi qo'ng'iroqcha → Bildirishnomalar): oxirgi 60 kun
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type InboxItem = { id: number; title: string; body: string; data: { orderId?: string; screen?: string }; created_at: string; read_at: string | null };

export async function loadInbox(): Promise<InboxItem[]> {
  const { data, error } = await supabase.from('notifications').select('id, title, body, data, created_at, read_at')
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as InboxItem[];
}

// O'qilmaganlar soni — qo'ng'iroqcha ustidagi qizil belgi uchun (hamma ekranlar uchun bitta)
let unread = 0;
const listeners = new Set<(n: number) => void>();
const setUnread = (n: number) => { unread = n; listeners.forEach((f) => f(n)); };

export async function refreshUnread() {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (!error) setUnread(count ?? 0);
}

export async function markAllRead() {
  setUnread(0);
  await supabase.rpc('mark_notifications_read').then(() => {}, () => {});
}

/** Kirgan xodim uchun: sonni o'qiydi va yangi xabar kelganda darhol yangilaydi */
export function useUnread(staffId: string | null) {
  const [n, setN] = useState(unread);
  useEffect(() => {
    listeners.add(setN);
    return () => { listeners.delete(setN); };
  }, []);
  useEffect(() => {
    if (!staffId) return;
    void refreshUnread();
    const ch = supabase.channel(`my-notifications-${staffId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `staff_id=eq.${staffId}` }, () => { void refreshUnread(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [staffId]);
  return n;
}

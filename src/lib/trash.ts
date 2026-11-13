// Korzinka: o'chirilgan buyurtmalar, mahsulotlar va xizmatlar. Tiklash yoki (faqat Admin) butunlay o'chirish.
import { prefetchCatalog, restoreProduct, type Section } from './catalog';
import { reloadOrders, restoreOrder } from './orders';
import { supabase } from './supabase';

export type TrashOrder = {
  id: string; order_no: number | null; client_name: string; total: number; deleted_at: string; paid: number; photos: string[];
};
export type TrashProduct = { id: string; name: string; section: Section; price: number; unit: string; deleted_at: string };

export async function loadTrash(): Promise<{ orders: TrashOrder[]; products: TrashProduct[] }> {
  const [o, p] = await Promise.all([
    supabase.from('orders').select('id, order_no, client_name, total, deleted_at, photos, clients(name), payments(amount, cancelled_at, deleted_at)')
      .not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('products').select('id, name, section, price, unit, deleted_at')
      .not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
  ]);
  if (o.error) throw o.error;
  if (p.error) throw p.error;
  type O = { id: string; order_no: number | null; client_name: string | null; total: number | string; deleted_at: string; photos: string[] | null;
    clients: { name: string } | null; payments: { amount: number | string; cancelled_at: string | null; deleted_at: string | null }[] };
  return {
    orders: ((o.data ?? []) as unknown as O[]).map((x) => ({
      id: x.id, order_no: x.order_no, client_name: x.client_name || x.clients?.name || 'Ismsiz mijoz', total: Number(x.total), deleted_at: x.deleted_at,
      paid: x.payments.filter((y) => !y.cancelled_at && !y.deleted_at).reduce((n, y) => n + Number(y.amount), 0), photos: x.photos ?? [],
    })),
    products: ((p.data ?? []) as TrashProduct[]).map((x) => ({ ...x, price: Number(x.price) })),
  };
}

export async function restoreTrashOrder(id: string) {
  const r = await restoreOrder(id);
  void reloadOrders();
  return r;
}
export async function restoreTrashProduct(id: string) {
  const r = await restoreProduct(id);
  void prefetchCatalog();
  return r;
}

export async function purgeOrder(o: TrashOrder) {
  const { error } = await supabase.rpc('purge_order', { p_order: o.id });
  if (error) return { error };
  // Andoza rasmlari ham o'chiriladi (o'tmasa ham zarari yo'q)
  if (o.photos.length) void supabase.storage.from('order-photos').remove(o.photos).then(() => {}, () => {});
  return { error: null };
}
export async function purgeProduct(id: string) {
  const { error } = await supabase.rpc('purge_product', { p_product: id });
  return { error };
}

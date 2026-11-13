// Korzinka: o'chirilgan buyurtmalar, mahsulotlar va xizmatlar — alohida-alohida.
// Hamma (ruxsati borlar) tiklay oladi; butunlay o'chirish faqat Admin uchun.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { can, isAdmin, type Access } from '../lib/auth';
import { SECTION_SHORT } from '../lib/catalog';
import { fmtSom } from '../lib/format';
import { isNetworkError } from '../lib/offline';
import { loadTrash, purgeOrder, purgeProduct, restoreTrashOrder, restoreTrashProduct, type TrashOrder, type TrashProduct } from '../lib/trash';
import { Card, Intro, Loading, Note, Segmented } from '../ui/components';
import { confirmAsk } from '../ui/confirm';
import { Icon, type IconName } from '../ui/Icon';
import { useSnack } from '../ui/SnackContext';
import { useTheme } from '../ui/ThemeContext';
import { EmptyCard } from './home/CompactOrder';

type Kind = 'orders' | 'products' | 'services';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
const errText = (e: unknown) => (isNetworkError(e) ? 'Internet yo‘q. Korzinka internet bilan ishlaydi.' : (e as { message?: string })?.message ?? 'Xato');

export function TrashScreen({ access }: { access: Access }) {
  const { t } = useTheme();
  const snack = useSnack();
  const admin = isAdmin(access);
  const seeOrders = admin || can(access, 'archive.send');
  const seeCatalog = admin || can(access, 'catalog.edit');
  const [kind, setKind] = useState<Kind>(seeOrders ? 'orders' : 'products');
  const [data, setData] = useState<{ orders: TrashOrder[]; products: TrashProduct[] } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    loadTrash().then((d) => { setData(d); setErr(''); }).catch((e) => { setErr(errText(e)); setData((x) => x ?? { orders: [], products: [] }); });
  }, []);
  useEffect(load, [load]);

  const orders = data?.orders ?? [];
  const goods = (data?.products ?? []).filter((p) => p.section === 'mahsulot');
  const services = (data?.products ?? []).filter((p) => p.section !== 'mahsulot');
  const tabs: { key: Kind; label: string }[] = [
    ...(seeOrders ? [{ key: 'orders' as Kind, label: `Buyurtmalar${data ? ` (${orders.length})` : ''}` }] : []),
    ...(seeCatalog ? [
      { key: 'products' as Kind, label: `Mahsulotlar${data ? ` (${goods.length})` : ''}` },
      { key: 'services' as Kind, label: `Xizmatlar${data ? ` (${services.length})` : ''}` },
    ] : []),
  ];

  const run = async (id: string, fn: () => Promise<{ error: { message?: string } | null }>, ok: string) => {
    setBusy(id);
    const { error } = await fn();
    setBusy(null);
    if (error) { snack(errText(error)); return; }
    snack(ok); load();
  };

  const orderLabel = (o: TrashOrder) => `${o.order_no ? `№${String(o.order_no).padStart(4, '0')} · ` : ''}${o.client_name}`;

  return (
    <>
      <Intro overline="O‘CHIRILGANLAR" title="Korzinka"
        sub={admin ? 'Tiklash — joyiga qaytaradi. Butunlay o‘chirilgani qaytmaydi.' : 'Tiklash — joyiga qaytaradi. Butunlay o‘chirishni faqat Admin qila oladi.'} />
      {tabs.length > 1 && <Segmented label="Bo‘lim" value={kind} onChange={setKind} items={tabs} />}
      {err ? <Note tone="error">{err}</Note> : null}
      {!data ? <Loading /> : kind === 'orders' ? (
        orders.length ? (
          <Card padded={false}>
            {orders.map((o, i) => (
              <Row key={o.id} first={!i} busy={busy === o.id}
                title={orderLabel(o)}
                sub={`O‘chirilgan: ${fmtDate(o.deleted_at)} · ${fmtSom(o.total)}${o.paid ? ` · to‘langan ${fmtSom(o.paid)}` : ''}`}
                onRestore={() => run(o.id, () => restoreTrashOrder(o.id), 'Buyurtma tiklandi')}
                onPurge={admin ? async () => {
                  if (o.paid) { snack('To‘lovi bor buyurtmani butunlay o‘chirib bo‘lmaydi — u hisobotlarda turadi.'); return; }
                  if (!(await confirmAsk(`${orderLabel(o)} butunlay o‘chirilsinmi? Buyurtma, andoza rasmlari va ishchilar hisobidagi shu buyurtma uchun haq ham o‘chadi. Qaytarib bo‘lmaydi.`, 'Butunlay o‘chirish'))) return;
                  run(o.id, () => purgeOrder(o), 'Butunlay o‘chirildi');
                } : undefined}
                purgeLocked={admin && o.paid > 0} />
            ))}
          </Card>
        ) : <EmptyCard title="Korzinka bo‘sh" text="O‘chirilgan buyurtmalar shu yerda turadi." />
      ) : (() => {
        const list = kind === 'products' ? goods : services;
        return list.length ? (
          <Card padded={false}>
            {list.map((p, i) => (
              <Row key={p.id} first={!i} busy={busy === p.id}
                title={p.name}
                sub={`${kind === 'services' ? `${SECTION_SHORT[p.section]} · ` : ''}${fmtSom(p.price)} / ${p.unit} · o‘chirilgan: ${fmtDate(p.deleted_at)}`}
                onRestore={() => run(p.id, () => restoreTrashProduct(p.id), `“${p.name}” katalogga qaytdi`)}
                onPurge={admin ? async () => {
                  if (!(await confirmAsk(`“${p.name}” butunlay o‘chirilsinmi? Eski buyurtmalarda nomi va narxi saqlanib qoladi. Qaytarib bo‘lmaydi.`, 'Butunlay o‘chirish'))) return;
                  run(p.id, () => purgeProduct(p.id), 'Butunlay o‘chirildi');
                } : undefined} />
            ))}
          </Card>
        ) : <EmptyCard title="Korzinka bo‘sh" text={kind === 'products' ? 'O‘chirilgan mahsulotlar shu yerda turadi.' : 'O‘chirilgan tikish va o‘rnatish xizmatlari shu yerda turadi.'} />;
      })()}
      <View style={{ height: 4 }} />
      <Text style={{ fontSize: 12, color: t.muted, lineHeight: 17 }}>
        To‘lovi bor buyurtma korzinkada qoladi: u hisobot va sof foydada hisobga olingan.
      </Text>
    </>
  );
}

function Row({ title, sub, onRestore, onPurge, first, busy, purgeLocked }: {
  title: string; sub: string; onRestore: () => void; onPurge?: () => void; first: boolean; busy: boolean; purgeLocked?: boolean;
}) {
  const { t } = useTheme();
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderTopWidth: first ? 0 : 1, borderTopColor: t.divider, opacity: busy ? 0.5 : 1 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: t.text }} numberOfLines={2}>{title}</Text>
        <Text style={{ fontSize: 12, color: t.muted }}>{sub}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Small icon="undo" label="Tiklash" onPress={onRestore} disabled={busy} />
        {onPurge && !purgeLocked && <Small icon="trash" label="Butunlay o‘chirish" danger onPress={onPurge} disabled={busy} />}
      </View>
    </View>
  );
}

function Small({ icon, label, onPress, danger, disabled }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 12, borderRadius: 10,
        backgroundColor: danger ? t.redLight : t.tealLight, opacity: pressed ? 0.8 : 1 })}>
      <Icon name={icon} color={danger ? t.red : t.teal} size={16} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: danger ? t.red : t.teal }}>{label}</Text>
    </Pressable>
  );
}

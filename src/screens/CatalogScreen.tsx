import { useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { can, type Access } from '../lib/auth';
import {
  archiveProduct, catalogCSV, importCatalog, parseCatalogCSV, restoreProduct, saveProduct,
  SECTION_INITIAL, SECTION_SHORT, SECTION_TITLES, UNITS, useProducts, type Product, type Section,
} from '../lib/catalog';
import { calcNumber, fmtN } from '../lib/format';
import { Button, Card, Field, Intro, Loading, Note, SearchBox, Sheet } from '../ui/components';
import { Select } from '../ui/Select';
import { Icon, type IconName } from '../ui/Icon';
import { useSnack } from '../ui/SnackContext';
import { useTheme } from '../ui/ThemeContext';

type Filter = 'all' | Section;
const SECTIONS: Section[] = ['mahsulot', 'tikish', 'ustanovka'];

export function CatalogScreen({ access }: { access: Access }) {
  const { t } = useTheme();
  const snack = useSnack();
  const { items, error } = useProducts();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const canEdit = can(access, 'catalog.edit');

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = (items ?? []).filter((p) => (filter === 'all' || p.section === filter) && (!query || p.name.toLowerCase().includes(query)));
    return SECTIONS.map((s) => ({ section: s, items: list.filter((p) => p.section === s) })).filter((g) => g.items.length);
  }, [items, q, filter]);

  if (!can(access, 'prices.view')) {
    return (<><Intro overline="MAHSULOT VA XIZMATLAR" title="Katalog" /><Card><Text style={{ color: t.text }}>Katalog va narxlarni ko‘rishga ruxsatingiz yo‘q.</Text></Card></>);
  }

  const remove = async (p: Product) => {
    const { error: e } = await archiveProduct(p.id);
    if (e) { snack(e.message); return; }
    snack(`“${p.name}” o‘chirildi`, { label: 'BEKOR QILISH', run: async () => { await restoreProduct(p.id); snack('Tiklandi'); } });
  };

  const doExport = () => {
    if (Platform.OS !== 'web' || !items) return;
    const url = URL.createObjectURL(new Blob([catalogCSV(items)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'Lobar-katalog.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const doImport = () => {
    if (Platform.OS !== 'web' || !items) return;
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv,text/csv';
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      try {
        if (f.size > 5 * 1024 * 1024) throw new Error('CSV fayli 5 MB dan kichik bo‘lsin');
        const rows = parseCatalogCSV(await f.text());
        if (!rows.length) throw new Error('CSV bo‘sh');
        if (!window.confirm(`${rows.length} ta katalog qatorini import qilamizmi? Mavjudlari yangilanadi.`)) return;
        const r = await importCatalog(rows, items);
        snack(`Import qilindi: ${r.updated} ta yangilandi, ${r.added} ta qo‘shildi`);
      } catch (e) { snack(e instanceof Error ? e.message : 'Import bajarilmadi'); }
    };
    input.click();
  };

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <View style={{ flex: 1 }}><Intro overline="MAHSULOT VA XIZMATLAR" title="Katalog" sub="Narxlar va o‘lchov birliklarini boshqaring." /></View>
        {canEdit && Platform.OS === 'web' && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
            <RoundBtn icon="download" label="Katalog import" onPress={doImport} />
            <RoundBtn icon="upload" label="Katalog eksport" onPress={doExport} />
          </View>
        )}
      </View>

      {canEdit && <Button icon="plus" label="Mahsulot yoki xizmat qo‘shish" onPress={() => setEditing('new')} />}
      <SearchBox value={q} onChange={setQ} placeholder="Mahsulot yoki xizmatni qidirish" />

      <View accessibilityRole="radiogroup" accessibilityLabel="Bo‘lim" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {([['all', 'Barchasi'], ...SECTIONS.map((s) => [s, SECTION_SHORT[s]])] as [Filter, string][]).map(([k, label]) => {
          const on = filter === k;
          return (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setFilter(k)}
              style={{ flexGrow: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: on ? t.teal : t.border, backgroundColor: on ? t.tealLight : t.card, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: on ? '700' : '500', color: on ? t.teal : t.text }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!!error && <Note tone="error">{error}</Note>}
      {!items ? <Loading /> : groups.length === 0 ? (
        <Card><Text style={{ fontSize: 14, color: t.muted, textAlign: 'center', paddingVertical: 12 }}>
          {q.trim() ? `“${q.trim()}” bo‘yicha hech narsa topilmadi.` : 'Mahsulotlar yo‘q.'}
        </Text></Card>
      ) : groups.map((g) => (
        <View key={g.section} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
            <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '800', color: t.text }}>{SECTION_TITLES[g.section]}</Text>
            <Text style={{ fontSize: 12, color: t.muted }}>{g.items.length} ta</Text>
          </View>
          <Card padded={false}>
            {g.items.map((p, i) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.divider }}>
                <View style={{ width: 36, height: 40, borderRadius: 10, backgroundColor: t.tealLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: t.teal, fontWeight: '800', fontSize: 12 }}>{SECTION_INITIAL[p.section]}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: t.text }}>{p.name}</Text>
                  <Text style={{ fontSize: 12, color: t.muted, marginTop: 3 }}>
                    <Text style={{ fontWeight: '700', color: t.text }}>{fmtN(p.price)} so‘m</Text> / {p.unit}
                  </Text>
                  {p.section !== 'mahsulot' && (
                    <Text style={{ fontSize: 12, color: p.worker_rate ? t.muted : t.amber, marginTop: 2 }}>
                      {p.worker_rate ? `Ishchiga: ${fmtN(p.worker_rate)} so‘m / ${p.unit}` : 'Ishchi stavkasi kiritilmagan'}
                    </Text>
                  )}
                </View>
                {canEdit && <SquareBtn icon="edit" label={`${p.name}: tahrirlash`} onPress={() => setEditing(p)} />}
                {canEdit && <SquareBtn icon="trash" label={`${p.name}: o‘chirish`} danger onPress={() => remove(p)} />}
              </View>
            ))}
          </Card>
        </View>
      ))}

      {canEdit && (
        <ProductSheet product={editing} onClose={() => setEditing(null)} onSaved={(m) => { setEditing(null); snack(m); }} />
      )}
    </>
  );
}

function RoundBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} color={t.blue} size={19} />
    </Pressable>
  );
}

function SquareBtn({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed || hovered ? (danger ? t.redLight : t.tealLight) : t.bg,
      })}>
      <Icon name={icon} color={t.muted} size={16} />
    </Pressable>
  );
}

function ProductSheet({ product, onClose, onSaved }: { product: Product | 'new' | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const { t } = useTheme();
  const isNew = product === 'new';
  const p = product && product !== 'new' ? product : null;
  const [section, setSection] = useState<Section>('mahsulot');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('m');
  const [rate, setRate] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<Product | 'new' | null>(null);

  // Oyna har ochilganda maydonlarni to'ldiramiz
  if (product !== openedFor) {
    setOpenedFor(product);
    setSection(p?.section ?? 'mahsulot'); setName(p?.name ?? ''); setPrice(p ? fmtN(p.price) : ''); setUnit(p?.unit ?? 'm'); setRate(p?.worker_rate ? fmtN(p.worker_rate) : ''); setErr('');
  }

  const save = async () => {
    const n = calcNumber(price);
    if (!name.trim()) { setErr('Nom kiriting!'); return; }
    if (n === null) { setErr('Narxni to‘g‘ri kiriting. Masalan: 60 000'); return; }
    const r = section === 'mahsulot' || !rate.trim() ? 0 : calcNumber(rate);
    if (r === null) { setErr('Ishchi stavkasini to‘g‘ri kiriting. Masalan: 15 000'); return; }
    setBusy(true);
    const { error } = await saveProduct({ id: p?.id, name: name.trim(), section, price: n, unit, worker_rate: r });
    setBusy(false);
    if (error) setErr(error.message); else onSaved(isNew ? 'Qo‘shildi' : 'Yangilandi');
  };

  const unitOptions = UNITS.some((u) => u.key === unit) ? UNITS : [...UNITS, { key: unit, label: unit }];

  return (
    <Sheet visible={!!product} onClose={onClose} title={isNew ? 'Yangi mahsulot qo‘shish' : 'Mahsulotni tahrirlash'}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: t.muted }}>Bo‘lim tanlang</Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SECTIONS.map((s) => {
            const on = s === section;
            return (
              <Pressable key={s} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setSection(s)}
                style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: on ? t.teal : t.border, backgroundColor: on ? t.tealLight : t.input, justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: on ? '700' : '500', color: on ? t.teal : t.text }}>{SECTION_SHORT[s]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Field label="Mahsulot nomi" placeholder="Masalan: Karniz 3m" value={name} onChangeText={setName} />
      <Field label="Narxi (so‘m)" placeholder="Masalan: 60 000" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <Select label="O‘lchov birligi" value={unit} options={unitOptions} onChange={setUnit} />
      {section !== 'mahsulot' && (
        <>
          <Field label={`Ishchi stavkasi (1 ${unit} uchun, so‘m)`} placeholder="Masalan: 15 000" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
          <Text style={{ fontSize: 12, color: t.muted, lineHeight: 17, marginTop: -4 }}>
            {section === 'tikish' ? 'Tikuvchiga “Dazmolandi” belgilanganda' : 'Ustaga “Pardani o‘rnatish” belgilanganda'} miqdor × stavka hisoblanadi. Bir necha kishi bo‘lsa, teng bo‘linadi.
          </Text>
        </>
      )}
      {!!err && <Note tone="error">{err}</Note>}
      <Button label="Saqlash" onPress={save} busy={busy} />
      <Pressable accessibilityRole="button" onPress={onClose} style={{ alignItems: 'center', paddingVertical: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: t.muted }}>Bekor qilish</Text>
      </Pressable>
      {!isNew && <Note>Narx o‘zgarishi faqat yangi buyurtmalarga ta’sir qiladi; eski buyurtmalar summasi o‘zgarmaydi.</Note>}
    </Sheet>
  );
}

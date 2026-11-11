// ============================================================
// Buyurtma qoralamasi va hisob-kitob mantiqi.
// Eski ilovadagi xona.js, kalkulyator.js, room-costs.js, makros.js va
// mobile.js (tekshiruvlar) dan aynan ko'chirilgan. React'ga bog'liq emas,
// shuning uchun alohida test qilinadi (tests/order-model.test.ts).
// ============================================================

export type Section = 'mahsulot' | 'tikish' | 'ustanovka';
export const SECTIONS: Section[] = ['mahsulot', 'tikish', 'ustanovka'];

export const ROOM_NAMES = ['Mehmonxona', 'Kuxnya', 'Spalniy', 'Detskiy', 'Balkon'];
export const RAIL_TYPES = ['Truba', 'Baget', 'Qosh'];
export const COLORS = ['Oq', 'Qora', 'Kulrang', 'Kumush', 'Qizil', 'Pushti', 'Sariq', 'Tilla', 'Jigarrang', 'Bej', 'Krem', 'Ko‘k', 'Zangori', 'Yashil', 'Binafsha', 'Shokolad'];

export type CatalogItem = { id: string; name: string; section: Section; price: number; unit: string };

export type Opening = {
  id: string;
  kind: 'deraza' | 'eshik';
  height: string; // bo'yi (kiritilgan matn, masalan "2,6")
  width: string;  // eni
  rail: string;   // karniz turi
  color: string;  // rangi
  /** "Eni"dan yaratilgan qator qo'lda o'chirilgan bo'lsa, qayta yaratilmaydi */
  autoOff?: Partial<Record<Section, boolean>>;
};
export type Room = { id: string; name: string; openings: Opening[] };

export type Row = {
  id: string;
  section: Section;
  productId: string | null;
  productName: string;
  unit: string;
  price: number;
  qty: number | null;       // bo'sh bo'lishi mumkin
  roomId: string | null;    // null = umumiy (xonaga biriktirilmagan)
  openingId: string | null; // qaysi deraza/eshik uchun (costPardaId)
  linkOpening: string | null; // "eni"dan avtomatik yaratilgan bo'lsa, o'sha deraza
  autoSync: boolean;        // eni o'zgarsa miqdor ham o'zgaradimi
};

export type Client = { name: string; address: string; phone: string; readyDate: string };

export type Draft = {
  orderId: string | null; // tahrirlanayotgan buyurtma (null = yangi)
  client: Client;
  rooms: Room[];
  rows: Row[];
  /** Andoza rasmlari: path — serverdagi manzil (yuklangan bo'lsa), uri — telefondagi rasm (data:) */
  photos?: Photo[];
  step: 1 | 2 | 3;
  updatedAt: number;
};
export type Photo = { path: string | null; uri: string; caption: string };

export type NewId = () => string;

export const PHONE_PREFIX = '+998';

export function emptyDraft(): Draft {
  return { orderId: null, client: { name: '', address: '', phone: PHONE_PREFIX, readyDate: '' }, rooms: [], rows: [], photos: [], step: 1, updatedAt: Date.now() };
}

export function isDraftEmpty(d: Draft) {
  return !d.client.name.trim() && !d.client.phone.replace(PHONE_PREFIX, '').trim() && !d.rooms.length && !d.rows.length && !(d.photos ?? []).length;
}

// ---- Sonlar (utils.js: parseMq, kalkulyator.js: calcNumber) ----
export function parseMq(v: string | number | null | undefined): number {
  return parseFloat(String(v ?? '').trim().replace(',', '.')) || 0;
}
export function calcNumber(val: string): number | null {
  const text = String(val).replace(/\s/g, '').replace(',', '.');
  if (text === '') return 0;
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
}
export const mqText = (v: number | null) => (v == null ? '' : String(v));

const byName = (a: { name: string }, b: { name: string }) =>
  String(a.name || '').localeCompare(String(b.name || ''), 'uz', { sensitivity: 'base', numeric: true });

/** Bo'limdagi mahsulotlar alifbo tartibida (eski: products.filter(bolim).sort(productAlphabetical)) */
export const sectionProducts = (catalog: CatalogItem[], s: Section) => catalog.filter((p) => p.section === s).sort(byName);

// ---- Telefon (+998 o'zgarmas boshlanish) ----
export function normalizePhone(v: string): string {
  let s = v;
  if (s.indexOf(PHONE_PREFIX) !== 0) {
    let digits = s.replace(/\D/g, '');
    if (digits.indexOf('998') === 0) digits = digits.slice(3);
    s = PHONE_PREFIX + digits;
  }
  let rest = s.slice(PHONE_PREFIX.length).replace(/\D/g, '');
  if (rest.length > 9) rest = rest.slice(0, 9);
  return PHONE_PREFIX + rest;
}
export const phoneComplete = (v: string) => /^998[0-9]{9}$/.test(String(v || '').replace(/\D/g, ''));

// ---- Deraza / eshik yorlig'i: har tur o'zicha sanaladi (Deraza 1, Eshik 1, Deraza 2) ----
export function openingLabel(openings: Opening[], idx: number): string {
  const kind = openings[idx]?.kind || 'deraza';
  let count = 0;
  for (let i = 0; i <= idx; i++) if ((openings[i]?.kind || 'deraza') === kind) count++;
  return `${kind === 'eshik' ? 'Eshik' : 'Deraza'} ${count}`;
}

// ---- Xonalar ----
export function addRoom(d: Draft, newId: NewId): Draft {
  const room: Room = { id: newId(), name: ROOM_NAMES[0], openings: [{ id: newId(), kind: 'deraza', height: '', width: '', rail: RAIL_TYPES[0], color: COLORS[0] }] };
  return { ...d, rooms: [...d.rooms, room] };
}

export function updateRoomName(d: Draft, roomId: string, name: string): Draft {
  return { ...d, rooms: d.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)) };
}

/** Xona o'chsa, uning hamma qatorlari ham o'chadi */
export function removeRoom(d: Draft, roomId: string): Draft {
  const room = d.rooms.find((r) => r.id === roomId);
  const ids = new Set((room?.openings ?? []).map((o) => o.id));
  return {
    ...d,
    rooms: d.rooms.filter((r) => r.id !== roomId),
    rows: d.rows.filter((row) => row.roomId !== roomId && !(row.linkOpening && ids.has(row.linkOpening)) && !(row.openingId && ids.has(row.openingId))),
  };
}

export function addOpening(d: Draft, roomId: string, kind: 'deraza' | 'eshik', newId: NewId): Draft {
  return {
    ...d,
    rooms: d.rooms.map((r) => (r.id === roomId
      ? { ...r, openings: [...r.openings, { id: newId(), kind, height: '', width: '', rail: RAIL_TYPES[0], color: COLORS[0] }] }
      : r)),
  };
}

export function removeOpening(d: Draft, roomId: string, openingId: string): Draft {
  return {
    ...d,
    rooms: d.rooms.map((r) => (r.id === roomId ? { ...r, openings: r.openings.filter((o) => o.id !== openingId) } : r)),
    rows: d.rows.filter((row) => row.linkOpening !== openingId && row.openingId !== openingId),
  };
}

/** Deraza maydoni o'zgardi. "Eni" o'zgarsa tikish va o'rnatish qatorlari avtomatik yangilanadi/yaratiladi. */
export function updateOpening(d: Draft, roomId: string, openingId: string, field: 'height' | 'width' | 'rail' | 'color', value: string, catalog: CatalogItem[], newId: NewId): Draft {
  let next: Draft = {
    ...d,
    rooms: d.rooms.map((r) => (r.id === roomId ? { ...r, openings: r.openings.map((o) => (o.id === openingId ? { ...o, [field]: value } : o)) } : r)),
  };
  if (field === 'width') next = syncWidthToServices(next, roomId, openingId, value, catalog, newId);
  return next;
}

function syncWidthToServices(d: Draft, roomId: string, openingId: string, widthVal: string, catalog: CatalogItem[], newId: NewId): Draft {
  const q = parseMq(widthVal);
  const opening = d.rooms.find((r) => r.id === roomId)?.openings.find((o) => o.id === openingId);
  let rows = d.rows;
  for (const section of ['tikish', 'ustanovka'] as Section[]) {
    const existing = rows.find((r) => r.section === section && r.linkOpening === openingId);
    if (existing) {
      if (existing.autoSync !== false) rows = rows.map((r) => (r.id === existing.id ? { ...r, qty: q } : r));
    } else if (!opening?.autoOff?.[section]) {
      const first = sectionProducts(catalog, section)[0];
      if (first) {
        rows = [...rows, {
          id: newId(), section, productId: first.id, productName: first.name, unit: first.unit, price: first.price,
          qty: q, roomId, openingId: null, linkOpening: openingId, autoSync: true,
        }];
      }
    }
  }
  return { ...d, rows };
}

// ---- Xarajat qatorlari ----
export type CostTarget = { roomId: string | null; openingId: string | null };

/** Xarajatlar ekranida tanlangan xona va deraza (room-costs.js: currentCostRoom / currentCostParda) */
export function resolveTarget(d: Draft, roomId: string | null | undefined, openingId: string | null | undefined): CostTarget {
  let rid: string | null = roomId === undefined ? (d.rooms[0]?.id ?? null) : roomId;
  if (rid !== null && !d.rooms.some((r) => r.id === rid)) rid = d.rooms[0]?.id ?? null;
  const room = d.rooms.find((r) => r.id === rid);
  let oid: string | null = null;
  if (room) {
    if (room.openings.length < 2) oid = room.openings[0]?.id ?? null;
    else {
      oid = openingId === undefined ? room.openings[0].id : openingId;
      if (oid !== null && !room.openings.some((o) => o.id === oid)) oid = room.openings[0].id;
    }
  }
  return { roomId: rid, openingId: oid };
}

/** Qator shu xonaga tegishlimi */
export const isRoomRow = (row: Row, roomId: string | null) => (row.roomId ?? null) === (roomId ?? null);

/** Qator hozir ko'rinayotgan xona/derazaga tegishlimi (isCurrentCostRow) */
export function isCurrentRow(d: Draft, row: Row, target: CostTarget): boolean {
  if (!isRoomRow(row, target.roomId)) return false;
  const room = d.rooms.find((r) => r.id === target.roomId);
  if (!room || room.openings.length < 2) return true;
  return (row.openingId || row.linkOpening || '') === (target.openingId || '');
}

/** Xonada derazaga biriktirilmagan qatorlar bormi ("Umumiy" yorlig'i uchun) */
export const roomHasGeneralRows = (d: Draft, roomId: string | null) =>
  d.rows.some((r) => isRoomRow(r, roomId) && !r.openingId && !r.linkOpening);

export function addRow(d: Draft, section: Section, catalog: CatalogItem[], target: CostTarget, newId: NewId, productId?: string): Draft | null {
  const prods = sectionProducts(catalog, section);
  if (!prods.length) return null;
  const initial = (productId && prods.find((p) => p.id === productId))
    || (section === 'mahsulot' ? prods.find((p) => p.name.trim().toLocaleLowerCase() === 'material') : undefined)
    || prods[0];
  const row: Row = {
    id: newId(), section, productId: initial.id, productName: initial.name, unit: initial.unit, price: initial.price,
    qty: null, roomId: target.roomId, openingId: target.openingId, linkOpening: null, autoSync: false,
  };
  return { ...d, rows: [...d.rows, row] };
}

/** Qator o'chirildi. "Eni"dan yaratilgan bo'lsa, qayta avtomatik yaratilmasin. */
export function removeRow(d: Draft, rowId: string): Draft {
  const removed = d.rows.find((r) => r.id === rowId);
  let rooms = d.rooms;
  if (removed?.linkOpening) {
    rooms = rooms.map((room) => ({
      ...room,
      openings: room.openings.map((o) => (o.id === removed.linkOpening ? { ...o, autoOff: { ...(o.autoOff ?? {}), [removed.section]: true } } : o)),
    }));
  }
  return { ...d, rooms, rows: d.rows.filter((r) => r.id !== rowId) };
}

export function setRowProduct(d: Draft, rowId: string, p: CatalogItem): Draft {
  return { ...d, rows: d.rows.map((r) => (r.id === rowId ? { ...r, productId: p.id, productName: p.name, unit: p.unit, price: p.price } : r)) };
}
export function setRowPrice(d: Draft, rowId: string, price: number): Draft {
  return { ...d, rows: d.rows.map((r) => (r.id === rowId ? { ...r, price } : r)) };
}
/** Miqdor qo'lda o'zgartirilsa, "eni" bilan sinxronlash to'xtaydi */
export function setRowQty(d: Draft, rowId: string, qty: number | null): Draft {
  return { ...d, rows: d.rows.map((r) => (r.id === rowId ? { ...r, qty, autoSync: r.linkOpening ? false : r.autoSync } : r)) };
}

/** Makros: mahsulotlarni miqdori bo'sh holda tanlangan xona/derazaga qo'shadi */
export function applyMacro(d: Draft, products: CatalogItem[], target: CostTarget, newId: NewId): Draft {
  const rows: Row[] = products.map((p) => ({
    id: newId(), section: 'mahsulot', productId: p.id, productName: p.name, unit: p.unit, price: p.price,
    qty: null, roomId: target.roomId, openingId: target.openingId, linkOpening: null, autoSync: false,
  }));
  return { ...d, rows: [...d.rows, ...rows] };
}

// ---- Summalar ----
export const rowSum = (r: Row) => (r.qty ?? 0) * r.price;
export const sectionSum = (d: Draft, s: Section) => d.rows.filter((r) => r.section === s).reduce((n, r) => n + rowSum(r), 0);
export function totals(d: Draft) {
  const m = sectionSum(d, 'mahsulot'), t = sectionSum(d, 'tikish'), u = sectionSum(d, 'ustanovka');
  return { mahsulot: m, tikish: t, ustanovka: u, xizmat: t + u, grand: m + t + u };
}
export const roomTotal = (d: Draft, roomId: string | null) => d.rows.filter((r) => isRoomRow(r, roomId)).reduce((n, r) => n + rowSum(r), 0);
export const currentSectionSum = (d: Draft, s: Section, target: CostTarget) =>
  d.rows.filter((r) => r.section === s && isCurrentRow(d, r, target)).reduce((n, r) => n + rowSum(r), 0);

/** Xona o'lchamlari qisqacha: "Deraza 1: 2.6 × 3.2 m · Truba · Oq | ..." */
export const roomDimensions = (room: Room) =>
  room.openings.map((o, i) => `${openingLabel(room.openings, i)}: ${o.height} × ${o.width} m · ${o.rail} · ${o.color}`).join(' | ');

/** Hisob sahifasi va chek uchun xonalar bo'yicha guruhlar (costGroups) */
export type CostGroup = { room: Room | null; name: string; rows: Record<Section, Row[]>; sums: Record<Section, number>; xizmat: number; grand: number };
export function costGroups(d: Draft): CostGroup[] {
  const list: CostGroup[] = d.rooms.map((room) => ({ room, name: room.name, rows: { mahsulot: [], tikish: [], ustanovka: [] }, sums: { mahsulot: 0, tikish: 0, ustanovka: 0 }, xizmat: 0, grand: 0 }));
  const other: CostGroup = { room: null, name: 'Umumiy xarajatlar', rows: { mahsulot: [], tikish: [], ustanovka: [] }, sums: { mahsulot: 0, tikish: 0, ustanovka: 0 }, xizmat: 0, grand: 0 };
  for (const s of SECTIONS) {
    for (const row of d.rows.filter((r) => r.section === s)) {
      const g = row.roomId == null ? null : list.find((x) => x.room?.id === row.roomId);
      (g ?? other).rows[s].push(row);
    }
  }
  if (SECTIONS.some((s) => other.rows[s].length)) list.push(other);
  return list.map((g) => {
    for (const s of SECTIONS) {
      g.rows[s].sort((a, b) => byName({ name: a.productName }, { name: b.productName }));
      g.sums[s] = g.rows[s].reduce((n, r) => n + rowSum(r), 0);
    }
    g.xizmat = g.sums.tikish + g.sums.ustanovka;
    g.grand = g.sums.mahsulot + g.xizmat;
    return g;
  });
}

// ---- Tekshiruvlar (mobile.js: validateCustomerStep / validateServicesStep) ----
export type Problem = { field: string; message: string };

export function validateCustomer(d: Draft): Problem | null {
  if (!d.client.name.trim()) return { field: 'name', message: 'Mijoz ismini kiriting' };
  if (!d.client.address.trim()) return { field: 'address', message: 'Mijoz manzilini kiriting' };
  if (!phoneComplete(d.client.phone)) return { field: 'phone', message: 'Telefon raqamini to‘liq kiriting: +998 va 9 ta raqam' };
  for (const r of d.rooms) for (const o of r.openings) for (const key of ['height', 'width'] as const) {
    if (!(parseMq(o[key]) > 0)) return { field: `opening:${o.id}:${key}`, message: 'Qo‘shilgan xonadagi bo‘yi va enini to‘liq kiriting' };
  }
  return null;
}

export function validateServices(d: Draft, catalog: CatalogItem[]): Problem | null {
  if (!d.rows.length) return { field: 'rows', message: 'Kamida bitta mahsulot yoki xizmat qo‘shing' };
  for (const row of d.rows) {
    const known = !!row.productId && catalog.some((p) => p.id === row.productId);
    if (known && (row.qty == null || !(Number(row.qty) > 0))) return { field: `row:${row.id}`, message: `“${row.productName}” uchun miqdorni kiriting` };
    if (!known || !Number.isFinite(row.price) || row.price < 0) return { field: `row:${row.id}`, message: 'Har bir qatorda mahsulot, to‘g‘ri narx va musbat miqdor bo‘lishi kerak' };
  }
  if (totals(d).grand <= 0) return { field: 'rows', message: 'Hisob jami 0 so‘m. Narx va miqdorlarni tekshiring' };
  return null;
}

// ---- Tayyor bo'lish sanasi ----
export function isoDatePlus(days: number, from = new Date()): string {
  const d = new Date(from); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

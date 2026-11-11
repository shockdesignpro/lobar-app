// Ishga tushirish: node --experimental-strip-types tests/order-model.test.ts
// Eski ilova (curtain-app) bilan bir xil ssenariyni bajaradi va natijalarni solishtiradi.
import * as M from '../src/lib/order/model.ts';
import { readFileSync } from 'node:fs';

const csv = readFileSync(new URL('./fixtures/Lobar-katalog.csv', import.meta.url), 'utf8').replace(/^﻿/, '');
const catalog: M.CatalogItem[] = csv.trim().split(/\r?\n/).slice(1).map((l) => {
  const c = l.split(';').map((x) => x.replace(/^"|"$/g, ''));
  return { id: 'p' + c[0], name: c[1], section: c[2] as M.Section, price: Number(c[3]), unit: c[4] };
});

let n = 0; const id = () => 'id' + (++n);
let d = M.emptyDraft();
d = M.addRoom(d, id);
const r1 = d.rooms[0];
d = M.updateOpening(d, r1.id, r1.openings[0].id, 'height', '2.6', catalog, id);
d = M.updateOpening(d, r1.id, r1.openings[0].id, 'width', '3,2', catalog, id);
d = M.addOpening(d, r1.id, 'eshik', id);
const o2 = d.rooms[0].openings[1];
d = M.updateOpening(d, r1.id, o2.id, 'height', '2.4', catalog, id);
d = M.updateOpening(d, r1.id, o2.id, 'width', '1.5', catalog, id);
// 1-derazaga Material x7
let t = M.resolveTarget(d, r1.id, r1.openings[0].id);
d = M.addRow(d, 'mahsulot', catalog, t, id)!;
d = M.setRowQty(d, d.rows[d.rows.length - 1].id, 7);
// 2-eshik: tikish qatorini qo'lda 2 ga o'zgartiramiz, keyin eni 1.8 -> tikish 2 qoladi, o'rnatish 1.8
const tik2 = d.rows.find((r) => r.section === 'tikish' && r.linkOpening === o2.id)!;
d = M.setRowQty(d, tik2.id, 2);
d = M.updateOpening(d, r1.id, o2.id, 'width', '1.8', catalog, id);
// 1-deraza o'rnatish qatorini o'chiramiz, eni 3.5 ga o'zgaradi -> o'rnatish qayta yaratilmaydi, tikish 3.5
const ust1 = d.rows.find((r) => r.section === 'ustanovka' && r.linkOpening === r1.openings[0].id)!;
d = M.removeRow(d, ust1.id);
d = M.updateOpening(d, r1.id, r1.openings[0].id, 'width', '3.5', catalog, id);
// 2-xona: Kuxnya, eni 2 ; umumiy (xonasiz) qator yo'q
d = M.addRoom(d, id);
const r2 = d.rooms[1];
d = M.updateRoomName(d, r2.id, 'Kuxnya');
d = M.updateOpening(d, r2.id, r2.openings[0].id, 'height', '2', catalog, id);
d = M.updateOpening(d, r2.id, r2.openings[0].id, 'width', '2', catalog, id);
t = M.resolveTarget(d, r2.id, undefined);
d = M.addRow(d, 'mahsulot', catalog, t, id, 'p25')!; // Truba karniz
d = M.setRowQty(d, d.rows[d.rows.length - 1].id, 2.5);
d = M.setRowPrice(d, d.rows[d.rows.length - 1].id, 20000);

const got = {
  totals: M.totals(d),
  rooms: d.rooms.map((r) => M.roomTotal(d, r.id)),
  rows: d.rows.map((r) => `${r.section}|${r.productName}|${r.qty}|${r.price}`).sort(),
  groups: M.costGroups(d).map((g) => [g.name, g.sums.mahsulot, g.sums.tikish, g.sums.ustanovka, g.grand]),
  label: M.openingLabel(d.rooms[0].openings, 1),
  v1: M.validateCustomer(d)?.message ?? null,
  v2: M.validateServices(d, catalog)?.message ?? null,
};
// Kutilgan natija eski ilovada (curtain-app) xuddi shu qadamlar bilan olingan
const expected = {"totals": {"mahsulot": 330000, "tikish": 450000, "ustanovka": 190000, "xizmat": 640000, "grand": 970000}, "rooms": [700000, 270000], "rows": ["mahsulot|Material|7|40000", "mahsulot|Truba karniz|2.5|20000", "tikish|Karniz 1 (tikish)|2|60000", "tikish|Karniz 1 (tikish)|2|60000", "tikish|Karniz 1 (tikish)|3.5|60000", "ustanovka|Ust. Karniz 1|1.8|50000", "ustanovka|Ust. Karniz 1|2|50000"], "groups": [["Mehmonxona", 280000, 330000, 90000, 700000], ["Kuxnya", 50000, 120000, 100000, 270000]], "label": "Eshik 1"};
let failed = 0;
for (const k of Object.keys(expected) as (keyof typeof expected)[]) {
  const ok = JSON.stringify(expected[k]) === JSON.stringify((got as Record<string, unknown>)[k]);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${k}`);
  if (!ok) { failed++; console.log('  kutilgan:', JSON.stringify(expected[k]), '\n  olingan: ', JSON.stringify((got as Record<string, unknown>)[k])); }
}
if (got.v1 !== 'Mijoz ismini kiriting' || got.v2 !== null) { failed++; console.log('FAIL tekshiruvlar'); } else console.log('OK   tekshiruvlar');
// Telefon formati
const ph = [M.normalizePhone('901234567'), M.normalizePhone('+998 90 123 45 67 8'), M.phoneComplete('+998901234567')];
if (JSON.stringify(ph) !== JSON.stringify(['+998901234567', '+998901234567', true])) { failed++; console.log('FAIL telefon', ph); } else console.log('OK   telefon');
if (failed) { console.log(`${failed} ta xato`); process.exit(1); } else console.log('Hammasi to‘g‘ri');

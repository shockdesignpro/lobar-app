// ============================================================
// Chek: eski ilovadagi (chek.js + room-costs.js) bilan bir xil HTML va CSS.
// Chek ranglari tungi rejimda ham o'zgarmaydi.
// ============================================================
import { costGroups, mqText, type Draft, type Opening, type Row, type Section } from './order/model';

/** Eski ilova CSS'idan aynan olingan (faqat .lobar-rcpt ichida ishlaydi) */
export const RECEIPT_CSS = ".lobar-rcpt, .lobar-rcpt * { box-sizing: border-box; margin: 0; padding: 0; }\n.lobar-rcpt { background: rgb(255, 255, 255); padding: 20px; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; width: 400px; }\n.lobar-rcpt .rcpt-header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid var(--teal); padding-bottom: 12px; }\n.lobar-rcpt .rcpt-title { font-size: 20px; font-weight: 800; color: var(--teal); }\n.lobar-rcpt .rcpt-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }\n.lobar-rcpt .rcpt-client { background: rgb(244, 246, 245); border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 13px; }\n.lobar-rcpt .rcpt-client div { margin-bottom: 3px; }\n.lobar-rcpt .rcpt-client strong { color: var(--teal-dark); }\n.lobar-rcpt .rcpt-section { margin-bottom: 12px; }\n.lobar-rcpt .rcpt-section-title { font-size: 11px; font-weight: 800; color: rgb(255, 255, 255); background: var(--teal); padding: 5px 10px; border-radius: 5px; margin-bottom: 6px; }\n.lobar-rcpt .rcpt-section-title-amber { background: var(--amber); }\n.lobar-rcpt .rcpt-section-title-purple { background: var(--purple); }\n.lobar-rcpt .rcpt-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 6px; border-bottom: 1px solid rgb(238, 238, 238); font-size: 12px; }\n.lobar-rcpt .rcpt-row:last-child { border-bottom-width: medium; border-bottom-style: none; border-bottom-color: currentcolor; }\n.lobar-rcpt .rcpt-name { flex: 1 1 0%; color: rgb(51, 51, 51); }\n.lobar-rcpt .rcpt-price { width: 64px; text-align: center; color: var(--muted); }\n.lobar-rcpt .rcpt-mq { width: 42px; text-align: center; color: var(--muted); }\n.lobar-rcpt .rcpt-sum { width: 78px; text-align: right; font-weight: 700; color: var(--text); }\n.lobar-rcpt .rcpt-subtotal { display: flex; justify-content: space-between; padding: 5px 6px; background: rgb(244, 246, 245); border-radius: 5px; font-size: 12px; margin-top: 4px; }\n.lobar-rcpt .rcpt-subtotal span:last-child { font-weight: 800; }\n.lobar-rcpt .rcpt-totals { background: linear-gradient(135deg,var(--teal-dark),var(--teal-mid)); border-radius: 8px; padding: 12px; color: rgb(255, 255, 255); margin-top: 12px; }\n.lobar-rcpt .rcpt-tot-line { display: flex; justify-content: space-between; padding: 3px 0px; font-size: 12px; }\n.lobar-rcpt .rcpt-tot-line span:last-child { font-weight: 700; }\n.lobar-rcpt .rcpt-tot-div { border-width: 1px medium medium; border-style: solid none none; border-color: rgba(255, 255, 255, 0.2) currentcolor currentcolor; border-image: none; margin: 6px 0px; }\n.lobar-rcpt .rcpt-xizmat { display: flex; justify-content: space-between; padding: 5px 8px; background: rgba(255, 255, 255, 0.12); border-radius: 6px; margin: 4px 0px; font-size: 13px; }\n.lobar-rcpt .rcpt-xizmat span:last-child { font-weight: 800; }\n.lobar-rcpt .rcpt-grand { display: flex; justify-content: space-between; padding-top: 8px; margin-top: 4px; border-top: 1px solid rgba(255, 255, 255, 0.25); }\n.lobar-rcpt .rcpt-grand span:first-child { font-size: 15px; font-weight: 800; }\n.lobar-rcpt .rcpt-grand span:last-child { font-size: 20px; font-weight: 800; }\n.lobar-rcpt .rcpt-footer { text-align: center; font-size: 10px; color: var(--muted); margin-top: 12px; padding-top: 8px; border-top: 1px solid rgb(238, 238, 238); }\n.lobar-rcpt .rcpt-room-group { margin: 0px 0px 30px; padding-top: 6px; break-inside: avoid; color: var(--text); }\n.lobar-rcpt .rcpt-room-group h3 { font-size: 15px; color: var(--teal-dark); border-bottom: 2px solid var(--teal); padding: 8px 6px; margin: 0px 0px 8px; overflow-wrap: anywhere; }\n.lobar-rcpt .room-dimension { display: flex; justify-content: space-between; gap: 10px; padding: 6px; border-bottom: 1px solid var(--border); font-size: 13px; }\n.lobar-rcpt .room-dimension em { font-style: normal; color: var(--muted); }\n.lobar-rcpt .room-dimension strong { flex-shrink: 0; }\n.lobar-rcpt .room-category, .lobar-rcpt .room-grand { display: flex; justify-content: space-between; gap: 8px; background: var(--teal); color: white; padding: 6px 8px; font-size: 13px; font-weight: 800; margin-top: 14px; border-radius: 6px; }\n.lobar-rcpt .room-item { display: grid; grid-template-columns: minmax(0px, 1fr) 62px 36px 76px; gap: 4px; padding: 6px; border-bottom: 1px solid var(--border); font-size: 12px; align-items: start; }\n.lobar-rcpt .room-item span:first-child { overflow-wrap: anywhere; }\n.lobar-rcpt .room-item span:nth-child(2), .lobar-rcpt .room-item span:nth-child(3) { color: var(--muted); text-align: right; }\n.lobar-rcpt .room-item strong { text-align: right; overflow-wrap: anywhere; }\n.lobar-rcpt .room-grand { border-radius: 0px; }\n.lobar-rcpt .category-tikish { background: var(--amber); }\n.lobar-rcpt .category-ustanovka { background: var(--purple); }\n.lobar-rcpt .room-item { display: flex; gap: 4px; }\n.lobar-rcpt .room-item span:first-child { flex: 1 1 0%; min-width: 0px; }\n.lobar-rcpt .room-item span:nth-child(2) { flex: 0 0 62px; }\n.lobar-rcpt .room-item span:nth-child(3) { flex: 0 0 36px; }\n.lobar-rcpt .room-item strong { flex: 0 0 76px; }\n.lobar-rcpt .room-item span:nth-child(2), .lobar-rcpt .room-item span:nth-child(3) { text-align: left; }\n.lobar-rcpt .rcpt-price, .lobar-rcpt .rcpt-mq { text-align: left; }\n.lobar-rcpt .room-category { align-items: center; padding: 8px; min-height: 34px; line-height: 18px; box-sizing: border-box; }\n.lobar-rcpt .room-category > span { display: flex; align-items: center; gap: 5px; line-height: 18px; }\n.lobar-rcpt .room-category-icon { display: inline-flex; align-items: center; justify-content: center; line-height: 18px; width: 18px; flex-shrink: 0; }\n.lobar-rcpt .room-category > strong { line-height: 18px; }\n.lobar-rcpt .room-subhead { padding: 7px 6px 3px; font-size: 11.5px; font-weight: 800; color: var(--teal-dark,#095c47); border-bottom: 1px solid var(--border); }\n.lobar-rcpt { --teal: #0d7a5f; --teal-light: #e6f5f1; --teal-mid: #1a9e7a; --teal-dark: #095c47; --amber: #e8a020; --amber-light: #fef6e6; --purple: #6b5fe0; --purple-light: #f0eeff; --red: #d94040; --red-light: #fdeaea; --blue: #1a6fb5; --blue-light: #e8f2fc; --bg: #f4f6f5; --card: #fff; --text: #1a2420; --muted: #6b8076; --border: #dde8e4; color: rgb(26, 36, 32); background: rgb(255, 255, 255); color-scheme: light; }";

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const fmtN = (n: number) => { const r = Math.round(n) || 0; const s = Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return r < 0 ? '-' + s : s; };
const fmt = (n: number) => fmtN(n) + " so'm";

export function receiptDateTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function curtainLabel(openings: Opening[], idx: number) {
  const kind = openings[idx]?.kind || 'deraza';
  let count = 0;
  for (let i = 0; i <= idx; i++) if ((openings[i]?.kind || 'deraza') === kind) count++;
  return (kind === 'eshik' ? '🚪 Eshik ' : '🪟 Deraza ') + count;
}

/** Xona ichidagi qatorlarni har bir deraza/eshik bo'yicha ajratadi (chekdagidek). Bitta parda bo'lsa — ajratilmaydi. */
export function rowsByCurtain(rows: Row[], curtains: Opening[], label: (curtains: Opening[], idx: number) => string = curtainLabel) {
  if (curtains.length < 2) return [{ label: '', rows }];
  const key = (r: Row) => r.openingId || r.linkOpening || '';
  const groups = curtains.map((c, j) => ({ label: label(curtains, j), rows: rows.filter((r) => key(r) === c.id) }));
  const other = rows.filter((r) => !curtains.some((c) => c.id === key(r)));
  if (other.length) groups.push({ label: 'Umumiy', rows: other });
  return groups.filter((g) => g.rows.length);
}

function rowsHtml(rows: Row[], curtains: Opening[]) {
  const line = (r: Row) => `<div class="room-item"><span>${esc(r.productName)}</span><span>${fmtN(r.price)}</span><span>×${esc(mqText(r.qty))}</span><strong>${fmtN((r.qty ?? 0) * r.price)}</strong></div>`;
  return rowsByCurtain(rows, curtains).map((g) => `${g.label ? `<div class="room-subhead">${g.label}</div>` : ''}${g.rows.map(line).join('')}`).join('');
}

export type ReceiptMeta = { number: string; date: number };

/** Chek ichki HTML'i (buildReceiptHtml) */
export function receiptHtml(d: Draft, meta: ReceiptMeta): string {
  const groups = costGroups(d);
  const m = groups.reduce((n, g) => n + g.sums.mahsulot, 0);
  const t = groups.reduce((n, g) => n + g.sums.tikish, 0);
  const u = groups.reduce((n, g) => n + g.sums.ustanovka, 0);
  const titles: Record<Section, string> = {
    mahsulot: '<span class="room-category-icon">📦</span>Harajatlar',
    tikish: '<span class="room-category-icon">✂️</span>Tikish xizmati',
    ustanovka: '<span class="room-category-icon">🔧</span>O‘rnatish xizmati',
  };
  const rooms = groups.map((g, i) => {
    const curtains = g.room ? g.room.openings : [];
    return `<section class="rcpt-room-group"><h3>${i + 1}. ${esc(g.name)}${g.room ? ` — ${curtains.length} ta parda` : ''}</h3>`
      + curtains.map((c, j) => `<div class="room-dimension"><span>${curtainLabel(curtains, j)} <em>(${esc(c.rail)}, ${esc(c.color)})</em></span><strong>${esc(c.height)} × ${esc(c.width)} m</strong></div>`).join('')
      + (['mahsulot', 'tikish', 'ustanovka'] as Section[]).map((s) => `<div class="room-category category-${s}"><span>${titles[s]}</span><strong>${fmt(g.sums[s])}</strong></div>${rowsHtml(g.rows[s], curtains)}`).join('')
      + `<div class="room-grand"><span>JAMI:</span><strong>${fmt(g.grand)}</strong></div></section>`;
  }).join('');
  return '<div class="rcpt-header"><div class="rcpt-title">🧵 Parda kalkulyatori</div>'
    + `<div class="rcpt-sub">ID: ${esc(meta.number)} · ${esc(receiptDateTime(meta.date))}</div></div>`
    + '<div class="rcpt-client">'
    + `<div><strong>Mijoz:</strong> ${esc(d.client.name.trim())}</div>`
    + `<div><strong>Manzil:</strong> ${esc(d.client.address.trim())}</div>`
    + `<div><strong>Tel:</strong> ${esc(d.client.phone)}</div></div>`
    + rooms
    + '<div class="rcpt-totals">'
    + `<div class="rcpt-tot-line"><span>📦 Harajatlar</span><span>${fmt(m)}</span></div>`
    + '<div class="rcpt-tot-div"></div>'
    + `<div class="rcpt-tot-line"><span>✂️ Tikish</span><span>${fmt(t)}</span></div>`
    + `<div class="rcpt-tot-line"><span>🔧 O'rnatish</span><span>${fmt(u)}</span></div>`
    + `<div class="rcpt-xizmat"><span>Xizmat haqi jami</span><span>${fmt(t + u)}</span></div>`
    + `<div class="rcpt-grand"><span>💰 JAMI</span><span>${fmt(m + t + u)}</span></div></div>`
    + '<div class="rcpt-footer">"Lobar" pardalar uyi tomonidan hisoblab berildi</div>';
}

/** To'liq HTML hujjat (telefonda PDF/rasm qilish uchun) */
export const receiptDocument = (inner: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=440"><style>body{margin:0;background:#fff}${RECEIPT_CSS}</style></head><body><div class="lobar-rcpt">${inner}</div></body></html>`;

export function receiptFileName(clientName: string, date: number) {
  const d = new Date(date);
  const safe = (clientName || 'mijoz').replace(/\s+/g, '_').replace(/[^\w-]/g, '') || 'mijoz';
  return `hisob_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${safe}.jpg`;
}

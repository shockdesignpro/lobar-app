// Eski ilovadagi fmtN / fmt / calcNumber bilan bir xil natija beradi.

/** 1234567 -> "1 234 567" (yaxlitlab) */
export function fmtN(n: number): string {
  const rounded = Math.round(n) || 0;
  const s = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return rounded < 0 ? '-' + s : s;
}

/** 1234567 -> "1 234 567 so‘m" */
export const fmtSom = (n: number) => `${fmtN(n)} so‘m`;

/** "60 000" -> 60000; "" -> 0; noto'g'ri -> null */
export function calcNumber(val: string): number | null {
  const text = String(val).replace(/\s/g, '').replace(',', '.');
  if (text === '') return 0;
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
}

/** O'zbekcha alifbo tartibi, raqamlar tabiiy tartibda (Karniz 2 < Karniz 10) */
export const byName = (a: { name: string }, b: { name: string }) =>
  String(a.name || '').localeCompare(String(b.name || ''), 'uz', { sensitivity: 'base', numeric: true });

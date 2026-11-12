// Brauzerda kerak emas — chek to'g'ridan-to'g'ri sahifada html2canvas bilan yasaladi
export function ReceiptRenderer() { return null; }
export function renderReceiptJpeg(): Promise<never> { return Promise.reject(new Error('Brauzerda ishlatilmaydi')); }
export function runCanvasPage(): Promise<never> { return Promise.reject(new Error('Brauzerda ishlatilmaydi')); }

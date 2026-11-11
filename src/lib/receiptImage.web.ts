// Brauzer: eski ilovadagidek html2canvas bilan JPG (3x aniqlik).
// iPhone/iPad: ulashish oynasi ("Rasmni saqlash" orqali galereyaga),
// Android/kompyuter: avval fayl yuklanadi, keyin (bo'lsa) ulashish oynasi.
import html2canvas from 'html2canvas';
import { RECEIPT_CSS } from './receipt';

export type ReceiptImage = { uri: string; blob: Blob; fileName: string; width: number; height: number };

export const isIOS = () =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export async function makeReceiptImage(innerHtml: string, fileName: string): Promise<ReceiptImage> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;';
  host.innerHTML = `<style>${RECEIPT_CSS}</style><div class="lobar-rcpt">${innerHtml}</div>`;
  document.body.appendChild(host);
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const el = host.querySelector('.lobar-rcpt') as HTMLElement;
    const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Rasm yaratilmadi'))), 'image/jpeg', 0.95));
    return { uri: canvas.toDataURL('image/jpeg', 0.95), blob, fileName, width: canvas.width, height: canvas.height };
  } finally {
    host.remove();
  }
}

export function downloadReceipt(img: ReceiptImage) {
  const a = document.createElement('a');
  a.download = img.fileName; a.href = img.uri; a.click();
}

/** Ulashish oynasi. true — ochildi, false — qo'llab-quvvatlanmaydi */
export async function shareReceipt(img: ReceiptImage): Promise<boolean> {
  const file = new File([img.blob], img.fileName, { type: 'image/jpeg' });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: img.fileName }); } catch { /* yopildi */ }
    return true;
  }
  if (isIOS()) {
    // Eski Safari: rasmni yangi oynada ochamiz — bosib turib "Rasmni saqlash"
    const w = window.open();
    if (w) {
      w.document.write(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${img.uri}" style="max-width:100%;height:auto;display:block"/></body></html>`);
      w.document.close();
      return true;
    }
  }
  return false;
}

/** Saqlangandan keyin: iOS'dan boshqa joyda fayl darhol yuklanadi (eski ilovadagidek) */
export const autoDownloadAfterSave = () => !isIOS();

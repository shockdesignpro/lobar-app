// Brauzer: rasm tanlash yoki kamerada olish, so'ng kichraytirib siqish (eski andoza.js bilan bir xil:
// eng katta tomoni 1000 px, JPEG sifati 0.72, kamera burilishi to'g'rilanadi).
const MAX_SIDE = 1000;
const QUALITY = 0.72;

function toJpeg(src: CanvasImageSource, w: number, h: number) {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', QUALITY);
}

export async function compressFile(file: Blob): Promise<string> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const out = toJpeg(bmp, bmp.width, bmp.height);
      bmp.close?.();
      return out;
    } catch { /* eski usulga o'tamiz */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Rasm ochilmadi')); i.src = url;
    });
    return toJpeg(img, img.naturalWidth, img.naturalHeight);
  } finally { URL.revokeObjectURL(url); }
}

/** Tugma bosilgan zahoti chaqirilishi kerak (brauzer fayl oynasini faqat shunda ochadi). */
export function pickPhotos(source: 'library' | 'camera'): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.setAttribute('capture', 'environment');
    else input.multiple = true;
    input.style.display = 'none';
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      input.remove();
      const out: string[] = [];
      for (const f of files) { try { out.push(await compressFile(f)); } catch { /* bitta rasm o'tmasa, qolganlari davom etadi */ } }
      resolve(out);
    };
    input.addEventListener('cancel', () => { input.remove(); resolve([]); });
    document.body.appendChild(input);
    input.click();
  });
}

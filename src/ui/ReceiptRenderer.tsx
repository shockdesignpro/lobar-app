// Telefon ilovasi: chekni JPG rasmga aylantirish.
// Ko'rinmas WebView ichida brauzerdagi bilan aynan bir xil usul (html2canvas, 3x aniqlik) ishlatiladi,
// shuning uchun chek rasmi brauzer versiyasidagi bilan bir xil chiqadi.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { receiptPage as page } from '../lib/receiptPage';

type Job = { html: string; resolve: (r: { base64: string; width: number; height: number }) => void; reject: (e: Error) => void };
let queue: Job[] = [];
let wake: (() => void) | null = null;

/** Istalgan sahifani ko'rinmas WebView'da ishga tushirib, u yuborgan JPG'ni qaytaradi */
export function runCanvasPage(pageHtml: string): Promise<{ base64: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!wake) { reject(new Error('Rasm tayyorlagich hali ishga tushmagan')); return; }
    queue.push({ html: pageHtml, resolve, reject });
    wake();
  });
}

export const renderReceiptJpeg = (innerHtml: string) => runCanvasPage(page(innerHtml));

/** App ichida bir marta joylanadi (ko'rinmaydi) */
export function ReceiptRenderer() {
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => {
    wake = () => setJob((cur) => cur ?? queue.shift() ?? null);
    return () => { wake = null; };
  }, []);
  useEffect(() => {
    if (!job) return;
    const t = setTimeout(() => finish({ ok: 0, e: 'Chek rasmini tayyorlash uzoq cho‘zildi' }), 25_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  const finish = (m: { ok: number; w?: number; h?: number; d?: string; e?: string }) => {
    setJob((cur) => {
      if (cur) {
        if (m.ok && m.d) cur.resolve({ base64: m.d, width: m.w ?? 0, height: m.h ?? 0 });
        else cur.reject(new Error(m.e || 'Chek rasmi yaratilmadi'));
      }
      return queue.shift() ?? null;
    });
  };

  if (!job) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0, width: 480, height: 900, opacity: 0 }}>
      <WebView key={String(job.html.length) + job.html.slice(-60)} originWhitelist={['*']} source={{ html: job.html }} javaScriptEnabled
        onMessage={(e) => { try { finish(JSON.parse(e.nativeEvent.data)); } catch { finish({ ok: 0 }); } }}
        onError={() => finish({ ok: 0, e: 'Chek sahifasi ochilmadi' })} style={{ width: 480, height: 900, backgroundColor: '#ffffff' }} />
    </View>
  );
}

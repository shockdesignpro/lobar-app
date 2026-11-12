// Telefon ilovasida chekni JPG qilish uchun WebView sahifasi (brauzerdagi usul bilan bir xil)
import { HTML2CANVAS_JS } from './html2canvasSource';
import { RECEIPT_CSS } from './receipt';

const RUNNER = `
(async function () {
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
    var el = document.querySelector('.lobar-rcpt');
    var c = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff', logging: false, useCORS: true });
    var d = c.toDataURL('image/jpeg', 0.95);
    window.ReactNativeWebView.postMessage(JSON.stringify({ ok: 1, w: c.width, h: c.height, d: d.slice(d.indexOf(',') + 1) }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ ok: 0, e: String(e && e.message || e) }));
  }
})();`;

/** WebView ichida ochiladigan to'liq sahifa: chek + html2canvas + natijani ilovaga yuborish */
export const receiptPage = (inner: string) => `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=480, initial-scale=1"/><style>${RECEIPT_CSS}</style></head>
<body style="margin:0;background:#ffffff"><div class="lobar-rcpt" style="display:inline-block">${inner}</div>
<script>${HTML2CANVAS_JS}</script><script>${RUNNER}</script></body></html>`;


// Rasm ustiga qalam bilan chizish: chiziqlar rasmga nisbatan (0..1) saqlanadi,
// so'ng asl rasm bilan birlashtirilib, yangi JPG qilinadi.
export type Stroke = { color: string; width: number; points: number[] }; // points: [x0, y0, x1, y1, ...] (0..1)

export const PEN_COLORS = [
  { key: '#e53935', label: 'Qizil' }, { key: '#111111', label: 'Qora' }, { key: '#ffffff', label: 'Oq' },
  { key: '#fbc02d', label: 'Sariq' }, { key: '#1e88e5', label: 'Ko‘k' },
];
export const PEN_SIZES = [{ key: 0.006, label: 'Ingichka' }, { key: 0.012, label: 'O‘rta' }, { key: 0.022, label: 'Qalin' }];

/** Chizish kodi (brauzerda ham, telefondagi WebView ichida ham bir xil) */
export const DRAW_BODY = `
  for (var i = 0; i < strokes.length; i++) {
    var s = strokes[i], p = s.points;
    if (!p || p.length < 2) continue;
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
    ctx.lineWidth = Math.max(1, s.width * w); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (p.length === 2) { ctx.beginPath(); ctx.arc(p[0] * w, p[1] * h, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath(); ctx.moveTo(p[0] * w, p[1] * h);
    for (var j = 2; j < p.length; j += 2) ctx.lineTo(p[j] * w, p[j + 1] * h);
    ctx.stroke();
  }`;

const MAX_SIDE = 1400;

/** Telefondagi WebView uchun to'liq sahifa: rasm + chiziqlar -> JPG (base64) */
export function annotatePage(src: string, strokes: Stroke[]) {
  return `<!doctype html><html><head><meta charset="utf-8"/></head><body style="margin:0"><script>
(function () {
  var strokes = ${JSON.stringify(strokes)};
  function post(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  var img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = function () {
    try {
      var k = Math.min(1, ${MAX_SIDE} / Math.max(img.naturalWidth, img.naturalHeight));
      var w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      ${DRAW_BODY}
      var d = c.toDataURL('image/jpeg', 0.85);
      post({ ok: 1, w: w, h: h, d: d.slice(d.indexOf(',') + 1) });
    } catch (e) { post({ ok: 0, e: String(e && e.message || e) }); }
  };
  img.onerror = function () { post({ ok: 0, e: 'Rasm yuklanmadi' }); };
  img.src = ${JSON.stringify(src)};
})();
</script></body></html>`;
}

/** Brauzerda: shu ishni sahifaning o'zida bajaramiz */
export function composeInBrowser(src: string, strokes: Stroke[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d')!; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        // eslint-disable-next-line no-new-func
        new Function('ctx', 'strokes', 'w', 'h', DRAW_BODY)(ctx, strokes, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85));
      } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); }
    };
    img.onerror = () => reject(new Error('Rasm yuklanmadi'));
    img.src = src;
  });
}

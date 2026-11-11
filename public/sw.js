// Lobar Parda — internetsiz ochilish uchun service worker.
// Sahifa: avval internetdan (yangi versiya), bo'lmasa saqlangan nusxa.
// Skript, rasm, shrift: saqlangan nusxa (nomida versiya bor, o'zgarmaydi).
// Server (Supabase) so'rovlariga tegmaydi — ular ilovaning o'zida navbat bilan boshqariladi.
const CACHE = 'lobar-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.json', '/icons/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res;
    }).catch(() => caches.match('/').then((r) => r || caches.match(req))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  })));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('/'))));
});

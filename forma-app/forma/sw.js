/* Форма: офлайн-кэш. Версию CACHE менять при каждом выпуске. */
const CACHE = 'forma-v1';
const FILES = ["./", "css/app.css", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "index.html", "js/app.js", "js/core.js", "js/data.js", "manifest.webmanifest", "media/climber/1.jpg", "media/climber/2.jpg", "media/climber/3.jpg", "media/climber/4.jpg", "media/pushup/1.jpg", "media/pushup/2.jpg", "media/pushup/3.jpg", "media/pushup/4.jpg", "media/squat/1.jpg", "media/squat/2.jpg", "media/squat/3.jpg", "media/squat/4.jpg", "media/squat/5.jpg"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then((hit) => hit || fetch(r).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(r, copy));
    return res;
  }).catch(() => caches.match('./index.html'))));
});

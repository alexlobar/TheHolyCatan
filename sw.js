// Service worker: permite instalar la app y usarla sin conexión.
// Estrategia "red primero": con internet siempre se sirve la última versión publicada
// (y se actualiza la copia); sin internet se usa la copia guardada.
// Debe coincidir con VERSION en js/app.js y data-build en index.html: cambiarlo renueva la copia guardada.
const CACHE = 'catan-v1.6.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/styles.css',
  './js/storage.js',
  './js/stats.js',
  './js/charts.js',
  './js/photos.js',
  './js/tracker.js',
  './js/tables.js',
  './js/game.js',
  './js/profile.js',
  './js/rules.js',
  './js/fun.js',
  './js/wrapped.js',
  './js/app.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(async () =>
        (await caches.match(req, { ignoreSearch: true })) ||
        (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});

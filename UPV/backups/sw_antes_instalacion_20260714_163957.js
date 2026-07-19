// UPV Service Worker v2
// Cache exclusivo upv-pwa-v2-mobile1. No toca caches de la app de recorredores.
// Usa rutas relativas. No depende de /upv/ en minusculas.
const UPV_CACHE = 'upv-pwa-v2-mobile1';

const UPV_ASSETS = [
  './',
  './index.html',
  './css/upv.css',
  './js/upv.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(UPV_CACHE)
      .then(cache => cache.addAll(UPV_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('upv-pwa-') && k !== UPV_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(UPV_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Sin conexion', { status: 503 });
        })
      )
  );
});

// UPV Service Worker — scope: /upv/
// Cache name exclusivo: no interfiere con el SW de la app principal
const UPV_CACHE = 'upv-pwa-v1';

const UPV_ASSETS = [
  './',
  './index.html',
  './css/upv.css',
  './js/upv.js',
  './manifest.json'
];

// Instalar: precaché de assets propios
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(UPV_CACHE).then(cache => cache.addAll(UPV_ASSETS))
  );
  self.skipWaiting();
});

// Activar: limpiar cachés obsoletos de UPV (no toca cachés de la app principal)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('upv-pwa-') && k !== UPV_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first con fallback a caché
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo interceptar recursos propios de /upv/
  if (!url.pathname.includes('/upv/')) return;

  // Peticiones a APIs externas (Firebase, UltraMsg): solo red
  if (url.hostname !== location.hostname) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Actualizar caché si la respuesta es válida
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(UPV_CACHE).then(cache => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

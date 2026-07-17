// UPV Service Worker v2
// Scope: relativo al directorio donde está registrado (./UPV/)
// Cache: upv-pwa-v3  — no toca cachés de la app principal de recorredores
const UPV_CACHE = 'upv-pwa-v3';

const UPV_ASSETS = [
  './',
  './index.html',
  './css/upv.css',
  './js/upv.js',
  './manifest.json'
];

// INSTALL — precaché de assets locales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(UPV_CACHE)
      .then(cache => cache.addAll(UPV_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — limpiar únicamente cachés upv-pwa-* anteriores
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('upv-pwa-') && k !== UPV_CACHE)
          .map(k => { console.log('[UPV-SW] eliminando caché antiguo:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// FETCH — network-first con fallback a caché; solo recursos del scope
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // No interceptar peticiones a dominios externos (Firebase, APIs, etc.)
  if (url.origin !== location.origin) return;

  // No interceptar peticiones que no pertenezcan a este scope
  // (el navegador ya garantiza el scope, esto es defensa adicional)
  if (event.request.method !== 'GET') return;

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
          // Fallback a index.html para rutas de navegación dentro de UPV
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Sin conexión', { status: 503 });
        })
      )
  );
});

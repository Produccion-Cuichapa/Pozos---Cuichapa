'use strict';

const CACHE_PREFIX = 'cuichapa-admin-';
const CACHE_NAME = 'cuichapa-admin-2026.07.19.045207';
const ADMIN_PATH = '/admin/';

const CORE_FILES = [
  '/admin/',
  '/admin/index.html',
  '/admin/manifest.json',
  '/admin/version.json',
  '/admin/css/admin-pwa.css',
  '/admin/js/admin-pwa.js',
  '/admin/icons/icon-192.png',
  '/admin/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        Promise.allSettled(
          CORE_FILES.map(url =>
            cache.add(
              new Request(url, {
                cache: 'reload'
              })
            )
          )
        )
      )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(
              key =>
                key.startsWith(CACHE_PREFIX) &&
                key !== CACHE_NAME
            )
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if(request.method !== 'GET'){
    return;
  }

  const url = new URL(request.url);

  if(
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(ADMIN_PATH)
  ){
    return;
  }

  if(request.mode === 'navigate'){
    event.respondWith(
      fetch(
        new Request(request, {
          cache: 'no-store'
        })
      )
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache =>
              cache.put('/admin/index.html', copy)
            );

          return response;
        })
        .catch(async () => {
          return (
            await caches.match('/admin/index.html') ||
            await caches.match('/admin/')
          );
        })
    );

    return;
  }

  /*
   * Network-first:
   * primero intenta obtener la versión publicada más reciente.
   * La caché solo se usa si no hay conexión.
   */
  event.respondWith(
    fetch(
      new Request(request, {
        cache: 'no-store'
      })
    )
      .then(response => {
        if(response && response.ok){
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy));
        }

        return response;
      })
      .catch(() =>
        caches.match(request)
      )
  );
});

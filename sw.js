// Service Worker — Campo Cuichapa PWA
const CACHE = 'cuichapa-v3';
const ASSETS = [
  '/Pozos---Cuichapa/',
  '/Pozos---Cuichapa/index.html',
  '/Pozos---Cuichapa/manifest.json'
];

// Ultramsg config (igual que en la app)
const UM_URL   = 'https://api.ultramsg.com/instance176718/messages/chat';
const UM_TOKEN = 'qgzhdd47v5b7xv4e';
const UM_TO    = '+522293735876';
const HIST_KEY = 'cuichapa_historial_v2';

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return cache.addAll(ASSETS).catch(function(){});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  // No interceptar llamadas a Ultramsg API
  if(e.request.url.includes('ultramsg.com')) return;
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(response){
        if(response && response.status === 200 && !e.request.url.includes('api.')){
          var clone = response.clone();
          caches.open(CACHE).then(function(cache){
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function(){
        return caches.match('/Pozos---Cuichapa/index.html');
      });
    })
  );
});

// ── Background Sync ────────────────────────────────
self.addEventListener('sync', function(e){
  if(e.tag === 'enviar-reportes-pendientes'){
    e.waitUntil(procesarColaBackground());
  }
});

async function procesarColaBackground(){
  // Leer historial desde todos los clientes
  const clients = await self.clients.matchAll();
  if(!clients.length) return;

  // Notificar a los clientes que procesen la cola
  clients.forEach(function(client){
    client.postMessage({ type: 'PROCESAR_COLA' });
  });
}

// ── Mensajes desde la app ─────────────────────────
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'REGISTRAR_SYNC'){
    self.registration.sync.register('enviar-reportes-pendientes').catch(function(){});
  }
});

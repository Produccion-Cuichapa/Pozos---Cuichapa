// Service Worker — Campo Cuichapa PWA v9
// FIX offline-first: cachea también SDK de Firebase y fuentes (antes excluidos),
// agrega timeout defensivo a fetch de red, y precachea más assets propios.
const CACHE = 'cuichapa-v9';
const ASSETS = [
  '/Pozos---Cuichapa/',
  '/Pozos---Cuichapa/index.html',
  '/Pozos---Cuichapa/manifest.json',
  '/Pozos---Cuichapa/alarma.mp3',
  '/Pozos---Cuichapa/styles.css',
  '/Pozos---Cuichapa/config.js',
  '/Pozos---Cuichapa/utils.js',
  '/Pozos---Cuichapa/excel.js',
  '/Pozos---Cuichapa/fotos.js',
  '/Pozos---Cuichapa/assets/js/alarm-audio.js',
  '/Pozos---Cuichapa/assets/js/android-fix.js'
];

// Timeout defensivo: si una petición de red tarda más de esto, se da
// por "señal débil" y se cae al caché en lugar de esperar indefinidamente.
const NETWORK_TIMEOUT_MS = 4000;

function fetchConTimeout(request){
  return new Promise(function(resolve, reject){
    var done = false;
    var timer = setTimeout(function(){
      if(!done){ done = true; reject(new Error('network-timeout')); }
    }, NETWORK_TIMEOUT_MS);
    fetch(request).then(function(r){
      if(!done){ done = true; clearTimeout(timer); resolve(r); }
    }).catch(function(err){
      if(!done){ done = true; clearTimeout(timer); reject(err); }
    });
  });
}

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS).catch(function(){}); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  // Solo se excluyen endpoints de DATOS EN VIVO (no cacheables por naturaleza):
  // Realtime Database (websocket/long-polling) y UltraMsg.
  // FIX: gstatic.com/googleapis.com SÍ se cachean ahora — ahí vive el SDK de
  // Firebase (archivos estáticos versionados) y las fuentes, que antes
  // siempre iban a red sin caché, incluso con señal débil.
  if(e.request.url.includes('ultramsg.com')||
     e.request.url.includes('firebaseio.com')) return;

  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      // FIX: timeout defensivo — si la red tarda demasiado (señal débil),
      // no dejar la petición colgada; caer al caché/index.html disponible.
      return fetchConTimeout(e.request).then(function(r){
        if(r&&r.status===200){var c=r.clone();caches.open(CACHE).then(function(cache){cache.put(e.request,c)});}
        return r;
      }).catch(function(){ return caches.match('/Pozos---Cuichapa/index.html'); });
    })
  );
});

self.addEventListener('message', function(e){
  if(e.data&&e.data.type==='SKIP_WAITING') self.skipWaiting();
  if(e.data&&e.data.type==='PLAY_ALARM'){
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(cs){
      cs.forEach(function(c){ c.postMessage({type:'PLAY_ALARM'}); });
    });
  }
});

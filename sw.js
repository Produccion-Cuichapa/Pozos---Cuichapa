// Service Worker — Campo Cuichapa PWA v7
const CACHE = 'cuichapa-v7';
const ASSETS = [
  '/Pozos---Cuichapa/',
  '/Pozos---Cuichapa/index.html',
  '/Pozos---Cuichapa/manifest.json'
];

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyC38U_K7RttexQ0c2y1baOXOtghqY0OBJ8',
  authDomain:        'pozos-cuichapa.firebaseapp.com',
  databaseURL:       'https://pozos-cuichapa-default-rtdb.firebaseio.com',
  projectId:         'pozos-cuichapa',
  storageBucket:     'pozos-cuichapa.firebasestorage.app',
  messagingSenderId: '119353457045',
  appId:             '1:119353457045:web:9b37512f51ae5d764c9e9c'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload){
  console.log('[SW] Push recibido:', JSON.stringify(payload));
  var data = payload.data || {};
  var notif = payload.notification || {};
  var tipo  = data.tipo  || notif.title || 'EMERGENCIA';
  var quien = data.quien || '';
  var lugar = data.lugar || '';
  var hora  = data.hora  || '';

  var title = '🚨 ALERTA: ' + tipo;
  var body  = quien ? 'Por: ' + quien : '';
  if(lugar) body += '\n📍 ' + lugar.split('\n')[0];
  if(hora)  body += ' · ' + hora;

  return self.registration.showNotification(title, {
    body:    body || 'Campo Cuichapa',
    icon:    '/Pozos---Cuichapa/icon-192.png',
    badge:   '/Pozos---Cuichapa/icon-192.png',
    vibrate: [500,200,500,200,500,200,800],
    tag:     'alarma-cuichapa-' + Date.now(),
    requireInteraction: true,
    silent:  false,
    data:    { url: '/Pozos---Cuichapa/', tipo, quien, lugar }
  });
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(function(cs){
      for(var i=0;i<cs.length;i++){
        if(cs[i].url.includes('Pozos---Cuichapa') && 'focus' in cs[i])
          return cs[i].focus();
      }
      return clients.openWindow('/Pozos---Cuichapa/');
    })
  );
});

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
  if(e.request.url.includes('ultramsg.com')||
     e.request.url.includes('firebaseio.com')||
     e.request.url.includes('googleapis.com')||
     e.request.url.includes('gstatic.com')) return;
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(r){
        if(r&&r.status===200){var c=r.clone();caches.open(CACHE).then(function(cache){cache.put(e.request,c)});}
        return r;
      }).catch(function(){ return caches.match('/Pozos---Cuichapa/index.html'); });
    })
  );
});

self.addEventListener('message', function(e){
  if(e.data&&e.data.type==='SKIP_WAITING') self.skipWaiting();
});

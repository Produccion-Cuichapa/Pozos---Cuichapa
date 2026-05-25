// Firebase Messaging Service Worker
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
  console.log('Push recibido en background:', payload);
  var data = payload.data || {};
  var tipo  = data.tipo  || (payload.notification && payload.notification.title) || 'EMERGENCIA';
  var quien = data.quien || '';
  var lugar = data.lugar || '';
  var hora  = data.hora  || '';

  var body = 'Por: ' + quien;
  if(lugar) body += '\n📍 ' + lugar.split('\n')[0];
  if(hora)  body += ' · ' + hora;

  return self.registration.showNotification('🚨 ALERTA: ' + tipo, {
    body:    body,
    icon:    '/Pozos---Cuichapa/icon-192.png',
    badge:   '/Pozos---Cuichapa/icon-192.png',
    vibrate: [500, 200, 500, 200, 500],
    tag:     'alarma-cuichapa',
    requireInteraction: true,
    data:    { url: '/Pozos---Cuichapa/' }
  });
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(cs){
      for(var i=0;i<cs.length;i++){
        if(cs[i].url.includes('Pozos---Cuichapa') && 'focus' in cs[i])
          return cs[i].focus();
      }
      return clients.openWindow('/Pozos---Cuichapa/');
    })
  );
});

'use strict';

/*
 * Firebase exclusivo de la aplicación UPV.
 *
 * IMPORTANTE:
 * - No escribe en /reportes, /alarmas ni /correcciones.
 * - No registra listeners de la app de recorredores.
 * - No configura UltraMsg.
 * - No envía datos todavía.
 */

var UPV_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC38U_K7RttexQ0c2y1baOXOtghqY0OBJ8',
  authDomain: 'pozos-cuichapa.firebaseapp.com',
  databaseURL: 'https://pozos-cuichapa-default-rtdb.firebaseio.com',
  projectId: 'pozos-cuichapa',
  storageBucket: 'pozos-cuichapa.firebasestorage.app'
};

function inicializarFirebaseUpv() {
  if (!window.firebase) {
    console.warn(
      '[UPV-Firebase] SDK no disponible. ' +
      'La app continuará funcionando en modo local.'
    );

    UPV.firebaseReady = false;
    UPV.firebaseConnected = false;
    return;
  }

  try {
    /*
     * Se utiliza una aplicación Firebase con nombre propio.
     * Esto evita reutilizar accidentalmente una instancia de otra app.
     */
    var app;

    try {
      app = firebase.app('upvApp');
    } catch (e) {
      app = firebase.initializeApp(
        UPV_FIREBASE_CONFIG,
        'upvApp'
      );
    }

    UPV.firebaseApp = app;
    UPV.firebaseDb = app.database();
    UPV.firebaseReady = true;

    /*
     * .info/connected es una ruta interna de Firebase.
     * Solo informa si existe conexión; no escribe datos operativos.
     */
    UPV.firebaseDb
      .ref('.info/connected')
      .on('value', function(snapshot) {
        UPV.firebaseConnected = snapshot.val() === true;

        console.log(
          '[UPV-Firebase]',
          UPV.firebaseConnected
            ? 'Conectado a RTDB'
            : 'Sin conexión a RTDB'
        );

        window.dispatchEvent(
          new CustomEvent('upvFirebaseConnection', {
            detail: {
              connected: UPV.firebaseConnected
            }
          })
        );
      });

    console.log(
      '[UPV-Firebase] Inicialización aislada correcta'
    );
  } catch (error) {
    UPV.firebaseReady = false;
    UPV.firebaseConnected = false;

    console.error(
      '[UPV-Firebase] Error de inicialización:',
      error
    );
  }
}

function obtenerEstadoFirebaseUpv() {
  return {
    ready: UPV.firebaseReady === true,
    connected: UPV.firebaseConnected === true,
    database: UPV.firebaseDb ? 'configurada' : 'no_configurada'
  };
}

window.inicializarFirebaseUpv = inicializarFirebaseUpv;
window.obtenerEstadoFirebaseUpv = obtenerEstadoFirebaseUpv;

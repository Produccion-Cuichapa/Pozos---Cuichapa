'use strict';

// Estado único compartido por todos los módulos
var UPV = {
  empresa:          null,
  pantalla:         'upv',
  tipoOp:           null,
  gpsOperacion:     null,
  gpsObservacion:   null,
  fotosOperacion:   [],
  fotosObservacion: [],
  saveInProgress:   false,
  enLinea:          navigator.onLine,
  db:               null,

  // Firebase exclusivo UPV
  firebaseApp:       null,
  firebaseDb:        null,
  firebaseReady:     false,
  firebaseConnected: false,
  syncInProgress:    false
};

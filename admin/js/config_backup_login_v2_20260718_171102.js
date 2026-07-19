// Configuración central del Admin v2.
// Esta configuración corresponde al proyecto Firebase actual de Pozos Cuichapa.

window.ADMIN_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyC38U_K7RttexQ0c2y1baOXOtghqY0OBJ8',
    authDomain: 'pozos-cuichapa.firebaseapp.com',
    databaseURL: 'https://pozos-cuichapa-default-rtdb.firebaseio.com',
    projectId: 'pozos-cuichapa',
    storageBucket: 'pozos-cuichapa.firebasestorage.app',
    messagingSenderId: '119353457045',
    appId: '1:119353457045:web:9b37512f51ae5d764c9e9c',
    measurementId: 'G-CWT4PJ5WJB'
  },

  // FASE 1: login local de plataforma.
  // En fase posterior se puede migrar a usuarios/permisos desde Firebase.
  users: {
    Admin: { pass: '1234', role: 'admin', name: 'Administrador' },
    AntonioS: { pass: '1234', role: 'supervisor', name: 'Antonio Sánchez' },
    JaimeG: { pass: '1234', role: 'supervisor', name: 'Jaime G' },
    IngDuctos: { pass: '1234', role: 'ingenieria', name: 'Ing. Ductos' },
    Almacenista: { pass: '1234', role: 'almacen', name: 'Almacenista' },
    JorgeGill: { pass: '1234', role: 'supervisor', name: 'Jorge Gill' }
  },

  paths: {
    reportes: '/reportes',
    alarmas: '/alarmas'
  },

  limits: {
    reportes: 2000,
    alarmas: 1000
  }
};

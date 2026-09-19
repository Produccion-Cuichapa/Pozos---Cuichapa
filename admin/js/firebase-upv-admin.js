'use strict';

/*
 * Conexión secundaria exclusiva del módulo administrativo UPV.
 *
 * No reemplaza firebase.app() principal.
 * No modifica AdminFirebase.
 * No lee /reportes, /alarmas ni /correcciones.
 */

window.UPV_ADMIN_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyAkMbD9XgFDA6gchX38Ma6goABsoimi-50',
    authDomain: 'pozos-upv.firebaseapp.com',
    databaseURL: 'https://pozos-upv-default-rtdb.firebaseio.com',
    projectId: 'pozos-upv',
    storageBucket: 'pozos-upv.firebasestorage.app',
    messagingSenderId: '126193680547',
    appId: '1:126193680547:web:db6501b3d759491f13ff16',
    measurementId: 'G-108SP3JKHS'
  },

  paths: {
    reportes: '/upvReportesPrueba'
  },

  limits: {
    reportes: 2000
  }
};

window.AdminUpvFirebase = {
  app: null,
  db: null,
  reportes: [],
  connected: false,
  initialized: false,

  init(){
    if(this.initialized) return this;

    const config = window.UPV_ADMIN_CONFIG?.firebase;

    if(!config?.databaseURL){
      throw new Error(
        'Falta UPV_ADMIN_CONFIG.firebase.databaseURL'
      );
    }

    try{
      this.app = firebase.app('upvAdminApp');
    }catch(error){
      this.app = firebase.initializeApp(
        config,
        'upvAdminApp'
      );
    }

    this.db = this.app.database();
    this.initialized = true;

    this.db.ref('.info/connected').on('value', snap => {
      this.connected = snap.val() === true;

      const el = document.getElementById(
        'upvConnectionStatus'
      );

      if(el){
        el.textContent = this.connected
          ? 'Conectado a Pozos-UPV'
          : 'Sin conexión a Pozos-UPV';

        el.classList.toggle(
          'ok',
          this.connected
        );

        el.classList.toggle(
          'danger',
          !this.connected
        );
      }

      window.AdminUpv?.render();
    });

    return this;
  },

  listen(){
    if(!this.db) return;

    const path =
      window.UPV_ADMIN_CONFIG.paths.reportes;

    const limit =
      window.UPV_ADMIN_CONFIG.limits.reportes;

    this.db
      .ref(path)
      .limitToLast(limit)
      .on(
        'value',
        snap => {
          this.reportes = this.snapshotToArray(
            snap.val()
          );

          window.AdminUpv?.render();
        },
        error => {
          console.error(
            '[Admin-UPV] Error leyendo reportes:',
            error
          );

          const el = document.getElementById(
            'upvConnectionStatus'
          );

          if(el){
            el.textContent =
              'Error al consultar Pozos-UPV';

            el.classList.remove('ok');
            el.classList.add('danger');
          }
        }
      );
  },

  snapshotToArray(value){
    if(!value) return [];

    return Object.entries(value)
      .map(([id, row]) => ({
        id,
        ...(row || {})
      }))
      .sort(
        (a, b) =>
          this.getTime(b) - this.getTime(a)
      );
  },

  getTime(item){
    const candidates = [
      item?.createdAt,
      item?.fecha,
      item?.receivedAtClient,
      item?.firebaseSyncedAt
    ];

    for(const value of candidates){
      if(!value) continue;

      const time = new Date(value).getTime();

      if(Number.isFinite(time)){
        return time;
      }
    }

    const numericId = Number(item?.id);

    return Number.isFinite(numericId)
      ? numericId
      : 0;
  }
};

window.AdminFirebase = {
  app: null,
  db: null,
  reportes: [],
  alarmas: [],

  init(){
    if(!window.ADMIN_CONFIG?.firebase?.databaseURL){
      throw new Error('Falta ADMIN_CONFIG.firebase.databaseURL');
    }

    if(!firebase.apps.length){
      this.app = firebase.initializeApp(window.ADMIN_CONFIG.firebase);
    }else{
      this.app = firebase.app();
    }

    this.db = firebase.database();

    const connectedRef = this.db.ref('.info/connected');
    connectedRef.on('value', snap => {
      const ok = snap.val() === true;
      const el = document.getElementById('connStatus');
      if(el){
        el.textContent = ok ? 'Firebase conectado' : 'Sin conexión Firebase';
        el.classList.toggle('ok', ok);
        el.classList.toggle('danger', !ok);
      }
    });

    return this;
  },

  listen(){
    const paths = window.ADMIN_CONFIG.paths;
    const limits = window.ADMIN_CONFIG.limits;

    // Mantener una ventana de reportes recientes con eventos
    // incrementales para evitar descargar el snapshot completo
    // cada vez que un reporte se agrega, modifica o elimina.
    const reportesQuery = this.db
      .ref(paths.reportes)
      .orderByKey()
      .limitToLast(limits.reportes);

    let renderPendiente = false;

    const programarRender = () => {
      if(renderPendiente){
        return;
      }

      renderPendiente = true;

      window.setTimeout(() => {
        renderPendiente = false;

        this.reportes.sort(
          (a, b) =>
            AdminUtils.getTime(b) -
            AdminUtils.getTime(a)
        );

        window.AdminApp.render();
      }, 100);
    };

    const guardarReporte = snap => {
      const id = snap.key;
      const value = snap.val() || {};

      const index =
        this.reportes.findIndex(
          item => item.id === id
        );

      const row = {
        id,
        ...value
      };

      if(index >= 0){
        this.reportes[index] = row;
      }else{
        this.reportes.push(row);
      }

      programarRender();
    };

    reportesQuery.on(
      'child_added',
      guardarReporte
    );

    reportesQuery.on(
      'child_changed',
      guardarReporte
    );

    reportesQuery.on(
      'child_removed',
      snap => {
        this.reportes =
          this.reportes.filter(
            item => item.id !== snap.key
          );

        programarRender();
      }
    );

    this.db.ref(paths.alarmas).limitToLast(limits.alarmas).on('value', snap => {
      this.alarmas = this.snapshotToArray(snap.val());
      window.AdminApp.render();
    });
  },

  snapshotToArray(obj){
    if(!obj) return [];
    return Object.entries(obj)
      .map(([id, value]) => ({ id, ...(value || {}) }))
      .sort((a,b) => AdminUtils.getTime(b) - AdminUtils.getTime(a));
  }
};

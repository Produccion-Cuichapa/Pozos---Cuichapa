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

    this.db.ref(paths.reportes).limitToLast(limits.reportes).on('value', snap => {
      this.reportes = this.snapshotToArray(snap.val());
      window.AdminApp.render();
    });

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

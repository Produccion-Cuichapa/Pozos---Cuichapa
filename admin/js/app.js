window.AdminApp = {
  started: false,

  async init(){
    // Inicializar Firebase App antes del login.
    AdminFirebase.initApp();

    this.bindLogin();

    // LAB215: cada carga requiere autenticacion nueva.
    // BLOQUE 291: sesion durante navegacion interna.
    await firebase.auth().setPersistence(
      firebase.auth.Auth.Persistence.SESSION
    );

    await AdminAuth.init();
    await firebase.auth().signOut();
    AdminAuth.current = null;
    sessionStorage.removeItem('admin_v2_user');

    document.getElementById('appView')
      .classList.add('hidden');

    const selector = document.getElementById('platformSelector204');
    selector.classList.add('hidden');
    selector.style.display = 'none';

    document.getElementById('loginView')
      .classList.remove('hidden');
  },

  bindLogin(){
    document.getElementById('loginBtn').addEventListener('click', () => this.login());
    document.getElementById('loginPass').addEventListener('keydown', e => {
      if(e.key === 'Enter') this.login();
    });
    document.getElementById('logoutBtn').addEventListener('click', () => AdminAuth.logout());

    document.getElementById('platformOperations204')
      .addEventListener('click', () => this.start());

    document.getElementById('changePlatform207')
      .addEventListener('click', () => this.showSelector207());

    document.getElementById('selectorLogout215')
      .addEventListener('click', () => AdminAuth.logout());
  },

  async login(){
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    const btn = document.getElementById('loginBtn');
    const error = document.getElementById('loginError');

    error.textContent = '';
    btn.disabled = true;

    try{
      const res = await AdminAuth.login(user, pass);

      if(!res.ok){
        error.textContent = res.error;
        return;
      }

      this.showSelector207();
    }finally{
      btn.disabled = false;
    }
  },

  // SELECTOR_PLATAFORMAS_207
  showSelector207(){
    if(!AdminAuth.current) return;

    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('appView').classList.add('hidden');

    const selector=document.getElementById('platformSelector204');
    selector.classList.remove('hidden');
    selector.style.display='flex';
  },

  start(){
    if(!AdminAuth.current) return;

    const selector=document.getElementById('platformSelector204');
    selector.classList.add('hidden');
    selector.style.display='none';

    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');

    // Evitar inicializar dos veces los listeners.
    if(this.started){
      this.render();
      return;
    }

    AdminFirebase.init();
    AdminUI.init();

    // CONFIG_CENTER_LIFECYCLE_241
    // Iniciar exclusivamente dentro del Centro de Operaciones.
    if(
      window.AdminConfigCenter &&
      typeof window.AdminConfigCenter.init === 'function'
    ){
      window.AdminConfigCenter.init();
    }
    AdminReportes.init();
    if(window.AdminPozos) AdminPozos.init();
    AdminAlarmas.init();

    if(
      window.AdminGraficas &&
      typeof AdminGraficas.init === 'function'
    ){
      AdminGraficas.init();
    }

    if(window.AdminExportaciones) AdminExportaciones.init();
    if(window.AdminUpv) AdminUpv.init();

    this.started = true;
    AdminFirebase.listen();
    if(window.AdminUpv) AdminUpv.listen();
    this.render();
  },

  render(){
    if(!this.started) return;
    AdminDashboard.render();
    // Sincronizar colores del croquis con los reportes ya cargados.
    if (
      window.CroquisCampo &&
      typeof window.CroquisCampo.actualizarEstados === 'function' &&
      window.AdminFirebase &&
      Array.isArray(AdminFirebase.reportes)
    ) {
      window.CroquisCampo.actualizarEstados(AdminFirebase.reportes);
    }

    AdminReportes.render();
    if(window.AdminPozos) AdminPozos.render();
    AdminAlarmas.render();

    /* QUIMICOS_RENDER_ADMIN_465 */
    if(typeof window.AdminQuimicosActualizar === "function"){
      window.AdminQuimicosActualizar();
    }
    window.MonitoreoFT?.render();
    if(window.AdminUpv) AdminUpv.render();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.AdminApp.init();
});

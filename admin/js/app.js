window.AdminApp = {
  started: false,

  async init(){
    // Inicializar Firebase App antes del login.
    AdminFirebase.initApp();

    this.bindLogin();

    if(await AdminAuth.init()){
      this.start();
    }
  },

  bindLogin(){
    document.getElementById('loginBtn').addEventListener('click', () => this.login());
    document.getElementById('loginPass').addEventListener('keydown', e => {
      if(e.key === 'Enter') this.login();
    });
    document.getElementById('logoutBtn').addEventListener('click', () => AdminAuth.logout());
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

      this.start();
    }finally{
      btn.disabled = false;
    }
  },

  start(){
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');

    AdminFirebase.init();
    AdminUI.init();
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
    AdminReportes.render();
    if(window.AdminPozos) AdminPozos.render();
    AdminAlarmas.render();
    if(window.AdminUpv) AdminUpv.render();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.AdminApp.init();
});

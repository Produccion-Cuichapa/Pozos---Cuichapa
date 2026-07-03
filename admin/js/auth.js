window.AdminAuth = {
  current: null,

  init(){
    const saved = sessionStorage.getItem('admin_v2_user');
    if(saved && window.ADMIN_CONFIG.users[saved]){
      this.current = { user: saved, ...window.ADMIN_CONFIG.users[saved] };
      return true;
    }
    return false;
  },

  login(user, pass){
    const cleanUser = String(user || '').trim();
    const found = window.ADMIN_CONFIG.users[cleanUser];

    if(!found || found.pass !== pass){
      return { ok:false, error:'Usuario o contraseña incorrectos.' };
    }

    sessionStorage.setItem('admin_v2_user', cleanUser);
    this.current = { user: cleanUser, ...found };
    return { ok:true };
  },

  logout(){
    sessionStorage.removeItem('admin_v2_user');
    this.current = null;
    location.reload();
  }
};

window.AdminAuth = {
  current: null,

  EMAILS: {
    Admin:   'admin@cuichapa.local',
    Jaime:   'jaime@cuichapa.local',
    Antonio: 'antonio@cuichapa.local'
  },

  async init(){
    const fbUser = firebase.auth().currentUser;

    if(!fbUser){
      this.current = null;
      sessionStorage.removeItem('admin_v2_user');
      return false;
    }

    const cleanUser = Object.keys(this.EMAILS).find(
      user => this.EMAILS[user].toLowerCase() === String(fbUser.email || '').toLowerCase()
    );

    if(!cleanUser || !window.ADMIN_CONFIG.users[cleanUser]){
      await firebase.auth().signOut();
      this.current = null;
      sessionStorage.removeItem('admin_v2_user');
      return false;
    }

    sessionStorage.setItem('admin_v2_user', cleanUser);

    this.current = {
      user: cleanUser,
      ...window.ADMIN_CONFIG.users[cleanUser]
    };

    return true;
  },

  async login(user, pass){
    const cleanUser = String(user || '').trim();
    const found = window.ADMIN_CONFIG.users[cleanUser];
    const email = this.EMAILS[cleanUser];

    if(!found || !email || !pass){
      return {
        ok: false,
        error: 'Usuario o contraseña incorrectos.'
      };
    }

    try{
      const cred = await firebase.auth()
        .signInWithEmailAndPassword(email, pass);

      if(!cred.user){
        throw new Error('Firebase no devolvió usuario autenticado.');
      }

      sessionStorage.setItem('admin_v2_user', cleanUser);

      this.current = {
        user: cleanUser,
        ...found
      };

      return { ok:true };

    }catch(err){
      console.warn('[ADMIN_AUTH]', err.code || err.message);

      this.current = null;
      sessionStorage.removeItem('admin_v2_user');

      return {
        ok: false,
        error: 'Usuario o contraseña incorrectos.'
      };
    }
  },

  async logout(){
    try{
      await firebase.auth().signOut();
    }catch(err){
      console.warn('[ADMIN_AUTH_LOGOUT]', err);
    }

    sessionStorage.removeItem('admin_v2_user');
    this.current = null;
    location.reload();
  }
};

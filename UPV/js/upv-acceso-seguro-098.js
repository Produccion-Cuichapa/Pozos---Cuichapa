'use strict';

(function(){
  const CLAVE='UPV_SESION_PROVEEDOR_V3';
  const DURACION=12*60*60*1000;

  const PASSWORDS={
    PETROSMART:'PETRO202601',
    TC:'TC202611'
  };

  let empresaPendiente=null;

  function obtenerSesion(){
    try{
      const sesion=JSON.parse(
        localStorage.getItem(CLAVE)||'null'
      );

      if(!sesion ||
         !Object.hasOwn(PASSWORDS,sesion.empresa) ||
         !Number.isFinite(sesion.inicio) ||
         !Number.isFinite(sesion.expira) ||
         sesion.expira-sesion.inicio!==DURACION ||
         Date.now()<sesion.inicio ||
         Date.now()>=sesion.expira){
        localStorage.removeItem(CLAVE);
        return null;
      }

      return sesion;
    }catch(_){
      localStorage.removeItem(CLAVE);
      return null;
    }
  }

  function error(mensaje){
    const el=document.getElementById('upv-auth-error');
    if(el)el.textContent=mensaje;
  }

  function abrir(empresa){
    if(!Object.hasOwn(PASSWORDS,empresa))return;

    empresaPendiente=empresa;

    const panel=document.getElementById('upv-auth-panel');
    const titulo=document.getElementById('upv-auth-empresa');
    const input=document.getElementById('upv-auth-password');

    if(titulo)titulo.textContent=empresa;
    if(panel)panel.hidden=false;
    if(input){
      input.value='';
      input.focus();
    }

    error('');
  }

  function cancelar(){
    empresaPendiente=null;

    const panel=document.getElementById('upv-auth-panel');
    const input=document.getElementById('upv-auth-password');

    if(panel)panel.hidden=true;
    if(input)input.value='';

    error('');
  }

  function ingresar(){
    const empresa=empresaPendiente;
    const input=document.getElementById('upv-auth-password');
    const password=input?.value||'';

    if(!empresa || password!==PASSWORDS[empresa]){
      error('Contraseña incorrecta.');
      if(input)input.value='';
      return false;
    }

    const inicio=Date.now();

    localStorage.setItem(CLAVE,JSON.stringify({
      empresa,
      inicio,
      expira:inicio+DURACION
    }));

    cancelar();

    // Evitar que el campo de contraseña conserve el foco.
    if(document.activeElement instanceof HTMLElement){
      document.activeElement.blur();
    }

    if(typeof window.UPVAccesoAutorizado==='function'){
      window.UPVAccesoAutorizado(empresa);
    }

    return true;
  }

  function cerrar(){
    localStorage.removeItem(CLAVE);
    cancelar();
  }

  function sesionVigente(){
    return Boolean(obtenerSesion());
  }

  function restaurar(){
    const sesion=obtenerSesion();

    if(!sesion)return false;

    if(typeof window.UPVAccesoAutorizado==='function'){
      window.UPVAccesoAutorizado(sesion.empresa);
      return true;
    }

    return false;
  }

  function verificarVencimiento(){
    const app=document.getElementById('upv-app');
    if(!app || app.style.display==='none')return;

    if(!sesionVigente()){
      if(typeof window.cerrarSesion==='function'){
        window.cerrarSesion();
      }else{
        cerrar();
        app.style.display='none';
        const login=document.getElementById('screen-login');
        if(login)login.style.display='flex';
      }
    }
  }

  setInterval(verificarVencimiento,1000);
  document.addEventListener('visibilitychange',verificarVencimiento);
  window.addEventListener('focus',verificarVencimiento);

  window.UPVAccesoSeguro={
    abrir,
    cancelar,
    ingresar,
    cerrar,
    restaurar,
    sesionVigente,
    obtenerSesion,
    duracionMs:DURACION
  };
})();

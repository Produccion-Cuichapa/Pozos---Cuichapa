(function(){
  'use strict';

  if(window.__UPV_PANTALLAS_V1__){
    return;
  }

  window.__UPV_PANTALLAS_V1__ = true;


  function login(){
    return document.getElementById(
      'screen-login'
    );
  }


  function app(){
    return document.getElementById(
      'upv-app'
    );
  }


  /* ======================================================
     PORTADA
     ====================================================== */

  function mostrarPortada(){

    const l = login();
    const a = app();

    document.body.classList.add(
      'upv-solo-portada'
    );

    document.body.classList.remove(
      'upv-app-abierta'
    );

    if(l){
      l.style.display = 'flex';
    }

    if(a){
      a.style.display = 'none';
    }

    /*
     * Siempre regresar arriba.
     * Así jamás queda visible una parte de la app anterior.
     */
    window.scrollTo({
      top:0,
      left:0,
      behavior:'instant'
    });

    console.log(
      '[UPV PANTALLAS] Portada activa'
    );
  }


  /* ======================================================
     APP OPERATIVA
     ====================================================== */

  function mostrarApp(){

    const l = login();
    const a = app();

    document.body.classList.remove(
      'upv-solo-portada'
    );

    document.body.classList.add(
      'upv-app-abierta'
    );

    if(l){
      l.style.display = 'none';
    }

    /*
     * No forzamos display si todavía el código principal
     * está procesando la empresa.
     *
     * Un instante después garantizamos flex.
     */
    setTimeout(
      function(){

        if(a){
          a.style.display = 'flex';
        }

        window.scrollTo({
          top:0,
          left:0,
          behavior:'instant'
        });

      },
      40
    );

    console.log(
      '[UPV PANTALLAS] App operativa activa'
    );
  }


  /* ======================================================
     EMPRESA
     ====================================================== */

  document.addEventListener(
    'click',
    function(event){

      const empresaBtn =
        event.target.closest(
          '.empresa-btn[data-empresa]'
        );

      if(empresaBtn){

        /*
         * Dejamos que primero trabaje la lógica original
         * que establece PETROSMART/IPEP.
         */
        setTimeout(
          mostrarApp,
          60
        );

        return;
      }


      /*
       * Botón regresar / cambiar empresa.
       * En tu HTML llama cerrarSesion().
       */
      const volver =
        event.target.closest(
          'button[onclick*="cerrarSesion"]'
        );

      if(volver){

        /*
         * Activar portada inmediatamente para impedir
         * que la pantalla operativa quede debajo.
         */
        setTimeout(
          mostrarPortada,
          30
        );
      }

    },
    true
  );


  /* ======================================================
     INICIALIZACIÓN
     ====================================================== */

  function iniciar(){

    const l = login();
    const a = app();

    if(!l || !a){
      return;
    }

    /*
     * Al cargar UPV, screen-login viene visible
     * y #upv-app viene display:none.
     */
    const loginVisible =
      getComputedStyle(l).display !== 'none';

    if(loginVisible){
      mostrarPortada();
    }else{
      mostrarApp();
    }
  }


  if(document.readyState === 'loading'){

    document.addEventListener(
      'DOMContentLoaded',
      iniciar,
      {once:true}
    );

  }else{

    iniciar();

  }


  window.UPVPantallas = {
    portada:mostrarPortada,
    app:mostrarApp
  };

})();

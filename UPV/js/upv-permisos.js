(function(){
  'use strict';

  if(window.__UPV_PERMISOS_V1__){
    return;
  }

  window.__UPV_PERMISOS_V1__ = true;

  let verificando = false;

  function estadoVisual(
    card,
    icon,
    status,
    tipo,
    texto
  ){
    if(!card || !icon || !status){
      return;
    }

    card.classList.remove(
      'is-ok',
      'is-warn',
      'is-error',
      'is-checking'
    );

    card.classList.add(
      'is-' + tipo
    );

    if(tipo === 'ok'){
      icon.textContent = '✅';
    }else if(tipo === 'error'){
      icon.textContent = '❌';
    }else if(tipo === 'checking'){
      icon.textContent = '⏳';
    }else{
      icon.textContent = '⚠️';
    }

    status.textContent = texto;
  }

  function elementos(){
    return {
      ubicacion:{
        card:document.getElementById(
          'upvPermUbicacion'
        ),
        icon:document.getElementById(
          'upvPermUbicacionIcon'
        ),
        status:document.getElementById(
          'upvPermUbicacionStatus'
        )
      },

      alertas:{
        card:document.getElementById(
          'upvPermAlertas'
        ),
        icon:document.getElementById(
          'upvPermAlertasIcon'
        ),
        status:document.getElementById(
          'upvPermAlertasStatus'
        )
      },

      gps:{
        card:document.getElementById(
          'upvPermGps'
        ),
        icon:document.getElementById(
          'upvPermGpsIcon'
        ),
        status:document.getElementById(
          'upvPermGpsStatus'
        )
      }
    };
  }

  async function verificarPermisoUbicacion(){
    const el = elementos().ubicacion;

    if(!navigator.geolocation){
      estadoVisual(
        el.card,
        el.icon,
        el.status,
        'error',
        'No disponible'
      );
      return;
    }

    if(
      navigator.permissions &&
      navigator.permissions.query
    ){
      try{
        const permiso =
          await navigator.permissions.query({
            name:'geolocation'
          });

        if(permiso.state === 'granted'){
          estadoVisual(
            el.card,
            el.icon,
            el.status,
            'ok',
            'Activada'
          );
        }else if(
          permiso.state === 'denied'
        ){
          estadoVisual(
            el.card,
            el.icon,
            el.status,
            'error',
            'Bloqueada'
          );
        }else{
          estadoVisual(
            el.card,
            el.icon,
            el.status,
            'warn',
            'Por autorizar'
          );
        }

        permiso.onchange = function(){
          verificarTodo();
        };

        return;
      }catch(error){
        // Algunos navegadores móviles no soportan
        // Permissions API para geolocation.
      }
    }

    estadoVisual(
      el.card,
      el.icon,
      el.status,
      'warn',
      'Disponible'
    );
  }

  function verificarAlertas(){
    const el = elementos().alertas;

    if(!('Notification' in window)){
      estadoVisual(
        el.card,
        el.icon,
        el.status,
        'warn',
        'No disponible'
      );
      return;
    }

    if(Notification.permission === 'granted'){
      estadoVisual(
        el.card,
        el.icon,
        el.status,
        'ok',
        'Activadas'
      );
    }else if(
      Notification.permission === 'denied'
    ){
      estadoVisual(
        el.card,
        el.icon,
        el.status,
        'error',
        'Bloqueadas'
      );
    }else{
      estadoVisual(
        el.card,
        el.icon,
        el.status,
        'warn',
        'Por autorizar'
      );
    }
  }

  function verificarGps(){
    const el = elementos().gps;

    if(!navigator.geolocation){
      estadoVisual(
        el.card,
        el.icon,
        el.status,
        'error',
        'No disponible'
      );
      return Promise.resolve();
    }

    estadoVisual(
      el.card,
      el.icon,
      el.status,
      'checking',
      'Verificando...'
    );

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        function(position){
          const accuracy = Math.round(
            Number(
              position.coords.accuracy || 0
            )
          );

          estadoVisual(
            el.card,
            el.icon,
            el.status,
            'ok',
            accuracy
              ? '±' + accuracy + ' m'
              : 'Activo'
          );

          resolve();
        },

        function(error){
          let mensaje = 'Sin señal GPS';

          if(error && error.code === 1){
            mensaje = 'Sin permiso';
          }

          if(error && error.code === 2){
            mensaje = 'No disponible';
          }

          if(error && error.code === 3){
            mensaje = 'Sin respuesta';
          }

          estadoVisual(
            el.card,
            el.icon,
            el.status,
            'error',
            mensaje
          );

          resolve();
        },

        {
          enableHighAccuracy:true,
          timeout:8000,
          maximumAge:30000
        }
      );
    });
  }

  async function verificarTodo(){
    if(verificando){
      return;
    }

    verificando = true;

    const btn = document.getElementById(
      'upvPermisosVerify'
    );

    if(btn){
      btn.disabled = true;
      btn.textContent = '⟳ Verificando';
    }

    try{
      await verificarPermisoUbicacion();
      verificarAlertas();
      await verificarGps();
    }finally{
      verificando = false;

      if(btn){
        btn.disabled = false;
        btn.textContent = '↻ Verificar';
      }
    }
  }

  function crearPanel(){
    if(
      document.getElementById(
        'upvPermisosPanel'
      )
    ){
      return true;
    }

    const portada = document.querySelector(
      '.upv-portada-final-activa, ' +
      '.upv-landing-renovada'
    );

    if(!portada){
      return false;
    }

    const footer = portada.querySelector(
      '.upv-footer-final'
    );

    const panel =
      document.createElement('section');

    panel.id = 'upvPermisosPanel';
    panel.className = 'upv-permisos-panel';

    panel.innerHTML = `
      <header class="upv-permisos-head">
        <div>
          <span class="upv-permisos-kicker">
            SEGURIDAD DEL DISPOSITIVO
          </span>

          <h2>
            ESTADO DE PERMISOS
          </h2>
        </div>

        <button
          type="button"
          id="upvPermisosVerify"
          class="upv-permisos-verify">
          ↻ Verificar
        </button>
      </header>

      <div class="upv-permisos-grid">

        <article
          id="upvPermUbicacion"
          class="upv-perm-card is-checking">

          <span
            id="upvPermUbicacionIcon"
            class="upv-perm-icon">
            ⏳
          </span>

          <strong>
            UBICACIÓN
          </strong>

          <small
            id="upvPermUbicacionStatus">
            Verificando...
          </small>
        </article>

        <article
          id="upvPermAlertas"
          class="upv-perm-card is-checking">

          <span
            id="upvPermAlertasIcon"
            class="upv-perm-icon">
            ⏳
          </span>

          <strong>
            ALERTAS
          </strong>

          <small
            id="upvPermAlertasStatus">
            Verificando...
          </small>
        </article>

        <article
          id="upvPermGps"
          class="upv-perm-card is-checking">

          <span
            id="upvPermGpsIcon"
            class="upv-perm-icon">
            ⏳
          </span>

          <strong>
            GPS ACTIVO
          </strong>

          <small
            id="upvPermGpsStatus">
            Verificando...
          </small>
        </article>

      </div>
    `;

    /*
     * Lo colocamos después del contenido principal
     * de la portada. No tocamos las tarjetas de empresa.
     */
    if(footer){
      footer.insertAdjacentElement(
        'afterend',
        panel
      );
    }else{
      portada.appendChild(panel);
    }

    panel
      .querySelector('#upvPermisosVerify')
      ?.addEventListener(
        'click',
        verificarTodo
      );

    verificarTodo();

    return true;
  }

  function iniciar(){
    if(crearPanel()){
      return;
    }

    let intentos = 0;

    const timer = setInterval(
      function(){
        intentos += 1;

        if(
          crearPanel() ||
          intentos >= 40
        ){
          clearInterval(timer);
        }
      },
      250
    );
  }

  window.UPVVerificarPermisos =
    verificarTodo;

  if(document.readyState === 'loading'){
    document.addEventListener(
      'DOMContentLoaded',
      iniciar,
      {once:true}
    );
  }else{
    iniciar();
  }

  document.addEventListener(
    'visibilitychange',
    function(){
      if(
        document.visibilityState ===
        'visible'
      ){
        setTimeout(
          verificarTodo,
          700
        );
      }
    }
  );
})();

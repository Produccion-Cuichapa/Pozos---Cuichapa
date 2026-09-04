(function(){
  'use strict';

  if(window.__UPV_INICIO_LIGERO_V4__){
    return;
  }

  window.__UPV_INICIO_LIGERO_V4__ = true;

  const KEY = 'upv_inicio_actividad_v4';

  let timerBusqueda = null;
  let busquedas = 0;

  function normalizar(valor){
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function leer(){
    try{
      const raw = localStorage.getItem(KEY);

      return raw
        ? JSON.parse(raw)
        : null;
    }catch(error){
      return null;
    }
  }

  function fechaHora(){
    const ahora = new Date();

    let hora = '';

    try{
      hora = new Intl.DateTimeFormat(
        'es-MX',
        {
          timeZone:'America/Mexico_City',
          hour:'2-digit',
          minute:'2-digit',
          second:'2-digit',
          hour12:false
        }
      ).format(ahora);
    }catch(error){
      hora =
        String(ahora.getHours()).padStart(2,'0') +
        ':' +
        String(ahora.getMinutes()).padStart(2,'0') +
        ':' +
        String(ahora.getSeconds()).padStart(2,'0');
    }

    const fecha = new Intl.DateTimeFormat(
      'es-MX',
      {
        day:'2-digit',
        month:'2-digit',
        year:'numeric'
      }
    ).format(ahora);

    return {
      timestamp:Date.now(),
      iso:ahora.toISOString(),
      fecha,
      hora
    };
  }

  function guardar(){
    const data = fechaHora();

    try{
      localStorage.setItem(
        KEY,
        JSON.stringify(data)
      );
    }catch(error){
      console.warn(
        '[UPV INICIO] No se pudo guardar',
        error
      );
    }

    return data;
  }

  function buscarBloqueFotos(){
    /*
     * Buscar primero un elemento pequeño cuyo texto
     * contenga FOTOGRAFÍAS.
     */
    const elementos = Array.from(
      document.querySelectorAll(
        'label,span,strong,h1,h2,h3,h4,p,div'
      )
    );

    const titulo = elementos.find(el => {
      if(el.children.length > 4){
        return false;
      }

      const txt = normalizar(
        el.textContent
      );

      return (
        txt === 'FOTOGRAFIAS' ||
        txt.startsWith('FOTOGRAFIAS ')
      );
    });

    if(!titulo){
      return null;
    }

    /*
     * Subir hasta encontrar la tarjeta que contiene
     * FOTOGRAFÍAS pero todavía NO contiene GPS.
     */
    let nodo = titulo;

    for(let i = 0; i < 7 && nodo; i++){
      const txt = normalizar(
        nodo.textContent
      );

      const contieneFotos =
        txt.includes('FOTOGRAFIAS');

      const contieneGps =
        txt.includes('CAPTURAR GPS');

      const contieneTermino =
        txt.includes('TERMINO');

      if(
        contieneFotos &&
        !contieneGps &&
        !contieneTermino
      ){
        const padre = nodo.parentElement;

        if(!padre){
          return nodo;
        }

        const padreTxt = normalizar(
          padre.textContent
        );

        if(
          padreTxt.includes('CAPTURAR GPS') ||
          padreTxt.includes('TERMINO')
        ){
          return nodo;
        }
      }

      nodo = nodo.parentElement;
    }

    return titulo.parentElement;
  }

  function pintar(){
    const btn = document.getElementById(
      'upvInicioBtn'
    );

    const estado = document.getElementById(
      'upvInicioEstado'
    );

    if(!btn || !estado){
      return;
    }

    const data = leer();

    if(!data){
      btn.disabled = false;
      btn.classList.remove(
        'is-confirmed'
      );

      btn.textContent = 'INICIO';

      estado.innerHTML =
        '<strong>Inicio pendiente</strong>' +
        '<span>Confirma cuando comiences la actividad</span>';

      return;
    }

    btn.disabled = true;
    btn.classList.add(
      'is-confirmed'
    );

    btn.textContent =
      '✓ INICIO REGISTRADO';

    estado.innerHTML =
      '<strong>Inicio confirmado</strong>' +
      '<span>' +
      data.fecha +
      ' · ' +
      data.hora +
      '</span>';
  }

  function confirmar(){
    if(leer()){
      pintar();
      return;
    }

    const ok = window.confirm(
      '¿Confirmas el INICIO de la actividad?\n\n' +
      'Se guardará la hora exacta de confirmación.'
    );

    if(!ok){
      return;
    }

    guardar();
    pintar();
  }

  function crear(){
    /*
     * Si ya existe, no volver a tocar el DOM.
     * Esto es clave para evitar congelamientos.
     */
    if(
      document.getElementById(
        'upvInicioWrap'
      )
    ){
      pintar();
      return true;
    }

    const fotos = buscarBloqueFotos();

    if(!fotos){
      return false;
    }

    const wrap =
      document.createElement('section');

    wrap.id = 'upvInicioWrap';
    wrap.className = 'upv-inicio-wrap';

    wrap.innerHTML = `
      <div class="upv-inicio-head">
        <div>
          <span>CONTROL DE ACTIVIDAD</span>
          <h3>Hora de inicio</h3>
        </div>
      </div>

      <button
        type="button"
        id="upvInicioBtn"
        class="upv-inicio-btn">
        INICIO
      </button>

      <div
        id="upvInicioEstado"
        class="upv-inicio-estado">
      </div>
    `;

    fotos.insertAdjacentElement(
      'beforebegin',
      wrap
    );

    document
      .getElementById('upvInicioBtn')
      .addEventListener(
        'click',
        confirmar
      );

    pintar();

    console.log(
      '[UPV INICIO] Creado una sola vez'
    );

    return true;
  }

  function buscarConLimite(){
    if(
      document.getElementById(
        'upvInicioWrap'
      )
    ){
      return;
    }

    /*
     * Máximo 20 intentos.
     * No hay MutationObserver.
     */
    if(timerBusqueda){
      clearInterval(timerBusqueda);
    }

    busquedas = 0;

    timerBusqueda = setInterval(
      function(){
        busquedas += 1;

        if(
          crear() ||
          busquedas >= 20
        ){
          clearInterval(
            timerBusqueda
          );

          timerBusqueda = null;
        }
      },
      300
    );
  }

  /*
   * Primera carga.
   */
  if(document.readyState === 'loading'){
    document.addEventListener(
      'DOMContentLoaded',
      buscarConLimite,
      {once:true}
    );
  }else{
    buscarConLimite();
  }

  /*
   * CARGA/DESCARGA pueden reconstruir partes del formulario.
   * Solo hacemos UNA búsqueda diferida, no observamos el DOM.
   */
  document.addEventListener(
    'click',
    function(event){
      const boton = event.target.closest(
        'button,[role="button"],label'
      );

      if(!boton){
        return;
      }

      const txt = normalizar(
        boton.textContent
      );

      if(
        txt.includes('CARGA') ||
        txt.includes('DESCARGA')
      ){
        setTimeout(
          buscarConLimite,
          180
        );
      }
    },
    false
  );

  window.UPVInicioActividad = {
    get(){
      return leer();
    },

    reset(){
      try{
        localStorage.removeItem(KEY);
      }catch(error){}

      pintar();
    },

    force(){
      return crear();
    }
  };
})();

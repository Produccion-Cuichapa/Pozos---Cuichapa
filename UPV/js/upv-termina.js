(function(){
  'use strict';

  if(window.__UPV_TERMINA_V1__){
    return;
  }

  window.__UPV_TERMINA_V1__ = true;

  const KEY_TERMINA =
    'upv_termina_actividad_v1';

  const KEY_DESTINO =
    'upv_termina_destino_v1';

  let timerBusqueda = null;
  let intentos = 0;


  function fechaHoraActual(){
    const ahora = new Date();

    let hora;

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

    const fecha =
      new Intl.DateTimeFormat(
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


  function leerTermina(){
    try{
      const raw =
        localStorage.getItem(
          KEY_TERMINA
        );

      return raw
        ? JSON.parse(raw)
        : null;

    }catch(error){
      return null;
    }
  }


  function leerDestino(){
    try{
      return (
        localStorage.getItem(
          KEY_DESTINO
        ) || ''
      );
    }catch(error){
      return '';
    }
  }


  function guardarTermina(){
    const data =
      fechaHoraActual();

    try{
      localStorage.setItem(
        KEY_TERMINA,
        JSON.stringify(data)
      );
    }catch(error){
      console.warn(
        '[UPV TERMINA] No se pudo guardar',
        error
      );
    }

    return data;
  }


  function guardarDestino(valor){
    try{
      if(valor){
        localStorage.setItem(
          KEY_DESTINO,
          valor
        );
      }else{
        localStorage.removeItem(
          KEY_DESTINO
        );
      }
    }catch(error){}
  }


  function pintar(){
    const boton =
      document.getElementById(
        'upvTerminaBtn'
      );

    const estado =
      document.getElementById(
        'upvTerminaEstado'
      );

    const select =
      document.getElementById(
        'upvTerminaDestino'
      );

    if(!boton || !estado){
      return;
    }

    const data =
      leerTermina();

    if(select){
      const guardado =
        leerDestino();

      if(
        guardado &&
        Array.from(select.options)
          .some(option =>
            option.value === guardado
          )
      ){
        select.value = guardado;
      }
    }

    if(!data){
      boton.disabled = false;

      boton.classList.remove(
        'is-confirmed'
      );

      boton.textContent =
        'TERMINA';

      estado.innerHTML = `
        <strong>Término pendiente</strong>
        <span>
          Confirma cuando finalice la actividad
        </span>
      `;

      return;
    }

    boton.disabled = true;

    boton.classList.add(
      'is-confirmed'
    );

    boton.textContent =
      '✓ TÉRMINO REGISTRADO';

    estado.innerHTML = `
      <strong>Término confirmado</strong>
      <span>
        ${data.fecha} · ${data.hora}
      </span>
    `;
  }


  function confirmarTermino(){
    if(leerTermina()){
      pintar();
      return;
    }

    const destino =
      document.getElementById(
        'upvTerminaDestino'
      )?.value || '';

    const textoDestino =
      destino
        ? '\nDestino seleccionado: ' +
          destino +
          '\n'
        : '\n';

    const aceptar =
      window.confirm(
        '¿Confirmas el TÉRMINO de la actividad?' +
        textoDestino +
        '\nSe guardará la fecha y hora exacta de esta confirmación.'
      );

    if(!aceptar){
      return;
    }

    if(destino){
      guardarDestino(destino);
    }

    guardarTermina();
    pintar();
  }


  function crear(){
    /*
     * INICIO ya está colocado exactamente antes
     * de Fotografías. Lo usamos como referencia,
     * evitando recorrer todo el DOM.
     */
    const inicio =
      document.getElementById(
        'upvInicioWrap'
      );

    if(!inicio){
      return false;
    }

    let wrap =
      document.getElementById(
        'upvTerminaWrap'
      );

    if(wrap){
      /*
       * Si el formulario fue reconstruido,
       * asegurar que siga justo debajo de INICIO.
       */
      if(
        inicio.nextElementSibling !== wrap
      ){
        inicio.insertAdjacentElement(
          'afterend',
          wrap
        );
      }

      pintar();
      return true;
    }

    wrap =
      document.createElement('section');

    wrap.id =
      'upvTerminaWrap';

    wrap.className =
      'upv-termina-wrap';

    wrap.innerHTML = `
      <div class="upv-termina-head">
        <div>
          <span>
            CONTROL DE ACTIVIDAD
          </span>

          <h3>
            Hora de término
          </h3>
        </div>
      </div>

      <button
        type="button"
        id="upvTerminaBtn"
        class="upv-termina-btn">
        TERMINA
      </button>

      <div
        id="upvTerminaEstado"
        class="upv-termina-estado">
      </div>

      <div
        class="upv-termina-destino">

        <label
          for="upvTerminaDestino">
          TERMINA EN
        </label>

        <select
          id="upvTerminaDestino"
          name="terminaEn">

          <option value="">
            Seleccionar destino...
          </option>

          <option value="BCS">
            BCS
          </option>

          <option value="POZO">
            POZO
          </option>

          <option value="ECO">
            ECO
          </option>

          <option value="PIA">
            PIA
          </option>

          <option value="BASE">
            BASE
          </option>

        </select>
      </div>
    `;

    inicio.insertAdjacentElement(
      'afterend',
      wrap
    );

    document
      .getElementById(
        'upvTerminaBtn'
      )
      ?.addEventListener(
        'click',
        confirmarTermino
      );

    document
      .getElementById(
        'upvTerminaDestino'
      )
      ?.addEventListener(
        'change',
        function(event){
          guardarDestino(
            event.target.value
          );
        }
      );

    pintar();

    console.log(
      '[UPV TERMINA] Módulo creado'
    );

    return true;
  }


  function buscarConLimite(){
    if(
      document.getElementById(
        'upvTerminaWrap'
      )
    ){
      pintar();
      return;
    }

    if(timerBusqueda){
      clearInterval(
        timerBusqueda
      );
    }

    intentos = 0;

    timerBusqueda =
      setInterval(
        function(){
          intentos += 1;

          if(
            crear() ||
            intentos >= 20
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
  if(
    document.readyState ===
    'loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      buscarConLimite,
      {once:true}
    );
  }else{
    buscarConLimite();
  }


  /*
   * CARGA/DESCARGA pueden reconstruir el formulario.
   * Búsqueda limitada, SIN MutationObserver.
   */
  document.addEventListener(
    'click',
    function(event){
      const boton =
        event.target.closest(
          'button,[role="button"],label'
        );

      if(!boton){
        return;
      }

      const texto =
        String(
          boton.textContent || ''
        )
          .trim()
          .toUpperCase();

      if(
        texto.includes('CARGA') ||
        texto.includes('DESCARGA')
      ){
        setTimeout(
          buscarConLimite,
          200
        );
      }
    },
    false
  );


  window.UPVTerminaActividad = {
    get(){
      return {
        termino:leerTermina(),
        destino:leerDestino()
      };
    },

    reset(){
      try{
        localStorage.removeItem(
          KEY_TERMINA
        );

        localStorage.removeItem(
          KEY_DESTINO
        );
      }catch(error){}

      const select =
        document.getElementById(
          'upvTerminaDestino'
        );

      if(select){
        select.value = '';
      }

      pintar();
    },

    force(){
      return crear();
    }
  };

})();

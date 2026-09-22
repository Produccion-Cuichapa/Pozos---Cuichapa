/* ==========================================================
   UPV — HISTORIAL CENTRAL SEGURO V2
   - Máximo 10 registros
   - NO oculta pantallas
   - NO usa MutationObserver
   - NO modifica screen-upv
   - Reutiliza #upv-historial existente
   ========================================================== */

(function(){

  'use strict';

  const MAX_UPV_HISTORIAL = 10;

  function crearDrawer(){

    if(document.getElementById('upvHistorialDrawer')){
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'upvHistorialOverlay';
    overlay.className = 'upv-historial-overlay';
    overlay.hidden = true;

    const drawer = document.createElement('aside');
    drawer.id = 'upvHistorialDrawer';
    drawer.className = 'upv-historial-drawer';

    drawer.innerHTML = `
      <header class="upv-historial-head">

        <div>
          <span class="upv-historial-head-icon">◷</span>

          <div>
            <strong>HISTORIAL</strong>
            <small>Últimos ${MAX_UPV_HISTORIAL} registros</small>
          </div>
        </div>

        <button
          type="button"
          id="upvHistorialCerrar"
          class="upv-historial-cerrar"
          aria-label="Cerrar historial">
          ×
        </button>

      </header>

      <div class="upv-historial-ayuda">
        Actividad reciente de la unidad
      </div>

      <div
        id="upvHistorialLista"
        class="upv-historial-lista">
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    overlay.addEventListener(
      'click',
      cerrarHistorialUPV
    );

    document
      .getElementById('upvHistorialCerrar')
      .addEventListener(
        'click',
        cerrarHistorialUPV
      );
  }


  function obtenerContenedorOriginal(){

    return document.getElementById(
      'upv-historial'
    );

  }


  async function actualizarOriginal(){

    /*
     * La aplicación UPV YA tiene renderHistorial().
     * Lo reutilizamos en lugar de crear otro sistema.
     */

    if(typeof window.renderHistorial === 'function'){

      try{
        await window.renderHistorial();
      }catch(e){
        console.warn(
          '[UPV historial] renderHistorial:',
          e
        );
      }

    }else if(typeof renderHistorial === 'function'){

      try{
        await renderHistorial();
      }catch(e){
        console.warn(
          '[UPV historial] renderHistorial:',
          e
        );
      }

    }

  }


  async function copiarHistorialAlDrawer(){

    const lista =
      document.getElementById(
        'upvHistorialLista'
      );

    const original =
      obtenerContenedorOriginal();

    if(!lista){
      return;
    }

    await actualizarOriginal();

    if(
      !original ||
      !original.children ||
      original.children.length === 0 ||
      original.querySelector('.hist-empty')
    ){

      lista.innerHTML = `
        <div class="upv-historial-vacio">
          <strong>Sin registros todavía</strong>
          <span>
            Tus operaciones aparecerán aquí.
          </span>
        </div>
      `;

      return;
    }

    lista.innerHTML = '';

    const elementos =
      Array.from(original.children)
      .slice(0, MAX_UPV_HISTORIAL);

    elementos.forEach(function(elemento){

      /*
       * DISEÑO 1
       * Convertimos visualmente la tarjeta original en una
       * tarjeta compacta exclusiva del drawer.
       *
       * NO se modifica IndexedDB ni el registro original.
       */

      const empresaNodo =
        elemento.querySelector('.emp-tag');

      const fechaNodo =
        elemento.querySelector('.hist-item-header span:last-child');

      const tituloNodo =
        elemento.querySelector('.hist-item-title');

      const detalleNodo =
        elemento.querySelector('.hist-item-title + .fs13');

      const syncNodo =
        elemento.querySelector('.hist-item > .mt8.fs13:last-child');


      const empresa =
        empresaNodo
          ? empresaNodo.textContent.trim()
          : '';


      const fecha =
        fechaNodo
          ? fechaNodo.textContent.trim()
          : '';


      const tituloOriginal =
        tituloNodo
          ? tituloNodo.textContent.trim()
          : '';


      const detalleOriginal =
        detalleNodo
          ? detalleNodo.textContent.trim()
          : '';


      const sincronizado =
        syncNodo &&
        /sincronizado/i.test(
          syncNodo.textContent || ''
        );


      let operacion = '';
      let punto = '';
      let volumen = '';

      const etapaRegistro =
        String(
          elemento.dataset.etapa || ''
        )
        .trim()
        .toUpperCase();

      let textoEtapa = '';


      if(/^carga/i.test(tituloOriginal)){

        operacion = 'CARGA';

        const partes =
          tituloOriginal
            .split('·')
            .map(function(x){
              return x.trim();
            });

        /*
         * El último elemento normalmente es el origen:
         * PIA, ECO, pozo, etc.
         */
        if(partes.length >= 2){
          punto = partes[partes.length - 1];
        }

        /*
         * Solo mostrar BBLS cuando realmente existe.
         * Evita "null bbls".
         */
        if(
          detalleOriginal &&
          !/^null\s*bbls$/i.test(detalleOriginal) &&
          !/^undefined\s*bbls$/i.test(detalleOriginal)
        ){
          volumen = detalleOriginal
            .replace(/bbls/i, 'BBLS');
        }

      }else if(/^descarga/i.test(tituloOriginal)){

        operacion = 'DESCARGA';

      }else if(/^obs/i.test(tituloOriginal)){

        operacion = 'OBSERVACIÓN';

        if(detalleOriginal){
          punto = detalleOriginal;
        }

      }else{

        operacion =
          tituloOriginal.toUpperCase();

      }


      const tarjeta =
        document.createElement('article');

      tarjeta.className =
        'upv-historial-card ' +
        (
          operacion === 'DESCARGA'
            ? 'es-descarga'
            : operacion === 'CARGA'
              ? 'es-carga'
              : 'es-otro'
        );


      if(operacion === 'CARGA'){
        if(etapaRegistro === 'INICIO'){
          textoEtapa = 'Inicio de carga';
        }else if(etapaRegistro === 'FINALIZAR'){
          textoEtapa = 'Finalización de carga';
        }
      }

      if(operacion === 'DESCARGA'){
        if(etapaRegistro === 'INICIO'){
          textoEtapa = 'Inicio de descarga';
        }else if(etapaRegistro === 'FINALIZAR'){
          textoEtapa = 'Finalización de descarga';
        }
      }

      const lineaDetalle =
        [punto, volumen]
          .filter(Boolean)
          .join(' · ');


      tarjeta.innerHTML = `
        <div class="upv-historial-card-top">
          <span class="upv-historial-card-empresa"></span>
          <time class="upv-historial-card-hora"></time>
        </div>

        <div class="upv-historial-card-main">
          <span class="upv-historial-card-tipo"></span>

          ${
            textoEtapa
              ? '<span class="upv-historial-card-etapa"></span>'
              : ''
          }

          ${
            lineaDetalle
              ? '<span class="upv-historial-card-detalle"></span>'
              : ''
          }
        </div>

        ${
          sincronizado
            ? '<span class="upv-historial-card-sync" title="Sincronizado">✓</span>'
            : '<span class="upv-historial-card-sync pendiente" title="Pendiente">!</span>'
        }
      `;


      tarjeta
        .querySelector('.upv-historial-card-empresa')
        .textContent = empresa;


      tarjeta
        .querySelector('.upv-historial-card-hora')
        .textContent = fecha;


      tarjeta
        .querySelector('.upv-historial-card-tipo')
        .textContent = operacion;


      const etapaFinal =
        tarjeta.querySelector(
          '.upv-historial-card-etapa'
        );

      if(etapaFinal){
        etapaFinal.textContent =
          textoEtapa;
      }

      const detalleFinal =
        tarjeta.querySelector(
          '.upv-historial-card-detalle'
        );

      if(detalleFinal){
        detalleFinal.textContent =
          lineaDetalle;
      }


      lista.appendChild(tarjeta);

    });

  }


  async function abrirHistorialUPV(){

    crearDrawer();

    const overlay =
      document.getElementById(
        'upvHistorialOverlay'
      );

    const drawer =
      document.getElementById(
        'upvHistorialDrawer'
      );

    if(!overlay || !drawer){
      return;
    }

    await copiarHistorialAlDrawer();

    overlay.hidden = false;

    requestAnimationFrame(function(){

      overlay.classList.add('show');
      drawer.classList.add('show');

    });

    document.body.classList.add(
      'upv-historial-abierto'
    );

  }


  function cerrarHistorialUPV(){

    const overlay =
      document.getElementById(
        'upvHistorialOverlay'
      );

    const drawer =
      document.getElementById(
        'upvHistorialDrawer'
      );

    if(overlay){
      overlay.classList.remove('show');
    }

    if(drawer){
      drawer.classList.remove('show');
    }

    document.body.classList.remove(
      'upv-historial-abierto'
    );

    setTimeout(function(){

      if(overlay){
        overlay.hidden = true;
      }

    },300);

  }


  function localizarBloqueHistorialOriginal(){

    const historial =
      obtenerContenedorOriginal();

    if(!historial){
      return null;
    }

    /*
     * En index.html:
     *
     * <div class="upv-label">Reportes recientes</div>
     * <div id="upv-historial"></div>
     *
     * Ambos están dentro del mismo bloque.
     */
    return historial.parentElement;

  }


  function instalarAcceso(){

    if(
      document.getElementById(
        'upvHistorialAcceso'
      )
    ){
      return;
    }

    const historial =
      obtenerContenedorOriginal();

    if(!historial){
      return;
    }

    const bloque =
      localizarBloqueHistorialOriginal();

    if(!bloque){
      return;
    }

    /*
     * Ocultamos EXCLUSIVAMENTE:
     * 1. etiqueta Reportes recientes
     * 2. listado original
     *
     * NO ocultamos el padre.
     * NO ocultamos screen-upv.
     */
    Array.from(
      bloque.children
    ).forEach(function(elemento){

      if(elemento === historial){
        elemento.style.display = 'none';
        return;
      }

      const texto =
        String(
          elemento.textContent || ''
        )
        .trim()
        .toUpperCase();

      if(texto === 'REPORTES RECIENTES'){
        elemento.style.display = 'none';
      }

    });


    const acceso =
      document.createElement('div');

    acceso.id =
      'upvHistorialAcceso';

    acceso.className =
      'upv-historial-acceso';

    acceso.innerHTML = `
      <button
        type="button"
        id="upvAbrirHistorial"
        class="upv-historial-acceso-btn">

        <span class="upv-historial-acceso-icon">
          ◷
        </span>

        <span class="upv-historial-acceso-texto">
          <strong>Historial</strong>
          <small>
            Consulta tus últimos registros
          </small>
        </span>

        <span class="upv-historial-acceso-limite">
          Últimos 10
        </span>

        <span class="upv-historial-acceso-arrow">
          ›
        </span>

      </button>
    `;

    /*
     * Insertar en el MISMO lugar del historial original.
     */
    bloque.appendChild(acceso);

    document
      .getElementById('upvAbrirHistorial')
      .addEventListener(
        'click',
        abrirHistorialUPV
      );

  }


  function iniciarHistorialSeguro(){

    crearDrawer();

    /*
     * Esperamos a que la aplicación original
     * termine de construir su pantalla.
     */
    let intentos = 0;

    const timer = setInterval(function(){

      intentos++;

      if(
        document.getElementById(
          'upv-historial'
        )
      ){

        clearInterval(timer);
        instalarAcceso();
        return;

      }

      if(intentos >= 30){
        clearInterval(timer);
      }

    },200);

  }


  window.abrirHistorialUPV =
    abrirHistorialUPV;

  window.cerrarHistorialUPV =
    cerrarHistorialUPV;


  if(
    document.readyState === 'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      iniciarHistorialSeguro,
      {once:true}
    );

  }else{

    iniciarHistorialSeguro();

  }

})();

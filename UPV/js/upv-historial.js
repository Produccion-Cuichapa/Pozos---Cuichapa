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
      original.children.length === 0
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

      const copia =
        elemento.cloneNode(true);

      /*
       * Evitar IDs duplicados dentro del drawer.
       */
      copia
        .querySelectorAll('[id]')
        .forEach(function(nodo){
          nodo.removeAttribute('id');
        });

      copia.removeAttribute('id');

      lista.appendChild(copia);

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

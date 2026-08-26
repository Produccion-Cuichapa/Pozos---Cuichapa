(function(){
  'use strict';

  if(window.__UPV_BRANDING_DEFINITIVO_V1__){
    return;
  }

  window.__UPV_BRANDING_DEFINITIVO_V1__ = true;

  function normalizar(valor){
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function buscarTextoExacto(root, texto){
    var objetivo = normalizar(texto);

    return Array.from(
      root.querySelectorAll(
        'h1,h2,h3,h4,p,span,strong,small,div'
      )
    ).find(function(el){
      return normalizar(el.textContent) === objetivo;
    }) || null;
  }

  function horaVeracruz(){
    try{
      return new Intl.DateTimeFormat(
        'es-MX',
        {
          timeZone:'America/Mexico_City',
          hour:'2-digit',
          minute:'2-digit',
          hour12:false
        }
      ).format(new Date());
    }catch(error){
      var ahora = new Date();

      return (
        String(ahora.getHours()).padStart(2,'0') +
        ':' +
        String(ahora.getMinutes()).padStart(2,'0')
      );
    }
  }

  function actualizarReloj(){
    var reloj = document.getElementById(
      'upvBrandClockTime'
    );

    if(reloj){
      reloj.textContent = horaVeracruz();
    }
  }

  function limpiarIntentosAnteriores(portada){
    portada.querySelectorAll(
      '.lifting-brand,' +
      '.lifting-clock,' +
      '.upv-lifting-brand,' +
      '.upv-landing-clock,' +
      '.upv-recuperacion-subtitle,' +
      '.upv-branding-definitivo'
    ).forEach(function(el){
      el.remove();
    });
  }

  function crearBranding(portada, tituloOriginal){
    limpiarIntentosAnteriores(portada);

    /*
     * El título original se conserva para no afectar
     * la estructura de la aplicación, pero se oculta
     * visualmente.
     */
    tituloOriginal.classList.add(
      'upv-original-title-hidden'
    );

    var bloque = document.createElement('section');

    bloque.className =
      'upv-branding-definitivo';

    bloque.innerHTML = `
      <div class="upv-brand-logo-card">
        <img
          src="./assets/lifting-logo.svg"
          alt="Lifting"
          class="upv-brand-logo">
      </div>

      <div class="upv-brand-upv-line">
        <span></span>
        <h1>UPV</h1>
        <span></span>
      </div>

      <p class="upv-brand-main-subtitle">
        Recuperación de Volumen
      </p>

      <p class="upv-brand-location">
        Campo Cuichapa U-39
      </p>
    `;

    tituloOriginal.insertAdjacentElement(
      'beforebegin',
      bloque
    );

    var reloj = document.createElement('aside');

    reloj.className = 'upv-clock-definitivo';

    reloj.innerHTML = `
      <strong id="upvBrandClockTime">00:00</strong>
      <span>VERACRUZ · MX</span>
    `;

    portada.prepend(reloj);

    actualizarReloj();

    /*
     * Ocultar los textos originales que ya fueron
     * sustituidos por el nuevo encabezado.
     */
    [
      'Unidades de Producción y Volumen',
      'Unidades de Produccion y Volumen',
      'Recuperación de Volumen',
      'Recuperacion de Volumen',
      'Campo Cuichapa U-39'
    ].forEach(function(texto){
      var elemento = buscarTextoExacto(
        portada,
        texto
      );

      if(
        elemento &&
        !bloque.contains(elemento)
      ){
        elemento.classList.add(
          'upv-brand-old-text-hidden'
        );
      }
    });
  }

  function preparar(){
    var portada = document.querySelector(
      '.upv-portada-final-activa, ' +
      '.upv-landing-renovada'
    );

    var titulo = document.querySelector(
      '.upv-titulo-principal'
    );

    if(!portada || !titulo){
      return false;
    }

    document.body.classList.add(
      'upv-branding-definitivo-listo'
    );

    portada.classList.add(
      'upv-branding-mobile-first'
    );

    crearBranding(
      portada,
      titulo
    );

    return true;
  }

  function iniciar(){
    if(preparar()){
      return;
    }

    var intentos = 0;

    var timer = setInterval(function(){
      intentos += 1;

      if(
        preparar() ||
        intentos >= 40
      ){
        clearInterval(timer);
      }
    },200);
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

  setInterval(
    actualizarReloj,
    15000
  );
})();

(function instalarPortadaFinalUPV(){
  'use strict';

  if(window.__upvPortadaFinalInstalada){
    return;
  }

  window.__upvPortadaFinalInstalada = true;

  function crearElemento(tag, clase, texto){
    var elemento = document.createElement(tag);

    if(clase){
      elemento.className = clase;
    }

    if(texto !== undefined){
      elemento.textContent = texto;
    }

    return elemento;
  }

  function prepararTarjeta(selector, nombre){
    var tarjeta = document.querySelector(selector);

    if(!tarjeta){
      return false;
    }

    tarjeta.setAttribute(
      'data-empresa-nombre',
      nombre
    );

    if(!tarjeta.querySelector('.upv-card-top-label')){
      var etiqueta = crearElemento(
        'span',
        'upv-card-top-label'
      );

      var punto = crearElemento(
        'i',
        'upv-card-top-dot'
      );

      var nombreSuperior = crearElemento(
        'strong',
        'upv-card-top-name',
        nombre
      );

      etiqueta.appendChild(punto);
      etiqueta.appendChild(nombreSuperior);

      tarjeta.insertBefore(
        etiqueta,
        tarjeta.firstChild
      );
    }

    if(!tarjeta.querySelector('.upv-card-final-arrow')){
      var flecha = crearElemento(
        'span',
        'upv-card-final-arrow',
        '›'
      );

      flecha.setAttribute(
        'aria-hidden',
        'true'
      );

      tarjeta.appendChild(flecha);
    }

    return true;
  }

  function agregarFondoIndustrial(pantalla){
    if(
      pantalla.querySelector(
        '.upv-industrial-final'
      )
    ){
      return;
    }

    var escena = crearElemento(
      'div',
      'upv-industrial-final'
    );

    escena.setAttribute(
      'aria-hidden',
      'true'
    );

    escena.innerHTML = `
      <span class="upv-industrial-tank tank-a"></span>
      <span class="upv-industrial-tank tank-b"></span>
      <span class="upv-industrial-tower tower-a"></span>
      <span class="upv-industrial-tower tower-b"></span>
      <span class="upv-industrial-pipe pipe-a"></span>
      <span class="upv-industrial-pipe pipe-b"></span>
      <span class="upv-industrial-light light-a"></span>
      <span class="upv-industrial-light light-b"></span>
    `;

    pantalla.appendChild(escena);
  }

  function agregarBeneficios(pantalla){
    var anterior = pantalla.querySelector(
      '.upv-beneficios-final'
    );

    if(anterior){
      return;
    }

    var beneficios = crearElemento(
      'section',
      'upv-beneficios-final'
    );

    beneficios.setAttribute(
      'aria-label',
      'Características de la aplicación'
    );

    var datos = [
      {
        icono:'✓',
        titulo:'Información segura',
        detalle:'Tus datos protegidos'
      },
      {
        icono:'☁',
        titulo:'Sincronización offline',
        detalle:'Trabaja sin conexión'
      },
      {
        icono:'◷',
        titulo:'Datos en tiempo real',
        detalle:'Reportes al instante'
      }
    ];

    datos.forEach(function(dato){
      var item = crearElemento(
        'div',
        'upv-beneficio-final'
      );

      var icono = crearElemento(
        'span',
        'upv-beneficio-icono',
        dato.icono
      );

      var contenido = crearElemento(
        'span',
        'upv-beneficio-contenido'
      );

      contenido.innerHTML =
        '<strong>' + dato.titulo + '</strong>' +
        '<small>' + dato.detalle + '</small>';

      item.appendChild(icono);
      item.appendChild(contenido);
      beneficios.appendChild(item);
    });

    pantalla.appendChild(beneficios);
  }

  function agregarPie(pantalla){
    if(
      pantalla.querySelector(
        '.upv-footer-final'
      )
    ){
      return;
    }

    var pie = crearElemento(
      'footer',
      'upv-footer-final'
    );

    pie.innerHTML =
      '<strong>UPV · Campo Cuichapa U-39</strong>' +
      '<span>Plataforma oficial de registro y control</span>';

    pantalla.appendChild(pie);
  }

  function preparar(){
    var pantalla = document.querySelector(
      '.upv-landing-renovada'
    );

    if(!pantalla){
      return false;
    }

    var petrosmart = prepararTarjeta(
      '.upv-company-choice-petrosmart',
      'PETROSMART'
    );

    var ipep = prepararTarjeta(
      '.upv-company-choice-ipep',
      'IPEP'
    );

    if(!petrosmart || !ipep){
      return false;
    }

    pantalla.classList.add(
      'upv-portada-final-activa'
    );

    agregarFondoIndustrial(pantalla);
    agregarBeneficios(pantalla);
    agregarPie(pantalla);

    document.body.classList.add(
      'upv-final-listo'
    );

    console.log(
      '[UPV] Portada final instalada correctamente'
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

      if(preparar() || intentos >= 30){
        clearInterval(timer);
      }
    },250);
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
})();


/* ==========================================================
   UPV — CAMBIO ENTRE PORTADA Y FORMULARIO
   Oculta la portada después de seleccionar empresa.
   ========================================================== */
(function instalarCambioVistaEmpresa(){
  'use strict';

  if(window.__upvCambioVistaEmpresa){
    return;
  }

  window.__upvCambioVistaEmpresa = true;

  function normalizar(valor){
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function portada(){
    return document.querySelector(
      '.upv-portada-final-activa, ' +
      '.upv-landing-renovada'
    );
  }

  function tarjetasEmpresa(){
    return document.querySelectorAll(
      '.upv-company-choice-petrosmart, ' +
      '.upv-company-choice-ipep'
    );
  }

  function encontrarFormularioVisible(){
    const elementos = Array.from(
      document.body.children
    );

    return elementos.find(elemento => {
      if(
        elemento.matches(
          'script, style, link, ' +
          '.upv-landing-renovada, ' +
          '.upv-portada-final-activa'
        )
      ){
        return false;
      }

      const estilo = getComputedStyle(elemento);

      if(
        estilo.display === 'none' ||
        estilo.visibility === 'hidden'
      ){
        return false;
      }

      const texto = normalizar(
        elemento.textContent
      );

      return (
        texto.includes('EMPRESA ACTIVA') ||
        texto.includes('UNIDAD (NUMERO DE PIPA)') ||
        texto.includes('UNIDAD (NÚMERO DE PIPA)') ||
        texto.includes('QUE HARAS') ||
        texto.includes('QUÉ HARÁS')
      );
    }) || null;
  }

  function activarFormulario(){
    document.body.classList.add(
      'upv-formulario-activo'
    );

    document.documentElement.classList.add(
      'upv-formulario-activo'
    );

    const landing = portada();

    if(landing){
      landing.setAttribute(
        'aria-hidden',
        'true'
      );
    }

    /*
     * Esperar a que la lógica original de UPV
     * muestre el formulario de la empresa.
     */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const formulario =
          encontrarFormularioVisible();

        if(formulario){
          formulario.classList.add(
            'upv-contenido-operativo'
          );
        }

        try{
          window.scrollTo({
            top:0,
            left:0,
            behavior:'instant'
          });
        }catch(error){
          window.scrollTo(0,0);
        }
      });
    });
  }

  function mostrarPortada(){
    document.body.classList.remove(
      'upv-formulario-activo'
    );

    document.documentElement.classList.remove(
      'upv-formulario-activo'
    );

    document.querySelectorAll(
      '.upv-contenido-operativo'
    ).forEach(elemento => {
      elemento.classList.remove(
        'upv-contenido-operativo'
      );
    });

    const landing = portada();

    if(landing){
      landing.removeAttribute(
        'aria-hidden'
      );
    }

    try{
      window.scrollTo({
        top:0,
        left:0,
        behavior:'instant'
      });
    }catch(error){
      window.scrollTo(0,0);
    }
  }

  function esBotonRegresar(elemento){
    const boton = elemento.closest(
      'button, a, [role="button"], ' +
      '[onclick], [data-action], [data-accion]'
    );

    if(!boton){
      return false;
    }

    const textoCrudo = String(
      boton.textContent ||
      boton.getAttribute('aria-label') ||
      boton.getAttribute('title') ||
      ''
    ).trim();

    const texto = normalizar(textoCrudo);

    const accion = normalizar([
      boton.dataset?.action,
      boton.dataset?.accion,
      boton.id,
      boton.className,
      boton.getAttribute('onclick')
    ].filter(Boolean).join(' '));

    /*
     * La flecha original de UPV usa el símbolo ↩
     * y en algunos dispositivos puede mostrarse como
     * ↶, ←, ⬅ o una variante Unicode.
     */
    const esFlechaVisual =
      /[↩↶←⬅⟵]/.test(textoCrudo);

    return (
      esFlechaVisual ||
      texto === 'VOLVER' ||
      texto === 'ATRAS' ||
      texto === 'REGRESAR' ||
      texto.includes('CAMBIAR EMPRESA') ||
      texto.includes('SELECCIONAR EMPRESA') ||
      accion.includes('BACK') ||
      accion.includes('VOLVER') ||
      accion.includes('REGRESAR') ||
      accion.includes('CAMBIAR') ||
      accion.includes('EMPRESA')
    );
  }

  function enlazarTarjetas(){
    tarjetasEmpresa().forEach(tarjeta => {
      if(tarjeta.dataset.upvVistaEnlazada === '1'){
        return;
      }

      tarjeta.dataset.upvVistaEnlazada = '1';

      /*
       * Se ejecuta después del evento original,
       * sin reemplazarlo.
       */
      tarjeta.addEventListener(
        'click',
        function(){
          setTimeout(
            activarFormulario,
            40
          );
        }
      );
    });
  }

  document.addEventListener(
    'click',
    function(evento){
      if(
        document.body.classList.contains(
          'upv-formulario-activo'
        ) &&
        esBotonRegresar(evento.target)
      ){
        setTimeout(
          mostrarPortada,
          30
        );
      }
    }
  );

  /*
   * El MutationObserver cubre los casos en que las tarjetas
   * se generan nuevamente al restaurar una sesión.
   */
  const observer = new MutationObserver(
    enlazarTarjetas
  );

  function iniciar(){
    enlazarTarjetas();

    if(document.body){
      observer.observe(
        document.body,
        {
          childList:true,
          subtree:true
        }
      );
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

  window.UPVMostrarPortadaEmpresa =
    mostrarPortada;
})();


/* ==========================================================
   REFUERZO DE LA FLECHA ORIGINAL DE REGRESO
   ========================================================== */
(function reforzarFlechaVolverUPV(){
  'use strict';

  if(window.__upvFlechaVolverReforzada){
    return;
  }

  window.__upvFlechaVolverReforzada = true;

  function esFlechaRegreso(elemento){
    const boton = elemento.closest(
      'button, a, [role="button"], [onclick]'
    );

    if(!boton){
      return false;
    }

    const texto = String(
      boton.textContent ||
      boton.getAttribute('aria-label') ||
      boton.getAttribute('title') ||
      ''
    ).trim();

    const atributos = [
      boton.id,
      boton.className,
      boton.getAttribute('onclick'),
      boton.dataset?.action,
      boton.dataset?.accion
    ].filter(Boolean).join(' ').toLowerCase();

    return (
      /[↩↶←⬅⟵]/.test(texto) ||
      /\b(volver|regresar|atras|back)\b/i.test(texto) ||
      /volver|regresar|back|empresa/.test(atributos)
    );
  }

  document.addEventListener(
    'click',
    function(evento){
      if(
        !document.body.classList.contains(
          'upv-formulario-activo'
        )
      ){
        return;
      }

      if(!esFlechaRegreso(evento.target)){
        return;
      }

      /*
       * No detener el evento original.
       * UPV primero limpia la empresa activa y después
       * restauramos visualmente la portada.
       */
      setTimeout(function(){
        if(
          typeof window.UPVMostrarPortadaEmpresa ===
          'function'
        ){
          window.UPVMostrarPortadaEmpresa();
        }else{
          document.body.classList.remove(
            'upv-formulario-activo'
          );

          document.documentElement.classList.remove(
            'upv-formulario-activo'
          );

          const landing = document.querySelector(
            '.upv-portada-final-activa, ' +
            '.upv-landing-renovada'
          );

          landing?.removeAttribute('aria-hidden');

          window.scrollTo(0,0);
        }
      },80);
    },
    true
  );
})();

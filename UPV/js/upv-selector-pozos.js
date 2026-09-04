(function(){
  'use strict';

  if(window.__UPV_SELECTOR_POZOS_V2__){
    return;
  }

  window.__UPV_SELECTOR_POZOS_V2__ = true;

  const POZOS = [
    '19',
    '106D',
    '107',
    '119',
    '124D',
    '128',
    '131',
    '137',
    '138',
    '139',
    '167',
    '169',
    '172',
    '176',
    '179',
    '180',
    '187',
    '191',
    '201',
    '207',
    '213',
    '306',
    '324',
    '326',
    '327',
    '328',
    '331',
    '342',
    '343',
    '346',
    '350',
    '352',
    '356',
    '359',
    '363',
    '364',
    '367',
    '373',
    '376',
    '377',
    '385',
    '401',
    '500',
    '502',
    '504',
    '505',
    '507',
    '513',
    '601',
    '602',
    '603'
  ];

  function limpiar(valor){
    return String(valor || '')
      .trim()
      .toUpperCase();
  }

  function buscarSelectOrigen(){
    const selects = Array.from(
      document.querySelectorAll('select')
    );

    return selects.find(select => {
      const opciones = Array.from(
        select.options || []
      ).map(option =>
        limpiar(
          option.value ||
          option.textContent
        )
      );

      return (
        opciones.includes('POZO') &&
        opciones.includes('ECO') &&
        opciones.includes('PIA')
      );
    }) || null;
  }

  function obtenerOrigen(select){
    if(!select){
      return '';
    }

    const option =
      select.options?.[
        select.selectedIndex
      ];

    return limpiar(
      select.value ||
      option?.value ||
      option?.textContent
    );
  }

  function crearSelector(selectOrigen){
    let wrap = document.getElementById(
      'upvPozoSelectorWrap'
    );

    if(wrap){
      return wrap;
    }

    wrap = document.createElement('div');

    wrap.id = 'upvPozoSelectorWrap';
    wrap.className = 'upv-pozo-selector-wrap';
    wrap.hidden = true;

    const label = document.createElement(
      'label'
    );

    label.className =
      'upv-pozo-selector-label';

    label.setAttribute(
      'for',
      'upvPozoSelect'
    );

    label.textContent = 'SELECCIONAR POZO';

    const select =
      document.createElement('select');

    select.id = 'upvPozoSelect';
    select.name = 'pozo';
    select.className =
      'upv-pozo-selector';

    const inicial =
      document.createElement('option');

    inicial.value = '';
    inicial.textContent =
      'Seleccionar pozo...';

    select.appendChild(inicial);

    POZOS.forEach(pozo => {
      const option =
        document.createElement('option');

      option.value = pozo;
      option.textContent =
        'CUICHAPA ' + pozo;

      select.appendChild(option);
    });

    wrap.appendChild(label);
    wrap.appendChild(select);

    /*
     * Insertarlo justo debajo del bloque
     * que contiene el select de origen.
     */
    let bloque =
      selectOrigen.closest(
        '.form-section,' +
        '.form-group,' +
        '.field-group,' +
        '.field,' +
        '.section,' +
        '.card,' +
        '.panel'
      );

    if(!bloque){
      bloque = selectOrigen.parentElement;
    }

    if(bloque){
      bloque.insertAdjacentElement(
        'afterend',
        wrap
      );
    }else{
      selectOrigen.insertAdjacentElement(
        'afterend',
        wrap
      );
    }

    console.log(
      '[UPV POZOS] Selector creado con',
      POZOS.length,
      'pozos'
    );

    return wrap;
  }

  function mostrarSelector(){
    const origen = buscarSelectOrigen();

    if(!origen){
      console.warn(
        '[UPV POZOS] No encontré el selector de origen'
      );
      return false;
    }

    const wrap = crearSelector(origen);

    const valor = obtenerOrigen(origen);

    const mostrar = valor === 'POZO';

    wrap.hidden = !mostrar;

    wrap.style.display =
      mostrar
        ? 'block'
        : 'none';

    wrap.classList.toggle(
      'is-visible',
      mostrar
    );

    console.log(
      '[UPV POZOS] Origen:',
      valor,
      '| mostrar:',
      mostrar
    );

    if(!mostrar){
      const pozo =
        document.getElementById(
          'upvPozoSelect'
        );

      if(pozo){
        pozo.value = '';
      }
    }

    return true;
  }

  /*
   * Delegación global:
   * funciona aunque el formulario se regenere.
   */
  document.addEventListener(
    'change',
    function(event){
      const target = event.target;

      if(!(target instanceof HTMLSelectElement)){
        return;
      }

      const opciones = Array.from(
        target.options || []
      ).map(option =>
        limpiar(
          option.value ||
          option.textContent
        )
      );

      if(
        opciones.includes('POZO') &&
        opciones.includes('ECO') &&
        opciones.includes('PIA')
      ){
        setTimeout(
          mostrarSelector,
          0
        );
      }
    },
    true
  );

  /*
   * Cuando pulse DESCARGA ocultamos el selector.
   * Si vuelve a CARGA, revisamos otra vez el origen.
   */
  document.addEventListener(
    'click',
    function(event){
      const boton = event.target.closest(
        'button, [role="button"], label'
      );

      if(!boton){
        return;
      }

      const texto = limpiar(
        boton.textContent
      );

      if(texto.includes('DESCARGA')){
        const wrap =
          document.getElementById(
            'upvPozoSelectorWrap'
          );

        if(wrap){
          wrap.hidden = true;
          wrap.style.display = 'none';
          wrap.classList.remove(
            'is-visible'
          );
        }

        document.body.dataset.upvOperacion =
          'descarga';

        return;
      }

      if(texto.includes('CARGA')){
        document.body.dataset.upvOperacion =
          'carga';

        setTimeout(
          mostrarSelector,
          80
        );
      }
    },
    true
  );

  function iniciar(){
    const origen = buscarSelectOrigen();

    if(origen){
      crearSelector(origen);
      mostrarSelector();
      return true;
    }

    return false;
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

  /*
   * Observación continua del DOM eliminada.
   * El selector ahora trabaja únicamente con eventos
   * normales de CARGA/DESCARGA y cambio de origen.
   */

else{
    document.addEventListener(
      'DOMContentLoaded',
      activarObserver,
      {once:true}
    );
  }

  window.UPV_POZOS = POZOS.slice();

  window.UPVActualizarSelectorPozo =
    mostrarSelector;

})();

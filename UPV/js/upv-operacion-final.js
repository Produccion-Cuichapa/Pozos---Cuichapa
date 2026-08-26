(function(){
'use strict';

if(window.__UPV_OPERACION_FINAL_V1__) return;
window.__UPV_OPERACION_FINAL_V1__ = true;

const POZOS = [
  '19',
  '106D',
  '107',
  '137',
  '138',
  '139',
  '169',
  '172',
  '176',
  '179',
  '180',
  '201',
  '207',
  '376',
  '377',
  '385',
  '401',
  '601',
  '602',
  '603'
];

const MEM = {
  carga: 'upv_final_inicio_carga',
  descarga: 'upv_final_inicio_descarga'
};

function txt(v){
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .toUpperCase();
}

function horaActual(){
  const d = new Date();

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
    ).format(d);
  }catch(e){
    hora = d.toLocaleTimeString('es-MX');
  }

  return {
    timestamp:Date.now(),
    iso:d.toISOString(),
    fecha:new Intl.DateTimeFormat(
      'es-MX',
      {
        day:'2-digit',
        month:'2-digit',
        year:'numeric'
      }
    ).format(d),
    hora
  };
}


/* ========================================================
   CARGAS DISPONIBLES PENDIENTES DE DESCARGA
   Seguimiento por unidad
   ======================================================== */

const UPV_KEY_POZOS_CARGADOS =
  'upv_pozos_cargados_pendientes_v1';

function leerPozosCargadosPendientes(){

  try{

    const raw =
      localStorage.getItem(
        UPV_KEY_POZOS_CARGADOS
      );

    const data =
      raw ? JSON.parse(raw) : {};

    return (
      data &&
      typeof data === 'object'
    )
      ? data
      : {};

  }catch(e){

    console.warn(
      '[UPV] No se pudieron leer pozos cargados',
      e
    );

    return {};
  }
}


function guardarPozosCargadosPendientes(data){

  try{

    localStorage.setItem(
      UPV_KEY_POZOS_CARGADOS,
      JSON.stringify(data || {})
    );

  }catch(e){

    console.warn(
      '[UPV] No se pudieron guardar pozos cargados',
      e
    );
  }
}


function claveUnidadPozosCargados(){

  const empresa =
    String(
      empresaActiva() || ''
    )
    .trim()
    .toUpperCase();

  const numero =
    String(
      unidad() || ''
    )
    .trim()
    .toUpperCase();

  return empresa + '::' + numero;
}


function registrarPozoCargadoPendiente(data){

  if(!data) return;

  const pozo =
    String(
      data.pozo || ''
    )
    .trim();

  /*
   * Solo registramos cargas realizadas
   * físicamente en POZO.
   */
  if(!pozo) return;

  const key =
    claveUnidadPozosCargados();

  if(!key || key.endsWith('::')){
    return;
  }

  const todos =
    leerPozosCargadosPendientes();

  const lista =
    Array.isArray(todos[key])
      ? todos[key]
      : [];

  /*
   * Cada término de carga representa
   * una carga disponible para descargar.
   */
  lista.push({
    id:
      'carga_' +
      Date.now() +
      '_' +
      Math.random()
        .toString(36)
        .slice(2,8),

    pozo:pozo,

    fecha:
      data.fecha || '',

    hora:
      data.hora || '',

    timestamp:
      data.timestamp || Date.now(),

    volumenM3:
      Number(data.volumenM3 || 0),

    /*
     * DESTINO HEREDADO DESDE FINALIZÓ CARGA.
     *
     * Es indispensable conservar estos campos porque
     * INICIO DESCARGA toma automáticamente de aquí
     * el lugar donde se realizará la descarga.
     */
    destino:
      String(
        data.destino || ''
      )
      .trim()
      .toUpperCase(),

    destinoNombre:
      String(
        data.destinoNombre ||
        data.destino ||
        ''
      )
      .trim(),

    destinoPozo:
      String(
        data.destinoPozo || ''
      )
      .trim(),

    /*
     * Conservamos también la información del origen
     * para no perder compatibilidad con cargas hechas
     * desde POZO / ECO / PIA / BSC / BASE.
     */
    origen:
      String(
        data.origen || ''
      )
      .trim()
      .toUpperCase(),

    esPozo:
      data.esPozo === true,

    seleccionado:true
  });

  todos[key] = lista;

  guardarPozosCargadosPendientes(
    todos
  );
}


function obtenerPozosCargadosPendientes(){

  const key =
    claveUnidadPozosCargados();

  const todos =
    leerPozosCargadosPendientes();

  return Array.isArray(todos[key])
    ? todos[key]
    : [];
}


function quitarPozosDescargados(ids){

  if(!Array.isArray(ids) || !ids.length){
    return;
  }

  const key =
    claveUnidadPozosCargados();

  const todos =
    leerPozosCargadosPendientes();

  const lista =
    Array.isArray(todos[key])
      ? todos[key]
      : [];

  todos[key] =
    lista.filter(
      item => !ids.includes(item.id)
    );

  guardarPozosCargadosPendientes(
    todos
  );
}


function escaparAtributoUPV(valor){

  return String(valor ?? '')
    .replace(/&/g,'&amp;')
    .replace(/"/g,'&quot;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}


function htmlPozosParaDescarga(){

  const listaOriginal =
    obtenerPozosCargadosPendientes();

  /*
   * ORDEN OPERATIVO:
   * 1. Destino POZO
   * 2. Instalaciones: ECO / PIA / BSC / BASE / etc.
   *
   * Registros antiguos sin destino se conservan al final.
   */
  const lista =
    [...listaOriginal].sort(function(a,b){

      const aPozo =
        String(a.destino || '').toUpperCase() === 'POZO';

      const bPozo =
        String(b.destino || '').toUpperCase() === 'POZO';

      if(aPozo && !bPozo) return -1;
      if(!aPozo && bPozo) return 1;

      return 0;
    });

  if(!lista.length){

    return `
      <div class="upv-manifiesto-vacio">

        <span class="upv-manifiesto-vacio-icon">
          ℹ️
        </span>

        <div>
          <strong>
            SIN CARGAS PENDIENTES
          </strong>

          <small>
            Esta unidad no tiene pozos cargados
            pendientes de descarga.
          </small>
        </div>

      </div>
    `;
  }


  return `
    <section class="upv-manifiesto-descarga">

      <header class="upv-manifiesto-head">

        <div class="upv-manifiesto-head-icon">
          📋
        </div>

        <div>
          <strong>
            CARGA DISPONIBLE
          </strong>

          <small>
            Selecciona el origen del producto
          </small>
        </div>

      </header>


      <div class="upv-manifiesto-lista">

        ${lista.map(function(item){

          const volumen =
            Number(item.volumenM3 || 0);

          return `
            <button
              type="button"
              class="upv-manifiesto-pozo seleccionado"
              data-carga-id="${escaparAtributoUPV(item.id)}"
              data-volumen="${volumen}"
              data-pozo="${escaparAtributoUPV(item.pozo)}"
              data-incluir="SI">

              <span class="upv-manifiesto-check">
                ✓
              </span>

              <span class="upv-manifiesto-info">

                <strong>
                  ${escaparHtml(
                    nombreOrigenCargaUPV(item)
                  )}
                </strong>

                <small class="upv-manifiesto-volumen">
                  💧 ${volumen.toFixed(2)} m³
                </small>

                ${
                  item.destino
                    ? `
                      <small class="upv-manifiesto-destino">
                        📍 VA A:
                        <strong>
                          ${
                            String(item.destino).toUpperCase() === 'POZO'
                              ? escaparHtml(
                                  formatoPozoUPV(
                                    item.destinoPozo ||
                                    item.destinoNombre ||
                                    ''
                                  )
                                )
                              : escaparHtml(
                                  item.destinoNombre ||
                                  item.destino
                                )
                          }
                        </strong>
                      </small>
                    `
                    : `
                      <small class="upv-manifiesto-destino pendiente">
                        📍 Destino de registro anterior
                      </small>
                    `
                }

                ${
                  item.fecha || item.hora
                    ? `
                      <small>
                        🗓 Cargado
                        ${escaparHtml(item.fecha || '')}
                        ${escaparHtml(item.hora || '')}
                      </small>
                    `
                    : ''
                }

              </span>

              <span class="upv-manifiesto-arrow">
                ›
              </span>

            </button>
          `;

        }).join('')}

      </div>


      <div class="upv-manifiesto-resumen">

        <div>

          <span>
            ✓ Seleccionados
          </span>

          <strong id="upvDescargaSeleccionados">
            0
          </strong>

        </div>


        <div>

          <span>
            💧 Volumen asociado
          </span>

          <strong id="upvDescargaVolumen">
            0.00 m³
          </strong>

        </div>

      </div>

    </section>
  `;
}


function activarSelectorPozosDescarga(){

  document
    .querySelectorAll(
      '.upv-manifiesto-pozo'
    )
    .forEach(function(item){

      item.addEventListener(
        'click',
        function(){

          const seleccionado =
            item.dataset.incluir !== 'NO';


          if(seleccionado){

            item.dataset.incluir = 'NO';

            item.classList.remove(
              'seleccionado'
            );

            const check =
              item.querySelector(
                '.upv-manifiesto-check'
              );

            if(check){
              check.textContent = '';
            }

          }else{

            item.dataset.incluir = 'SI';

            item.classList.add(
              'seleccionado'
            );

            const check =
              item.querySelector(
                '.upv-manifiesto-check'
              );

            if(check){
              check.textContent = '✓';
            }

          }


          actualizarResumenPozosDescarga();

        }
      );

    });


  actualizarResumenPozosDescarga();

}


function leerSeleccionPozosDescarga(){

  return Array.from(
    document.querySelectorAll(
      '.upv-manifiesto-pozo'
    )
  )
  .filter(
    item =>
      item.dataset.incluir !== 'NO'
  )
  .map(
    item => item.dataset.cargaId
  )
  .filter(Boolean);
}



function volumenSeleccionadoDescarga(){

  return datosSeleccionPozosDescarga()
    .reduce(
      function(total,item){

        return (
          total +
          Number(item.volumenM3 || 0)
        );

      },
      0
    );
}


function actualizarResumenPozosDescarga(){

  const seleccionados =
    datosSeleccionPozosDescarga();

  const total =
    seleccionados.reduce(
      function(suma,item){

        return (
          suma +
          Number(item.volumenM3 || 0)
        );

      },
      0
    );


  const contador =
    document.getElementById(
      'upvDescargaSeleccionados'
    );

  const volumen =
    document.getElementById(
      'upvDescargaVolumen'
    );


  if(contador){

    contador.textContent =
      seleccionados.length +
      ' de ' +
      obtenerPozosCargadosPendientes().length;

  }


  if(volumen){

    volumen.textContent =
      total.toFixed(2) +
      ' m³';

  }

}



function nombreOrigenCargaUPV(item){

  item =
    item || {};


  const origen =
    String(
      item.origen || ''
    )
    .trim()
    .toUpperCase();


  const referencia =
    String(
      item.pozo || ''
    ).trim();


  /*
   * Cuando el origen real es una instalación,
   * mostrar directamente ECO / PIA / BASE...
   */
  if(
    origen &&
    origen !== 'POZO'
  ){
    return origen;
  }


  /*
   * Registros nuevos de pozo.
   */
  if(
    origen === 'POZO' &&
    referencia
  ){
    return formatoPozoUPV(
      referencia
    );
  }


  /*
   * Compatibilidad con registros antiguos,
   * que solamente guardaban `pozo`.
   */
  if(referencia){

    const refUpper =
      referencia.toUpperCase();


    if(
      refUpper === 'ECO' ||
      refUpper === 'PIA' ||
      refUpper === 'BASE' ||
      refUpper === 'BSC'
    ){
      return refUpper;
    }


    return formatoPozoUPV(
      referencia
    );

  }


  return '';

}


function nombrePozosDescarga(lista){

  const nombres =
    (lista || [])
      .map(function(item){

        return nombreOrigenCargaUPV(
          item
        );

      });


  if(!nombres.length){
    return '';
  }


  if(nombres.length === 1){
    return nombres[0];
  }


  if(nombres.length === 2){

    return (
      nombres[0] +
      ' y ' +
      nombres[1]
    );

  }


  return (
    nombres
      .slice(0,-1)
      .join(', ') +
    ' y ' +
    nombres[nombres.length - 1]
  );
}


function resumenInicioDescargaHTML(
  origen,
  cargas,
  volumen,
  gps
){

  const empresa =
    String(
      empresaActiva() || ''
    ).trim();


  const unidadActual =
    String(
      unidad() || ''
    ).trim();


  const pozos =
    nombrePozosDescarga(
      cargas
    );


  /*
   * GPS:
   * soportamos distintas estructuras que
   * pueda devolver validarGPSOperacionUPV().
   */
  const distancia =
    Number(
      gps?.distancia ??
      gps?.distance ??
      gps?.distanciaMetros ??
      gps?.metros ??
      NaN
    );


  const dentro =
    (
      gps?.dentroRango === true ||
      gps?.dentro === true ||
      gps?.ok === true ||
      gps?.valido === true ||
      gps?.status === 'ok' ||
      gps?.status === 'dentro'
    );


  const fuera =
    (
      gps?.dentroRango === false ||
      gps?.dentro === false ||
      gps?.ok === false ||
      gps?.valido === false ||
      gps?.status === 'fuera'
    );


  let gpsTexto =
    'GPS disponible';


  let gpsClase =
    'neutral';


  let gpsIcono =
    '📍';


  if(dentro){

    gpsTexto =
      'Dentro de rango';

    gpsClase =
      'ok';

    gpsIcono =
      '✅';

  }

  else if(fuera){

    gpsTexto =
      'Fuera de rango';

    gpsClase =
      'bad';

    gpsIcono =
      '❌';

  }

  else if(!gps){

    gpsTexto =
      'GPS no disponible';

    gpsClase =
      'bad';

    gpsIcono =
      '⚠️';

  }


  const distanciaHTML =
    Number.isFinite(distancia)
      ? `
        <small>
          Distancia:
          ${Math.round(distancia)} m
        </small>
      `
      : '';


  return `
    <div class="upv-descarga-preview-pro">

      <!-- POZOS PRIORIDAD -->
      <div class="upv-descarga-preview-pozos">

        <span class="upv-descarga-preview-pozos-icon">
          🛢
        </span>

        <div>

          <small>
            PRODUCTO DE
          </small>

          <strong>
            ${escaparHtml(pozos)}
          </strong>

        </div>

      </div>


      <!-- PROVEEDOR / UNIDAD -->
      <div class="upv-descarga-preview-grid">

        <div class="upv-descarga-preview-dato">

          <span>
            🚛 PROVEEDOR
          </span>

          <strong>
            ${escaparHtml(empresa)}
          </strong>

        </div>


        <div class="upv-descarga-preview-dato">

          <span>
            🚚 UNIDAD
          </span>

          <strong>
            ${escaparHtml(unidadActual)}
          </strong>

        </div>

      </div>


      <!-- OPERACIÓN -->
      <div class="upv-descarga-preview-operacion">

        <span>
          ▶️
        </span>

        <div>

          <small>
            INICIO DE DESCARGA
          </small>

          <strong>
            ${escaparHtml(origen)}
          </strong>

        </div>

      </div>


      <!-- VOLUMEN -->
      <div class="upv-descarga-preview-volumen">

        <span>
          💧 VOLUMEN ASOCIADO
        </span>

        <strong>
          ${Number(volumen || 0).toFixed(2)}
          m³
        </strong>

      </div>


      <!-- GPS -->
      <div
        class="upv-descarga-preview-gps ${gpsClase}">

        <div class="upv-descarga-preview-gps-icon">
          ${gpsIcono}
        </div>

        <div>

          <small>
            GPS
          </small>

          <strong>
            ${escaparHtml(gpsTexto)}
          </strong>

          ${distanciaHTML}

        </div>

      </div>

    </div>
  `;
}


function mensajeInicioDescargaSeleccionada(config){

  const cargas =
    Array.isArray(config.cargas)
      ? config.cargas
      : [];


  const volumen =
    Number(
      config.volumen || 0
    );


  const lugar =
    config.origen === 'POZO'
      ? formatoPozoUPV(config.pozo)
      : String(config.origen || '');


  const gps =
    config.gps || null;


  /* ======================================================
     POZOS
     ====================================================== */

  const nombresPozos =
    cargas
      .map(function(item){

        return formatoPozoUPV(
          item.pozo
        );

      })
      .filter(Boolean);


  let textoPozos = '';

  if(nombresPozos.length === 1){

    textoPozos =
      nombresPozos[0];

  }

  else if(nombresPozos.length === 2){

    textoPozos =
      nombresPozos[0] +
      ' y ' +
      nombresPozos[1];

  }

  else if(nombresPozos.length > 2){

    textoPozos =
      nombresPozos
        .slice(0,-1)
        .join(', ') +
      ' y ' +
      nombresPozos[
        nombresPozos.length - 1
      ];

  }


  const tituloPozos =
    nombresPozos.length === 1
      ? 'POZO (PRODUCTO DE)'
      : 'POZOS (PRODUCTO DE)';


  /* ======================================================
     HORA / FECHA DEL INICIO
     ====================================================== */

  const ahora =
    new Date();


  const horaInicio =
    ahora.toLocaleTimeString(
      'es-MX',
      {
        hour:'2-digit',
        minute:'2-digit',
        hour12:false
      }
    );


  const fechaInicio =
    ahora.toLocaleDateString(
      'es-MX',
      {
        day:'2-digit',
        month:'2-digit',
        year:'numeric'
      }
    );


  /* ======================================================
     GPS — DETECTAR DENTRO / FUERA DE RANGO
     ====================================================== */

  const distancia =
    Number(
      gps?.distancia ??
      gps?.distance ??
      gps?.distanciaMetros ??
      gps?.distanceMeters ??
      gps?.distanceM ??
      gps?.metros ??
      gps?.distance_m ??
      NaN
    );


  const textoGPS =
    [
      gps?.estado,
      gps?.status,
      gps?.mensaje,
      gps?.message,
      gps?.validacion,
      gps?.validation,
      gps?.texto,
      gps?.label
    ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();


  const dentro =
    (
      gps?.dentroRango === true ||
      gps?.dentroDeRango === true ||
      gps?.enRango === true ||
      gps?.withinRange === true ||
      gps?.isWithinRange === true ||
      textoGPS.includes('DENTRO DE RANGO') ||
      textoGPS.includes('EN RANGO')
    );


  const fuera =
    (
      gps?.dentroRango === false ||
      gps?.dentroDeRango === false ||
      gps?.enRango === false ||
      gps?.withinRange === false ||
      gps?.isWithinRange === false ||
      textoGPS.includes('FUERA DE RANGO')
    );


  let lineaEstadoGPS =
    '📍 *GPS:* Disponible';


  if(dentro){

    lineaEstadoGPS =
      '📍 *GPS:*\n' +
      '✅ *DENTRO DE RANGO*';

  }

  else if(fuera){

    lineaEstadoGPS =
      '📍 *GPS:*\n' +
      '❌ *FUERA DE RANGO*';

  }

  else if(!gps){

    lineaEstadoGPS =
      '📍 *GPS:*\n' +
      '⚠️ No disponible';

  }


  if(
    Number.isFinite(distancia)
  ){

    lineaEstadoGPS +=
      '\nDistancia: ' +
      Math.round(distancia) +
      ' m';

  }


  /* ======================================================
     MENSAJE FINAL
     ====================================================== */

  const lineas = [

    '🛢 *' +
      tituloPozos +
      ':*',

    '*' +
      textoPozos +
      '*',

    '',

    '▶️ *INICIO DESCARGA EN ' +
      String(lugar)
        .toUpperCase() +
      '*',

    '',

    '🚛 *Proveedor:* ' +
      String(
        empresaActiva() || ''
      ),

    '🚚 *Unidad:* ' +
      String(
        unidad() || ''
      ),

    '',

    '🕒 *Hora de inicio:*',

    horaInicio +
      ' h · ' +
      fechaInicio,

    '',

    '💧 *Volumen total:* ' +
      volumen.toFixed(2) +
      ' m³',

    '',

    lineaEstadoGPS

  ];


  if(
    String(
      config.observaciones || ''
    ).trim()
  ){

    lineas.push(
      '',
      '📝 *Observaciones:* ' +
      String(
        config.observaciones
      ).trim()
    );

  }


  return lineas.join('\n');

}


function datosSeleccionPozosDescarga(){

  const ids =
    leerSeleccionPozosDescarga();

  const lista =
    obtenerPozosCargadosPendientes();

  return lista.filter(
    item => ids.includes(item.id)
  );
}



function keyInicio(tipo){
  return tipo === 'CARGA'
    ? MEM.carga
    : MEM.descarga;
}

function leerInicio(tipo){
  try{
    const raw = localStorage.getItem(
      keyInicio(tipo)
    );

    return raw
      ? JSON.parse(raw)
      : null;
  }catch(e){
    return null;
  }
}

function guardarInicio(tipo,data){
  localStorage.setItem(
    keyInicio(tipo),
    JSON.stringify(data)
  );
}

function borrarInicio(tipo){
  localStorage.removeItem(
    keyInicio(tipo)
  );
}

function empresaActiva(){

  let empresa = String(
    window.UPV?.empresa || ''
  ).trim().toUpperCase();

  if(empresa){
    return empresa;
  }

  const posibles = Array.from(
    document.querySelectorAll(
      'span,strong,div'
    )
  );

  const encontrado = posibles.find(el => {
    const t = txt(el.textContent);

    return (
      t === 'PETROSMART' ||
      t === 'IPEP'
    );
  });

  return encontrado
    ? txt(encontrado.textContent)
    : '';
}


function leerUnidadSeleccionada(){

  try{

    const raw = sessionStorage.getItem(
      'upv_unidad_operativa'
    );

    if(!raw){
      return null;
    }

    const data = JSON.parse(raw);

    if(
      !data ||
      data.empresa !== empresaActiva()
    ){
      return null;
    }

    return data;

  }catch(e){
    return null;
  }
}


function unidad(){

  const data = leerUnidadSeleccionada();

  if(!data){
    return '';
  }

  return data.capacidadM3 + ' m³';
}

function listaPozos(){
  return `
    <option value="">
      Seleccionar pozo...
    </option>
    ${POZOS.map(p => `
      <option value="${p}">
        CUICHAPA ${p}
      </option>
    `).join('')}
  `;
}

function error(msg){
  if(typeof window.mostrarError === 'function'){
    window.mostrarError(msg);
  }else{
    alert(msg);
  }
}


/* ========================================================
   ENCONTRAR Y REEMPLAZAR MENÚ VIEJO
   ======================================================== */

function encontrarBloqueQueHaras(){

  const candidatos = Array.from(
    document.querySelectorAll(
      'section,div,article,fieldset'
    )
  );

  return candidatos.find(el => {

    const contenido = txt(el.textContent);

    if(
      !contenido.includes('QUE HARAS') ||
      !contenido.includes('CARGA') ||
      !contenido.includes('DESCARGA')
    ){
      return false;
    }

    /*
     * Queremos el bloque pequeño, no toda la página.
     */
    const hijosTexto = Array.from(
      el.children || []
    ).some(hijo => {
      const t = txt(hijo.textContent);

      return (
        t.includes('CARGA') ||
        t.includes('DESCARGA')
      );
    });

    return hijosTexto;
  }) || null;
}


function instalarMenu(){

  const menu = document.getElementById(
    'upvMenuFinal'
  );

  if(!menu){
    console.error(
      '[UPV FINAL] No existe #upvMenuFinal'
    );

    return false;
  }

  if(
    menu.dataset.upvFinalBind === '1'
  ){
    return true;
  }

  menu.dataset.upvFinalBind = '1';

  menu.addEventListener(
    'click',
    function(event){

      const btn = event.target.closest(
        '[data-flow]'
      );

      if(!btn){
        return;
      }

      const flow = btn.dataset.flow;

      console.log(
        '[UPV FINAL] CLICK:',
        flow
      );

      menu
        .querySelectorAll('[data-flow]')
        .forEach(function(b){

          b.classList.toggle(
            'active',
            b === btn
          );

        });

      abrir(flow);
    }
  );

  console.log(
    '[UPV FINAL] Menú enlazado'
  );

  return true;
}


/* ========================================================
   CONTENEDOR NUEVO
   ======================================================== */

function root(){

  const r = document.getElementById(
    'upvFlowFinal'
  );

  if(!r){
    console.error(
      '[UPV FINAL] No existe #upvFlowFinal'
    );

    return null;
  }

  return r;
}


function volverBtn(){
  return `
    <button
      type="button"
      class="upv-back-final"
      data-final-back>
      ←
    </button>
  `;
}


function activarBack(){

  document
    .querySelector('[data-final-back]')
    ?.addEventListener(
      'click',
      function(){
        const r = root();

        if(r){
          r.innerHTML = '';
        }

        document
          .querySelectorAll(
            '#upvMenuFinal [data-flow]'
          )
          .forEach(
            b => b.classList.remove('active')
          );
      }
    );
}



/* ========================================================
   SELECCIÓN DE UNIDAD SEGÚN EMPRESA
   ======================================================== */

function opcionesUnidadEmpresa(){

  const emp = empresaActiva();

  if(emp === 'PETROSMART'){

    return [
      {
        capacidadM3:30,
        titulo:'UNIDAD 30 m³',
        subtitulo:'PETROSMART'
      }
    ];

  }

  if(emp === 'IPEP'){

    return [
      {
        capacidadM3:30,
        titulo:'UNIDAD 30 m³',
        subtitulo:'IPEP'
      },
      {
        capacidadM3:20,
        titulo:'UNIDAD 20 m³',
        subtitulo:'IPEP'
      }
    ];

  }

  return [];
}


function guardarUnidadSeleccionada(capacidad){

  const data = {
    empresa:empresaActiva(),
    capacidadM3:Number(capacidad),
    seleccionadaAt:Date.now()
  };

  sessionStorage.setItem(
    'upv_unidad_operativa',
    JSON.stringify(data)
  );

  window.UPV_UNIDAD_SELECCIONADA = data;

  return data;
}


function buscarTarjetaUnidadVieja(){

  const input = document.getElementById(
    'upv-unidad'
  );

  if(!input){
    return null;
  }

  return (
    input.closest(
      '.upv-card,.card,.panel,.form-card,section'
    ) ||
    input.parentElement
  );
}


function actualizarBarraUnidad(){

  const menu = document.getElementById(
    'upvMenuFinal'
  );

  if(!menu){
    return;
  }

  let barra = document.getElementById(
    'upvUnidadActivaBar'
  );

  const data = leerUnidadSeleccionada();

  if(!data){

    if(barra){
      barra.remove();
    }

    return;
  }

  if(!barra){

    barra = document.createElement('div');

    barra.id = 'upvUnidadActivaBar';
    barra.className = 'upv-unidad-activa-bar';

    menu.insertAdjacentElement(
      'beforebegin',
      barra
    );
  }

  barra.innerHTML = `
    <div class="upv-unidad-activa-info">
      <span>UNIDAD SELECCIONADA</span>
      <strong>
        ${data.capacidadM3} m³
      </strong>
      <small>
        ${data.empresa}
      </small>
    </div>

    <button
      type="button"
      id="upvCambiarUnidad">
      Cambiar
    </button>
  `;

  document
    .getElementById('upvCambiarUnidad')
    ?.addEventListener(
      'click',
      function(){

        sessionStorage.removeItem(
          'upv_unidad_operativa'
        );

        instalarSelectorUnidad(true);
      }
    );
}


function instalarSelectorUnidad(forzar){

  const menu = document.getElementById(
    'upvMenuFinal'
  );

  if(!menu){
    return false;
  }

  /*
   * Quitar barra antigua de número de pipa.
   */
  const vieja = buscarTarjetaUnidadVieja();

  if(vieja){
    vieja.classList.add(
      'upv-unidad-vieja-oculta'
    );
  }


  /*
   * Si ya hay una unidad válida seleccionada,
   * entrar directamente al menú operativo.
   */
  if(
    !forzar &&
    leerUnidadSeleccionada()
  ){

    const selectorViejo =
      document.getElementById(
        'upvSeleccionUnidad'
      );

    if(selectorViejo){
      selectorViejo.remove();
    }

    menu.hidden = false;

    menu.classList.remove(
      'upv-menu-bloqueado'
    );

    actualizarBarraUnidad();

    return true;
  }


  /*
   * Antes de elegir unidad NO mostrar
   * Carga / Descarga / Observaciones.
   */
  menu.hidden = true;
  menu.classList.add(
    'upv-menu-bloqueado'
  );

  const flow = document.getElementById(
    'upvFlowFinal'
  );

  if(flow){
    flow.innerHTML = '';
  }

  const barra = document.getElementById(
    'upvUnidadActivaBar'
  );

  if(barra){
    barra.remove();
  }

  let selector = document.getElementById(
    'upvSeleccionUnidad'
  );

  if(selector){
    selector.remove();
  }

  selector = document.createElement(
    'section'
  );

  selector.id = 'upvSeleccionUnidad';
  selector.className =
    'upv-seleccion-unidad';

  const opciones =
    opcionesUnidadEmpresa();

  selector.innerHTML = `
    <header class="upv-seleccion-unidad-head">
      <span>2 · SELECCIONA TU UNIDAD</span>
      <p>
        ${empresaActiva()}
      </p>
    </header>

    <div class="upv-unidades-grid">

      ${opciones.map(op => `
        <button
          type="button"
          class="upv-unidad-card"
          data-capacidad="${op.capacidadM3}">

          <span class="upv-unidad-icono">
            🚛
          </span>

          <strong>
            ${op.titulo}
          </strong>

          <small>
            ${op.subtitulo}
          </small>

        </button>
      `).join('')}

    </div>
  `;

  menu.insertAdjacentElement(
    'beforebegin',
    selector
  );

  selector.addEventListener(
    'click',
    function(event){

      const btn = event.target.closest(
        '[data-capacidad]'
      );

      if(!btn){
        return;
      }

      const capacidad = Number(
        btn.dataset.capacidad
      );

      guardarUnidadSeleccionada(
        capacidad
      );

      selector.remove();

      menu.hidden = false;

      menu.classList.remove(
        'upv-menu-bloqueado'
      );

      actualizarBarraUnidad();

      menu.scrollIntoView({
        behavior:'smooth',
        block:'start'
      });
    }
  );

  return true;
}



/* ========================================================
   SELECTOR VISUAL DE POZO — ESTILO RECORREDORES
   ======================================================== */

function formatoPozoSelectorUPV(valor){

  const limpio =
    String(valor || '')
      .trim()
      .toUpperCase()
      .replace(/^CUICHAPA\s*/,'')
      .replace(/^POZO\s*/,'')
      .replace(/^C-/,'')
      .trim();

  return limpio
    ? 'C-' + limpio
    : '';
}


function montarSelectorPozoVisual(selectId){

  const select =
    document.getElementById(
      selectId
    );

  if(!select){
    return;
  }


  /*
   * Evitar duplicar el componente.
   */
  const existente =
    select.parentElement
      ?.querySelector(
        '.upv-pozo-picker'
      );

  existente?.remove();


  /*
   * Conservamos el SELECT ORIGINAL.
   *
   * Toda la lógica existente continúa leyendo:
   * document.getElementById('upvFinalPozo').value
   */
  select.classList.add(
    'upv-pozo-native-hidden'
  );


  const picker =
    document.createElement(
      'div'
    );

  picker.className =
    'upv-pozo-picker';


  const opciones =
    Array.from(
      select.options
    )
    .filter(
      op =>
        String(op.value || '').trim()
    );


  const valorActual =
    String(
      select.value || ''
    ).trim();


  picker.innerHTML = `
    <button
      type="button"
      class="upv-pozo-picker-head"
      aria-expanded="false">

      <span class="upv-pozo-picker-title">

        <span class="upv-pozo-picker-icon">
          🛢
        </span>

        <span>
          ${
            valorActual
              ? formatoPozoSelectorUPV(
                  valorActual
                )
              : '¿A QUÉ POZO TE DIRIGES?'
          }
        </span>

      </span>

      <span class="upv-pozo-picker-arrow">
       ⌄
      </span>

    </button>


    <div
      class="upv-pozo-picker-list"
      hidden>

      <div class="upv-pozo-picker-list-title">

        <span>🛢</span>

        <strong>
          ¿A QUÉ POZO TE DIRIGES?
        </strong>

      </div>


      <div class="upv-pozo-picker-scroll">

        ${
          opciones
            .map(
              op => {

                const value =
                  String(op.value);

                const activo =
                  value === valorActual;

                return `
                  <button
                    type="button"
                    class="upv-pozo-picker-option ${
                      activo
                        ? 'selected'
                        : ''
                    }"
                    data-pozo="${value}">

                    <span class="upv-pozo-mini-icon"></span>

                    <strong>
                      ${formatoPozoSelectorUPV(value)}
                    </strong>

                  </button>
                `;
              }
            )
            .join('')
        }

      </div>

    </div>
  `;


  select.insertAdjacentElement(
    'afterend',
    picker
  );


  const head =
    picker.querySelector(
      '.upv-pozo-picker-head'
    );


  const lista =
    picker.querySelector(
      '.upv-pozo-picker-list'
    );


  const flecha =
    picker.querySelector(
      '.upv-pozo-picker-arrow'
    );


  function cerrar(){

    lista.hidden = true;

    head.setAttribute(
      'aria-expanded',
      'false'
    );

    picker.classList.remove(
      'open'
    );

    flecha.textContent =
      '⌄';
  }


  function abrir(){

    lista.hidden = false;

    head.setAttribute(
      'aria-expanded',
      'true'
    );

    picker.classList.add(
      'open'
    );

    flecha.textContent =
      '⌃';
  }


  head.addEventListener(
    'click',
    function(){

      if(lista.hidden){
        abrir();
      }else{
        cerrar();
      }
    }
  );


  picker
    .querySelectorAll(
      '.upv-pozo-picker-option'
    )
    .forEach(
      boton => {

        boton.addEventListener(
          'click',
          function(){

            const valor =
              boton.dataset.pozo;


            /*
             * Actualizar SELECT REAL.
             */
            select.value =
              valor;


            /*
             * Disparar change para no romper
             * ninguna lógica existente.
             */
            select.dispatchEvent(
              new Event(
                'change',
                {
                  bubbles:true
                }
              )
            );


            picker
              .querySelectorAll(
                '.upv-pozo-picker-option'
              )
              .forEach(
                x =>
                  x.classList.remove(
                    'selected'
                  )
              );


            boton.classList.add(
              'selected'
            );


            const titulo =
              picker.querySelector(
                '.upv-pozo-picker-title span:last-child'
              );


            if(titulo){

              titulo.textContent =
                formatoPozoSelectorUPV(
                  valor
                );
            }


            cerrar();
          }
        );
      }
    );
}


/* ========================================================
   SELECTOR DE POZO
   ======================================================== */

function conectarPozo(selectId){

  const select =
    document.getElementById(selectId);

  const bloque =
    document.getElementById(
      'upvFinalPozoWrap'
    );

  if(!select || !bloque) return;

  function refrescar(){

    const mostrar =
      select.value === 'POZO';

    bloque.hidden = !mostrar;

    if(!mostrar){
      const pozo =
        document.getElementById(
          'upvFinalPozo'
        );

      if(pozo) pozo.value = '';
    }
  }

  select.addEventListener(
    'change',
    refrescar
  );

  refrescar();
}



/* ========================================================
   CONFIRMACIÓN VISUAL + PREVIEW WHATSAPP
   ======================================================== */

function escaparHtml(valor){
  return String(valor ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}


function fechaHoraPreview(){

  const momento = horaActual();

  return {
    fecha:momento.fecha,
    hora:momento.hora
  };
}


/* ========================================================
   FORMATO + VALIDACIÓN GPS UPV
   ======================================================== */

function formatoPozoUPV(pozo){

  const limpio =
    String(pozo || '')
      .trim()
      .toUpperCase()
      .replace(/^CUICHAPA\s*/,'')
      .replace(/^POZO\s*/,'')
      .replace(/^C-/,'')
      .trim();

  return limpio
    ? 'C-' + limpio
    : '';
}

/*
 * ==========================================================
 * UBICACIÓN FÍSICA DEL FINALIZAR
 * ==========================================================
 */

function ubicacionTerminoUPV(destino, pozo){

  const lugar =
    String(destino || '')
      .trim()
      .toUpperCase();

  if(lugar === 'POZO'){

    const p =
      String(pozo || '')
        .trim();

    return p
      ? formatoPozoUPV(p)
      : 'POZO';
  }

  return lugar || 'NO ESPECIFICADO';
}

/*
 * ==========================================================
 * UBICACIÓN DONDE INICIÓ REALMENTE LA OPERACIÓN
 * ==========================================================
 *
 * Para el reporte de FINALIZAR:
 *
 * CARGA iniciada en POZO 106D
 * → Finalizó carga en: C-106D
 *
 * El destino ("Se dirige a") es independiente.
 */

function ubicacionInicioGuardadoUPV(inicio){

  if(!inicio || typeof inicio !== 'object'){
    return 'NO ESPECIFICADO';
  }


  const ubicacion =
    String(
      inicio.origen ||
      inicio.ubicacion ||
      inicio.lugar ||
      inicio.en ||
      inicio.destino ||
      ''
    )
      .trim()
      .toUpperCase();


  const pozo =
    String(
      inicio.pozo ||
      inicio.numeroPozo ||
      inicio.well ||
      ''
    )
      .trim();


  if(
    ubicacion === 'POZO' ||
    (
      !ubicacion &&
      pozo
    )
  ){

    return pozo
      ? formatoPozoUPV(pozo)
      : 'POZO';
  }


  if(
    ubicacion === 'PIA' ||
    ubicacion === 'ECO' ||
    ubicacion === 'BSC' ||
    ubicacion === 'BASE'
  ){
    return ubicacion;
  }


  return ubicacion ||
    (
      pozo
        ? formatoPozoUPV(pozo)
        : 'NO ESPECIFICADO'
    );
}






async function validarGPSOperacionUPV(
  ubicacion,
  pozo
){

  try{

    if(!window.UPVGPS){

      return {
        error:
          'Servicio GPS no disponible'
      };
    }


    if(
      String(ubicacion || '')
        .toUpperCase() === 'POZO'
    ){

      return await window.UPVGPS
        .validarPozo(pozo);
    }


    return await window.UPVGPS
      .validarGeneral();


  }catch(error){

    console.error(
      '[UPV GPS]',
      error
    );


    return {

      error:
        error?.message ||
        'No se pudo obtener GPS'

    };
  }
}


function lineasGpsWhatsappUPV(gps){

  if(!gps){
    return [];
  }


  if(gps.error){

    return [
      '',
      '📍 GPS: *NO DISPONIBLE*'
    ];
  }


  if(gps.tipo === 'POZO'){

    if(
      gps.referenciaDisponible === false
    ){

      return [
        '',
        '📍 Ubicación de envío: *' +
          Number(gps.lat).toFixed(6) +
          ', ' +
          Number(gps.lng).toFixed(6) +
          '*'
      ];
    }


    if(gps.dentro){

      /*
       * DENTRO DEL RANGO:
       * utilizar GPS internamente para validar,
       * pero NO mostrar coordenadas.
       */
      return [
        '',
        '✅ *DENTRO DEL RANGO*'
      ];
    }


    return [
      '',
      '⚠️ *FUERA DE RANGO*',
      '📏 Distancia: *' +
        Math.round(
          Number(gps.distancia)
        ) +
        ' m*',
      '📍 Ubicación de envío: *' +
        Number(gps.lat).toFixed(6) +
        ', ' +
        Number(gps.lng).toFixed(6) +
        '*'
    ];
  }


  return [
    '',
    '📍 Ubicación de envío: *' +
      Number(gps.lat).toFixed(6) +
      ', ' +
      Number(gps.lng).toFixed(6) +
      '*'
  ];
}


function resumenGpsHtmlUPV(gps){

  if(!gps){
    return '';
  }


  if(gps.error){

    return `
      <div class="upv-confirm-item upv-confirm-gps-error">
        <span>GPS</span>
        <strong>NO DISPONIBLE</strong>
      </div>
    `;
  }


  if(
    gps.tipo === 'POZO' &&
    gps.referenciaDisponible !== false
  ){

    if(gps.dentro){

      return `
        <div class="upv-confirm-item upv-confirm-gps-dentro">
          <span>UBICACIÓN</span>
          <strong>✅ DENTRO DEL RANGO</strong>
        </div>
      `;
    }


    return `
      <div class="upv-confirm-item upv-confirm-gps-fuera">
        <span>UBICACIÓN</span>

        <strong>
          ⚠️ FUERA DE RANGO
          ·
          ${Math.round(
            Number(gps.distancia)
          )} m
        </strong>
      </div>
    `;
  }


  return `
    <div class="upv-confirm-item upv-confirm-gps-dentro">

      <span>
        UBICACIÓN DE ENVÍO
      </span>

      <strong>
        ${Number(gps.lat).toFixed(6)},
        ${Number(gps.lng).toFixed(6)}
      </strong>

    </div>
  `;
}


function mensajeWhatsappInicio(config){

  const {
    tipo,
    empresa,
    unidad,
    origen,
    pozo,
    gps,
    observacionesOperacion
  } = config;

  const t =
    fechaHoraPreview();

  const lugar =
    origen === 'POZO'
      ? formatoPozoUPV(pozo)
      : origen;

  const tipoNormalizado =
    String(tipo || '')
      .trim()
      .toUpperCase();

  const actividad =
    tipoNormalizado === 'DESCARGA'
      ? 'INICIO DE DESCARGA'
      : 'INICIO DE CARGA';

  const lineas = [

    '🛢️ *' + lugar + '* 🛢️',
    '*' + actividad + '*',
    '',

    'Proveedor: *' +
      empresa +
      '*',

    'Unidad: *' +
      unidad +
      '*'

  ];

  lineas.push(
    ...observacionWhatsappUPV(
      observacionesOperacion
    )
  );

  lineas.push(
    '',

    'Fecha: ' +
      t.fecha,

    'Hora de inicio: ' +
      t.hora
  );

  /*
   * GPS SIEMPRE AL FINAL
   */
  lineas.push(
    ...lineasGpsWhatsappUPV(
      gps
    )
  );

  return lineas.join('\n');
}


function mensajeWhatsappTermino(config){

  const {
    tipo,
    empresa,
    unidad,
    destino,
    pozo,
    cantidadM3,
    inicio,
    gps,
    observacionesOperacion
  } = config;

  const t =
    fechaHoraPreview();

  const tipoNormalizado =
    String(tipo || '')
      .trim()
      .toUpperCase();

  const actividad =
    tipoNormalizado === 'DESCARGA'
      ? 'FINALIZA DESCARGA'
      : 'FINALIZA CARGA';

  /*
   * Lugar principal.
   * Se muestra únicamente arriba.
   */
  const ubicacionFinal =
    String(
      config.ubicacionTermino ||
      'NO ESPECIFICADO'
    );

  /*
   * Destino posterior.
   */
  const lugarDestino =
    String(destino || '')
      .trim()
      .toUpperCase() === 'POZO'
        ? formatoPozoUPV(pozo)
        : destino;

  const etiquetaDestino =
    String(destino || '')
      .trim()
      .toUpperCase() === 'POZO' &&
    tipoNormalizado === 'CARGA'
      ? 'Se dirige a: '
      : 'Se dirige a: ';

  const lineas = [

    '🛢️ *' + ubicacionFinal + '* 🛢️',
    '*' + actividad + '*',
    '',

    'Proveedor: *' +
      empresa +
      '*',

    'Unidad: *' +
      unidad +
      '*',

    '',

    'Volumen: *' +
      Number(cantidadM3).toFixed(2) +
      ' m³*',

    etiquetaDestino +
      lugarDestino

  ];

  lineas.push(
    ...observacionWhatsappUPV(
      observacionesOperacion
    )
  );

  if(inicio?.hora){

    lineas.push(
      '',
      'Inicio: ' +
        inicio.hora
    );

  }

  lineas.push(
    'Finalizó: ' +
      t.hora,

    'Fecha: ' +
      t.fecha
  );

  /*
   * GPS SIEMPRE AL FINAL
   */
  lineas.push(
    ...lineasGpsWhatsappUPV(
      gps
    )
  );

  return lineas.join('\n');
}


function whatsappPreviewHtml(texto){

  /*
   * Convertimos una parte del formato *negrita*
   * de WhatsApp a HTML únicamente para preview.
   */

  let seguro = escaparHtml(texto);

  seguro = seguro.replace(
    /\*([^*]+)\*/g,
    '<strong>$1</strong>'
  );

  seguro = seguro.replace(
    /\n/g,
    '<br>'
  );

  return seguro;
}


function confirmarUPVVisual(config){

  return new Promise(resolve => {

    const existente =
      document.getElementById(
        'upvConfirmOverlay'
      );

    if(existente){
      existente.remove();
    }

    const esInicio =
      config.etapa === 'INICIO';

    const titulo =
      esInicio
        ? 'Confirmar inicio'
        : 'Confirmar finalización';

    const subtitulo =
      esInicio
        ? 'Revisa los datos antes de iniciar la actividad.'
        : 'Revisa el cierre antes de registrar la actividad.';

    const confirmarTexto =
      esInicio
        ? 'CONFIRMAR INICIO'
        : 'CONFIRMAR FINALIZACIÓN';

    const icono =
      esInicio
        ? '▶'
        : '✓';

    const mensaje =
      config.mensajeWhatsapp || '';

    const overlay =
      document.createElement('div');

    overlay.id =
      'upvConfirmOverlay';

    overlay.className =
      'upv-confirm-overlay';

    overlay.innerHTML = `
      <div
        class="upv-confirm-modal"
        role="dialog"
        aria-modal="true">

        <div class="upv-confirm-top">

          <div
            class="upv-confirm-icon ${esInicio ? 'inicio' : 'termino'}">
            ${icono}
          </div>

          <div>
            <span>
              VERIFICACIÓN DE REPORTE
            </span>

            <h2>
              ${escaparHtml(titulo)}
            </h2>

            <p>
              ${escaparHtml(subtitulo)}
            </p>
          </div>

        </div>


        <div class="upv-confirm-data">

          ${config.resumenHtml || ''}

          ${resumenGpsHtmlUPV(
            config.gps
          )}

          ${observacionResumenHtmlUPV(
            config.observacionesOperacion
          )}

        </div>


        <div class="upv-wa-preview">

          <div class="upv-wa-head">

            <div class="upv-wa-logo">
              WA
            </div>

            <div>
              <strong>
                Vista previa de WhatsApp
              </strong>

              <span>
                Así se visualizará el reporte
              </span>
            </div>

          </div>


          <div class="upv-wa-chat">

            <div class="upv-wa-bubble">

              ${whatsappPreviewHtml(
                mensaje
              )}

              <small>
                Vista previa
                <b>✓✓</b>
              </small>

            </div>

          </div>

        </div>


        <div class="upv-confirm-actions">

          <button
            type="button"
            id="upvConfirmCancelar"
            class="upv-confirm-cancel">
            CANCELAR
          </button>

          <button
            type="button"
            id="upvConfirmAceptar"
            class="upv-confirm-accept ${esInicio ? 'inicio' : 'termino'}">
            ${confirmarTexto}
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(
      overlay
    );

    document.body.classList.add(
      'upv-confirm-open'
    );


    function cerrar(resultado){

      document.body.classList.remove(
        'upv-confirm-open'
      );

      overlay.classList.add(
        'closing'
      );

      setTimeout(
        () => overlay.remove(),
        140
      );

      resolve(resultado);
    }


    overlay
      .querySelector(
        '#upvConfirmCancelar'
      )
      .addEventListener(
        'click',
        () => cerrar(false)
      );


    overlay
      .querySelector(
        '#upvConfirmAceptar'
      )
      .addEventListener(
        'click',
        () => cerrar(true)
      );


    overlay.addEventListener(
      'click',
      event => {

        if(event.target === overlay){
          cerrar(false);
        }

      }
    );

  });
}



/* ========================================================
   OBSERVACIONES DE OPERACIÓN
   ======================================================== */

function conectarContadorObservacion(
  inputId,
  counterId
){

  const input =
    document.getElementById(inputId);

  const counter =
    document.getElementById(counterId);

  if(!input || !counter){
    return;
  }

  function actualizar(){

    counter.textContent =
      String(
        input.value.length
      );
  }

  input.addEventListener(
    'input',
    actualizar
  );

  actualizar();
}


function leerObservacionOperacion(etapa){

  const id =
    etapa === 'INICIO'
      ? 'upvFinalObsOperacionInicio'
      : 'upvFinalObsOperacionTermino';

  return String(
    document
      .getElementById(id)
      ?.value || ''
  )
    .trim()
    .slice(0,500);
}


function observacionWhatsappUPV(valor){

  const obs =
    String(valor || '').trim();

  if(!obs){
    return [];
  }

  return [
    '',
    '📝 *Observaciones de la operación:*',
    obs
  ];
}


function observacionResumenHtmlUPV(valor){

  const obs =
    String(valor || '').trim();

  if(!obs){
    return '';
  }

  return `
    <div class="upv-confirm-item upv-confirm-observacion">
      <span>OBSERVACIONES</span>
      <strong>${escaparHtml(obs)}</strong>
    </div>
  `;
}


/* ========================================================
   INICIO
   ======================================================== */

function renderInicio(tipo){

  const r = root();

  if(!r) return;

  const previo = leerInicio(tipo);

  r.innerHTML = `
    <section class="upv-panel-final upv-final-amigable">

      ${volverBtn()}

      <header class="upv-panel-title">
        <h2>
          ${
            String(tipo).toUpperCase() === 'DESCARGA'
              ? 'INICIO DE DESCARGA'
              : 'INICIO DE CARGA'
          }
        </h2>
        <p>
          Registra dónde comienza.
        </p>
      </header>

      ${
        String(tipo).toUpperCase() === 'DESCARGA'
          ? htmlPozosParaDescarga()
          : ''
      }

      <div class="upv-final-field upv-amigable-card upv-amigable-destino">

        <label class="upv-amigable-titulo">
          📍 ${
            String(tipo).toUpperCase() === 'DESCARGA'
              ? '¿DÓNDE DESCARGAS?'
              : '¿DÓNDE INICIAS?'
          }
        </label>

        <small class="upv-amigable-ayuda">
          ${
            String(tipo).toUpperCase() === 'DESCARGA'
              ? 'Selecciona dónde realizarás la descarga'
              : 'Selecciona la ubicación'
          }
        </small>

        <select
          id="upvFinalOrigen"
          class="upv-final-control">

          <option value="">
            Seleccionar ubicación...
          </option>

          <option value="POZO">
            🛢️ POZO
          </option>

          <option value="PIA">
            🏭 PIA
          </option>

          <option value="ECO">
            🌿 ECO
          </option>

        </select>
      </div>

      <div
        id="upvFinalPozoWrap"
        class="upv-final-field"
        hidden>

        <label>SELECCIONAR POZO</label>

        <select
          id="upvFinalPozo"
          class="upv-final-control">
          ${listaPozos()}
        </select>
      </div>

      ${
        previo
        ? `
          <div class="upv-registro-ok">
            <div class="check">✓</div>
            <strong>INICIO REGISTRADO</strong>
            <span>
              ${previo.fecha} · ${previo.hora}
            </span>
          </div>

          <button
            type="button"
            class="upv-nuevo-registro"
            id="upvNuevoInicio">
            NUEVO REGISTRO
          </button>
        `
        : `
          
      <div class="upv-obs-operacion">

        <div class="upv-obs-operacion-head">
          <span>📝</span>

          <div>
            <strong>¿OCURRIÓ ALGO?</strong>
            <small>
              Opcional
            </small>
          </div>
        </div>

        <textarea
          id="upvFinalObsOperacionInicio"
          class="upv-obs-operacion-textarea"
          maxlength="500"
          rows="4"
          placeholder="Escribe aquí si ocurrió algún problema..."></textarea>

        <div class="upv-obs-operacion-counter">
          <span id="upvObsInicioContador">0</span>/500
        </div>

      </div>


      


      ${evidenciaFotoHtml()}

<button
            type="button"
            class="upv-action-final inicio"
            id="upvFinalInicioBtn">
            ${
              String(tipo).toUpperCase() === 'DESCARGA'
                ? '▶️ INICIAR DESCARGA'
                : '▶️ INICIAR CARGA'
            }
          </button>

      ${evidenciaGpsHtml()}

        `
      }

    </section>
  `;

  /*
   * DESCARGA:
   * el destino ya fue definido en FINALIZÓ CARGA.
   * No volver a pedir ubicación manualmente.
   */
  if(
    String(tipo).toUpperCase() === 'DESCARGA'
  ){

    const selectorOrigen =
      document.getElementById('upvFinalOrigen');

    if(selectorOrigen){

      const contenedor =
        selectorOrigen.closest(
          '.upv-final-field, .upv-amigable-card'
        );

      if(contenedor){

        contenedor.classList.add(
          'upv-descarga-destino-auto'
        );

        contenedor.style.display =
          'none';

      }

    }

  }

  activarBack();

  if(
    String(tipo).toUpperCase() === 'DESCARGA'
  ){
    activarSelectorPozosDescarga();
  }

  conectarPozo('upvFinalOrigen');

  montarSelectorPozoVisual(
    'upvFinalPozo'
  );

  conectarContadorObservacion(
    'upvFinalObsOperacionInicio',
    'upvObsInicioContador'
  );

  activarEvidencia();

  activarPanelPermisosUPV();





  document
    .getElementById(
      'upvNuevoInicio'
    )
    ?.addEventListener(
      'click',
      function(){

        if(
          confirm(
            '¿Deseas borrar el INICIO anterior y comenzar un nuevo registro?'
          )
        ){
          borrarInicio(tipo);
          renderInicio(tipo);
        }
      }
    );

  document
    .getElementById(
      'upvFinalInicioBtn'
    )
    ?.addEventListener(
      'click',
      async function(){

        if(!unidad()){
          error(
            'Ingresa primero el número de unidad.'
          );
          return;
        }

        /*
         * DESTINO AUTOMÁTICO PARA INICIO DESCARGA
         *
         * CARGA:
         *   conserva selección manual de origen.
         *
         * DESCARGA:
         *   hereda el destino definido en FINALIZÓ CARGA.
         */

        const esDescargaDestinoAuto =
          String(tipo).toUpperCase() ===
          'DESCARGA';


        const cargasDestinoAuto =
          esDescargaDestinoAuto
            ? datosSeleccionPozosDescarga()
            : [];


        let origen = '';
        let pozo = '';


        if(esDescargaDestinoAuto){

          if(!cargasDestinoAuto.length){

            error(
              'Selecciona al menos una carga para descargar.'
            );

            return;
          }


          /*
           * Todas las cargas seleccionadas deben tener
           * destino registrado.
           */
          const sinDestino =
            cargasDestinoAuto.filter(
              function(item){

                return !String(
                  item.destino || ''
                ).trim();

              }
            );


          if(sinDestino.length){

            error(
              'Una de las cargas seleccionadas pertenece a un registro anterior y no tiene destino guardado.'
            );

            return;
          }


          /*
           * No permitir iniciar una sola descarga
           * mezclando destinos distintos.
           */
          const clavesDestino =
            [...new Set(
              cargasDestinoAuto.map(
                function(item){

                  const tipoDestino =
                    String(
                      item.destino || ''
                    )
                    .trim()
                    .toUpperCase();


                  const destinoPozo =
                    String(
                      item.destinoPozo ||
                      item.destinoNombre ||
                      ''
                    )
                    .trim()
                    .toUpperCase()
                    .replace(
                      /^C[-\s]*/i,
                      ''
                    );


                  return (
                    tipoDestino === 'POZO'
                      ? 'POZO:' + destinoPozo
                      : tipoDestino
                  );

                }
              )
            )];


          if(clavesDestino.length > 1){

            error(
              'Las cargas seleccionadas tienen destinos diferentes. Selecciona solamente cargas que vayan al mismo lugar.'
            );

            return;
          }


          const cargaReferencia =
            cargasDestinoAuto[0];


          origen =
            String(
              cargaReferencia.destino || ''
            )
            .trim()
            .toUpperCase();


          if(origen === 'POZO'){

            pozo =
              String(
                cargaReferencia.destinoPozo ||
                cargaReferencia.destinoNombre ||
                ''
              )
              .trim()
              .replace(
                /^C[-\s]*/i,
                ''
              );


            if(!pozo){

              error(
                'La carga no tiene registrado el pozo destino.'
              );

              return;
            }

          }

        }

        else{

          origen =
            document.getElementById(
              'upvFinalOrigen'
            )?.value || '';


          if(!origen){

            error(
              'Selecciona dónde inicia la actividad.'
            );

            return;
          }


          pozo =
            document.getElementById(
              'upvFinalPozo'
            )?.value || '';


          if(
            origen === 'POZO' &&
            !pozo
          ){

            error(
              'Selecciona el pozo.'
            );

            return;

          }

        }

        const lugarPreview =
          origen === 'POZO'
            ? formatoPozoUPV(pozo)
            : origen;

        const observacionesOperacion =
          leerObservacionOperacion(
            'INICIO'
          );


        const gpsValidacion =
          await validarGPSOperacionUPV(
            origen,
            pozo
          );


        const esInicioDescarga =
          String(tipo).toUpperCase() === 'DESCARGA';


        const cargasSeleccionadas =
          esInicioDescarga
            ? datosSeleccionPozosDescarga()
            : [];


        /*
         * DESCARGA:
         * el volumen se obtiene automáticamente
         * de las cargas seleccionadas.
         */
        const volumenDescargaM3 =
          esInicioDescarga
            ? cargasSeleccionadas.reduce(
                function(total,item){

                  return (
                    total +
                    Number(
                      item.volumenM3 || 0
                    )
                  );

                },
                0
              )
            : 0;


        const volumenDescargaBbl =
          volumenDescargaM3 * 6.28981;


        if(
          esInicioDescarga &&
          obtenerPozosCargadosPendientes().length &&
          !cargasSeleccionadas.length
        ){

          error(
            'Selecciona al menos un pozo para iniciar la descarga.'
          );

          return;
        }


        let mensajeWA =
          mensajeWhatsappInicio({

            observacionesOperacion:
              observacionesOperacion,

            gps:
              gpsValidacion,
            tipo,
            empresa:empresaActiva(),
            unidad:unidad(),
            origen,
            pozo
          });


        if(
          esInicioDescarga &&
          cargasSeleccionadas.length
        ){

          mensajeWA =
            mensajeInicioDescargaSeleccionada({

              origen,
              pozo,

              cargas:
                cargasSeleccionadas,

              volumen:
                volumenDescargaM3,

              observaciones:
                observacionesOperacion,

              gps:
                gpsValidacion

            });

        }

        const ok =
          await confirmarUPVVisual({

            observacionesOperacion:
              observacionesOperacion,

            etapa:'INICIO',

            mensajeWhatsapp:
              mensajeWA,

            resumenHtml:
              (
                esInicioDescarga &&
                cargasSeleccionadas.length
              )
                ? resumenInicioDescargaHTML(
                    lugarPreview,
                    cargasSeleccionadas,
                    volumenDescargaM3,
                    gpsValidacion
                  )
                : `
                    <div class="upv-confirm-row">
                      <span>PROVEEDOR</span>
                      <strong>
                        ${escaparHtml(
                          empresaActiva()
                        )}
                      </strong>
                    </div>

                    <div class="upv-confirm-row">
                      <span>UNIDAD</span>
                      <strong>
                        ${escaparHtml(
                          unidad()
                        )}
                      </strong>
                    </div>

                    <div class="upv-confirm-row">
                      <span>OPERACIÓN</span>
                      <strong>
                        ${escaparHtml(tipo)}
                      </strong>
                    </div>

                    <div class="upv-confirm-row">
                      <span>INICIA EN</span>
                      <strong>
                        ${escaparHtml(
                          lugarPreview
                        )}
                      </strong>
                    </div>
                  `
          });

        if(!ok){
          return;
        }

        const momento = horaActual();


        /*
         * OBJETO ÚNICO DEL INICIO.
         *
         * Se utiliza tanto para conservar el estado
         * operativo en localStorage como para generar
         * el reporte offline-first.
         */
        const registroInicio = {

          ...momento,

          tipo,

          subtipo:
            'INICIO',

          etapa:
            'INICIO',

          empresa:
            empresaActiva(),

          origen,

          pozo,

          pozoOrigen:
            origen === 'POZO'
              ? pozo
              : null,

          unidad:
            unidad(),

          cantidadM3:
            esInicioDescarga
              ? volumenDescargaM3
              : null,

          cantidadBbl:
            esInicioDescarga
              ? volumenDescargaBbl
              : null,

          volumenDescargaM3:
            esInicioDescarga
              ? volumenDescargaM3
              : null,

          cargasSeleccionadas:
            cargasSeleccionadas,

          cargasSeleccionadasIds:
            cargasSeleccionadas.map(
              item => item.id
            ),

          pozosCarga:
            cargasSeleccionadas.map(
              item => item.pozo
            ),

          observaciones:
            observacionesOperacion,

          gps:
            gpsValidacion,

          /*
           * MISMO mensaje que el operador
           * acaba de ver en la vista previa.
           */
          mensajeWhatsapp:
            mensajeWA,

          createdAt:
            new Date().toISOString()

        };


        /*
         * Mantener comportamiento operativo existente.
         */
        guardarInicio(
          tipo,
          registroInicio
        );


        /*
         * Dejamos también una referencia global
         * para diagnóstico y recuperación.
         */
        window.UPV_FINAL_REGISTRO =
          registroInicio;


        /*
         * PUENTE OFFLINE-FIRST:
         *
         * IndexedDB
         *   ↓
         * sincronizador UPV
         *   ↓
         * Firebase pozos-upv
         *
         * NO UltraMsg directo.
         */
        try{

          if(
            typeof window.guardarRegistroFinalUPV ===
            'function'
          ){

            await window.guardarRegistroFinalUPV(
              registroInicio
            );

            console.log(
              '[UPV-FINAL] INICIO conectado a IndexedDB:',
              tipo
            );

          }else{

            console.warn(
              '[UPV-FINAL] guardarRegistroFinalUPV no disponible'
            );

          }

        }catch(errorPuente){

          console.error(
            '[UPV-FINAL] Error guardando INICIO:',
            errorPuente
          );

        }


        renderInicio(tipo);
      }
    );
}


/* ========================================================
   EVIDENCIA
   ======================================================== */

function evidenciaFotoHtml(){

  return `
    <div class="upv-evidencia-rec">

      <div class="upv-evidencia-rec-head">

        <strong>
          📸 EVIDENCIA FOTOGRÁFICA
        </strong>

      </div>

      <div class="upv-evidencia-rec-line"></div>


      <input
        type="file"
        id="upvFinalFotos"
        accept="image/*"
        multiple
        hidden>


      <input
        type="file"
        id="upvFinalCamara"
        accept="image/*"
        capture="environment"
        hidden>


      <div class="upv-evidencia-rec-actions">

        <button
          type="button"
          id="upvFinalCamaraBtn"
          class="upv-evidencia-rec-btn camara">

          <span>
            📷
          </span>

          <strong>
            Cámara
          </strong>

        </button>


        <button
          type="button"
          id="upvFinalGaleriaBtn"
          class="upv-evidencia-rec-btn galeria">

          <span>
            🖼
          </span>

          <strong>
            Galería
          </strong>

        </button>

      </div>


      <div
        id="upvFinalFotosEstado"
        class="upv-evidencia-rec-status">
      </div>

    </div>
  `;
}


function evidenciaGpsHtml(){

  return `
    <section class="upv-permisos-operacion">

      <div class="upv-permisos-operacion-head">

        <div>
          <small>
            SEGURIDAD DEL DISPOSITIVO
          </small>

          <strong>
            ESTADO DE PERMISOS
          </strong>
        </div>

        <button
          type="button"
          id="upvPermisosVerificar"
          class="upv-permisos-verificar">

          ↻ VERIFICAR

        </button>

      </div>


      <div class="upv-permisos-grid">


        <div
          id="upvPermisoUbicacion"
          class="upv-permiso-card pendiente">

          <span class="upv-permiso-icon">
            📍
          </span>

          <strong>
            UBICACIÓN
          </strong>

          <small
            id="upvPermisoUbicacionTxt">
            Verificando...
          </small>

        </div>


        <div
          id="upvPermisoAlertas"
          class="upv-permiso-card pendiente">

          <span class="upv-permiso-icon">
            🔔
          </span>

          <strong>
            ALERTAS
          </strong>

          <small
            id="upvPermisoAlertasTxt">
            Verificando...
          </small>

        </div>


        <div
          id="upvPermisoGps"
          class="upv-permiso-card pendiente">

          <span class="upv-permiso-icon">
            🛰️
          </span>

          <strong>
            GPS ACTIVO
          </strong>

          <small
            id="upvPermisoGpsTxt">
            Verificando...
          </small>

        </div>


      </div>


      <div
        id="upvPermisoResultado"
        class="upv-permisos-resultado">
      </div>


      <!--
        GPS LEGACY OCULTO.
        Se conserva para reutilizar exactamente
        la captura GPS que ya funciona en UPV.
      -->

      <button
        type="button"
        id="upvFinalGpsBtn"
        hidden
        aria-hidden="true">
      </button>

      <small
        id="upvFinalGpsEstado"
        hidden>
      </small>

    </section>
  `;
}


/*
 * Compatibilidad con cualquier referencia antigua.
 */

/* ========================================================
   PANEL DE PERMISOS UPV
   Ubicación + Alertas + GPS activo
   ======================================================== */

function estadoVisualPermisoUPV(
  cardId,
  textId,
  estado,
  texto,
  icono
){

  const card =
    document.getElementById(cardId);

  const txt =
    document.getElementById(textId);

  if(!card || !txt){
    return;
  }


  card.classList.remove(
    'ok',
    'error',
    'pendiente'
  );

  card.classList.add(
    estado
  );


  const ico =
    card.querySelector(
      '.upv-permiso-icon'
    );

  if(ico && icono){
    ico.textContent = icono;
  }


  txt.textContent =
    texto;

}



async function verificarPermisoUbicacionUPV(){

  let estado =
    'prompt';


  try{

    if(
      navigator.permissions &&
      navigator.permissions.query
    ){

      const p =
        await navigator.permissions.query({
          name:'geolocation'
        });

      estado =
        p.state;

    }

  }catch(e){}


  if(estado === 'granted'){

    estadoVisualPermisoUPV(
      'upvPermisoUbicacion',
      'upvPermisoUbicacionTxt',
      'ok',
      'Permitida',
      '✅'
    );

    return true;
  }


  if(estado === 'denied'){

    estadoVisualPermisoUPV(
      'upvPermisoUbicacion',
      'upvPermisoUbicacionTxt',
      'error',
      'Bloqueada',
      '❌'
    );

    return false;
  }


  estadoVisualPermisoUPV(
    'upvPermisoUbicacion',
    'upvPermisoUbicacionTxt',
    'pendiente',
    'Por autorizar',
    '📍'
  );

  return null;

}



async function verificarAlertasUPV(
  solicitar
){

  if(
    !('Notification' in window)
  ){

    estadoVisualPermisoUPV(
      'upvPermisoAlertas',
      'upvPermisoAlertasTxt',
      'error',
      'No disponibles',
      '❌'
    );

    return false;
  }


  let permiso =
    Notification.permission;


  if(
    solicitar &&
    permiso === 'default'
  ){

    try{

      permiso =
        await Notification.requestPermission();

    }catch(e){}

  }


  if(permiso === 'granted'){

    estadoVisualPermisoUPV(
      'upvPermisoAlertas',
      'upvPermisoAlertasTxt',
      'ok',
      'Permitidas',
      '✅'
    );

    return true;

  }


  if(permiso === 'denied'){

    estadoVisualPermisoUPV(
      'upvPermisoAlertas',
      'upvPermisoAlertasTxt',
      'error',
      'Bloqueadas',
      '❌'
    );

    return false;

  }


  estadoVisualPermisoUPV(
    'upvPermisoAlertas',
    'upvPermisoAlertasTxt',
    'pendiente',
    'Por autorizar',
    '🔔'
  );

  return null;

}



function comprobarGPSActivoUPV(){

  return new Promise(
    function(resolve){

      if(
        !navigator.geolocation
      ){

        estadoVisualPermisoUPV(
          'upvPermisoGps',
          'upvPermisoGpsTxt',
          'error',
          'No disponible',
          '❌'
        );

        resolve(false);

        return;
      }


      navigator.geolocation.getCurrentPosition(

        function(pos){

          estadoVisualPermisoUPV(
            'upvPermisoGps',
            'upvPermisoGpsTxt',
            'ok',
            'Activo',
            '✅'
          );


          const resultado =
            document.getElementById(
              'upvPermisoResultado'
            );


          if(resultado){

            const precision =
              Number(
                pos.coords?.accuracy || 0
              );

            resultado.innerHTML =
              '📍 Ubicación obtenida' +
              (
                precision
                  ? ' · Precisión ' +
                    Math.round(precision) +
                    ' m'
                  : ''
              );

          }


          resolve(true);

        },


        function(err){

          let texto =
            'Sin acceso';


          if(err){

            if(err.code === 1){
              texto = 'Sin permiso';
            }

            else if(err.code === 2){
              texto = 'No disponible';
            }

            else if(err.code === 3){
              texto = 'Sin respuesta';
            }

          }


          estadoVisualPermisoUPV(
            'upvPermisoGps',
            'upvPermisoGpsTxt',
            'error',
            texto,
            '❌'
          );


          resolve(false);

        },


        {
          enableHighAccuracy:true,
          timeout:12000,
          maximumAge:0
        }

      );

    }
  );

}



async function verificarPermisosOperacionUPV(
  solicitarAlertas
){

  await verificarPermisoUbicacionUPV();

  await verificarAlertasUPV(
    !!solicitarAlertas
  );

  const gpsOk =
    await comprobarGPSActivoUPV();


  /*
   * Si el GPS respondió correctamente,
   * hacemos también la captura por el
   * mecanismo ORIGINAL de UPV.
   */

  if(gpsOk){

    const btnGps =
      document.getElementById(
        'upvFinalGpsBtn'
      );

    if(btnGps){
      btnGps.click();
    }

  }

}



function activarPanelPermisosUPV(){

  const panel =
    document.querySelector(
      '.upv-permisos-operacion'
    );

  if(!panel){
    return;
  }


  const btn =
    document.getElementById(
      'upvPermisosVerificar'
    );


  if(
    btn &&
    !btn.dataset.upvPermisosReady
  ){

    btn.dataset.upvPermisosReady =
      '1';


    btn.addEventListener(
      'click',
      async function(){

        btn.disabled = true;

        btn.textContent =
          '↻ VERIFICANDO...';


        try{

          await verificarPermisosOperacionUPV(
            true
          );

        }

        finally{

          btn.disabled = false;

          btn.textContent =
            '↻ VERIFICAR';

        }

      }
    );

  }


  /*
   * Lectura automática al abrir la pantalla.
   * No fuerza notificaciones.
   */

  setTimeout(
    function(){

      verificarPermisosOperacionUPV(
        false
      );

    },
    250
  );

}


function evidenciaHtml(){

  return (
    evidenciaFotoHtml() +
    evidenciaGpsHtml()
  );

}


function activarEvidencia(){

  const fotosInput =
    document.getElementById(
      'upvFinalFotos'
    );

  const camaraInput =
    document.getElementById(
      'upvFinalCamara'
    );

  const camaraBtn =
    document.getElementById(
      'upvFinalCamaraBtn'
    );

  const galeriaBtn =
    document.getElementById(
      'upvFinalGaleriaBtn'
    );

  const estado =
    document.getElementById(
      'upvFinalFotosEstado'
    );


  /*
   * CÁMARA
   */
  camaraBtn
    ?.addEventListener(
      'click',
      function(){

        camaraInput?.click();

      }
    );


  /*
   * GALERÍA
   */
  galeriaBtn
    ?.addEventListener(
      'click',
      function(){

        fotosInput?.click();

      }
    );


  /*
   * FOTO DESDE CÁMARA
   *
   * Copiamos el archivo al input principal
   * para conservar la lógica actual de UPV.
   */
  camaraInput
    ?.addEventListener(
      'change',
      function(){

        if(
          !camaraInput.files ||
          !camaraInput.files.length
        ){
          return;
        }


        if(
          fotosInput &&
          typeof DataTransfer !== 'undefined'
        ){

          try{

            const dt =
              new DataTransfer();

            Array.from(
              camaraInput.files
            ).forEach(function(file){

              dt.items.add(file);

            });

            fotosInput.files =
              dt.files;

          }catch(e){}

        }


        if(estado){

          estado.textContent =
            '✅ Foto tomada';

        }


        fotosInput?.dispatchEvent(
          new Event(
            'change',
            {
              bubbles:true
            }
          )
        );

      }
    );


  /*
   * GALERÍA / INPUT PRINCIPAL
   */
  fotosInput
    ?.addEventListener(
      'change',
      function(){

        const cantidad =
          fotosInput.files
            ? fotosInput.files.length
            : 0;


        if(estado){

          estado.textContent =
            cantidad
              ? (
                  '✅ ' +
                  cantidad +
                  (
                    cantidad === 1
                      ? ' imagen seleccionada'
                      : ' imágenes seleccionadas'
                  )
                )
              : '';

        }

      }
    );



  const foto =
    document.getElementById(
      'upvFinalFotos'
    );

  document
    .getElementById(
      'upvFinalFotoBtn'
    )
    ?.addEventListener(
      'click',
      function(){
        foto?.click();
      }
    );

  foto?.addEventListener(
    'change',
    function(e){

      /*
       * Si existe el procesador original UPV,
       * reutilizarlo.
       */
      if(
        typeof window.procesarFotos ===
        'function'
      ){
        try{
          window.procesarFotos(
            e.target.files,
            'operacion'
          );
        }catch(err){
          console.warn(err);
        }
      }
    }
  );

  document
    .getElementById(
      'upvFinalGpsBtn'
    )
    ?.addEventListener(
      'click',
      function(){

        const estado =
          document.getElementById(
            'upvFinalGpsEstado'
          );

        if(!navigator.geolocation){

          estado.textContent =
            'GPS no disponible';

          return;
        }

        estado.textContent =
          'Capturando ubicación...';

        navigator.geolocation
          .getCurrentPosition(
            function(pos){

              window.UPV_FINAL_GPS = {
                lat:pos.coords.latitude,
                lng:pos.coords.longitude,
                accuracy:
                  pos.coords.accuracy,
                timestamp:Date.now()
              };

              estado.textContent =
                '✓ GPS capturado · ±' +
                Math.round(
                  pos.coords.accuracy
                ) +
                ' m';
            },

            function(){

              estado.textContent =
                'No se pudo obtener GPS';
            },

            {
              enableHighAccuracy:true,
              timeout:12000,
              maximumAge:15000
            }
          );
      }
    );
}


/* ========================================================
   FINALIZAR
   ======================================================== */



function renderTermino(tipo){

  const r = root();

  if(!r) return;

  const inicio = leerInicio(tipo);

  r.innerHTML = `
    <section class="upv-panel-final upv-final-amigable">

      ${volverBtn()}

      <header class="upv-panel-title">
        <h2>${
          String(tipo).toUpperCase() === 'DESCARGA'
            ? '✅ FINALIZÓ DESCARGA'
            : '✅ FINALIZÓ CARGA'
        }</h2>
        <p>
          Registra el cierre de la actividad.
        </p>
      </header>

      ${
        inicio
        ? `
          <div class="upv-inicio-previo">
            <span>◷</span>

            <div>
              <small>
                Inicio registrado
              </small>

              <strong>
                ${inicio.fecha} · ${inicio.hora}
              </strong>
            </div>
          </div>
        `
        : `
          <div class="upv-warning-final">
            ⚠️ No existe un INICIO registrado.
          </div>
        `
      }

      ${
        String(tipo).toUpperCase() === 'CARGA'
          ? `
<!-- VOLUMEN M3 + BBL AUTOMÁTICO -->

      <div class="upv-final-field">

        <label class="upv-amigable-titulo">
          ${
            String(tipo).toUpperCase() === 'DESCARGA'
              ? '💧 ¿CUÁNTO DESCARGASTE?'
              : '💧 ¿CUÁNTO CARGASTE?'
          }
        </label>

        <small class="upv-amigable-ayuda">
          Escribe solamente los metros cúbicos
        </small>

        <div class="upv-volumen-grid">

          <div class="upv-volumen-box">

            <span>
              METROS CÚBICOS (m³)
            </span>

            <div class="upv-volumen-input-wrap">

              <input
                id="upvFinalCantidadM3"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="upv-volumen-input">

              <strong>
                m³
              </strong>

            </div>

          </div>


          <div class="upv-volumen-box calculado">

            <span>
              ≈ BARRILES AUTOMÁTICOS
            </span>

            <div class="upv-volumen-input-wrap">

              <input
                id="upvFinalCantidadBbl"
                type="text"
                value="0.00"
                readonly
                tabindex="-1"
                class="upv-volumen-input">

              <strong>
                BBLS
              </strong>

            </div>

          </div>

        </div>

        <small class="upv-conversion-info">
          Conversión automática ·
          1 m³ = 6.28981 BBLS
        </small>

      </div>


      
      

                  
          `
          : ''
      }

      <div class="upv-final-field">

        <label class="upv-amigable-titulo">
          📍 ¿A DÓNDE VAS?
        </label>

        <small class="upv-amigable-ayuda">
          Selecciona el destino
        </small>

        <select
          id="upvFinalDestino"
          class="upv-final-control">

          <option value="">
            Seleccionar destino...
          </option>

          <option value="POZO">
            🛢️ POZO
          </option>

          <option value="BSC">
            🏢 BSC
          </option>

          <option value="ECO">
            🌿 ECO
          </option>

          <option value="PIA">
            🏭 PIA
          </option>

          <option value="BASE">
            🏠 BASE
          </option>

        </select>

      </div>

      <div
        id="upvFinalPozoWrap"
        class="upv-final-field"
        hidden>

        <label>
          SELECCIONAR POZO
        </label>

        <select
          id="upvFinalPozo"
          class="upv-final-control">

          ${listaPozos()}

        </select>
      </div>




<div class="upv-obs-operacion">

        <div class="upv-obs-operacion-head">
          <span>📝</span>

          <div>
            <strong>¿OCURRIÓ ALGO?</strong>
            <small>Opcional</small>
          </div>
        </div>

        <textarea
          id="upvFinalObsOperacionTermino"
          class="upv-obs-operacion-textarea"
          maxlength="500"
          rows="4"
          placeholder="Escribe aquí si ocurrió algún problema..."></textarea>

        <div class="upv-obs-operacion-counter">
          <span id="upvObsTerminoContador">0</span>/500
        </div>

      </div>



      


      


      ${evidenciaFotoHtml()}

<button
        type="button"
        id="upvFinalTerminoBtn"
        class="upv-action-final termino">

        ${
          String(tipo).toUpperCase() === 'DESCARGA'
            ? '✅ FINALIZÓ DESCARGA'
            : '✅ FINALIZÓ CARGA'
        }

      </button>

      ${evidenciaGpsHtml()}


    </section>
  `;

  activarBack();

  conectarPozo(
    'upvFinalDestino'
  );

  montarSelectorPozoVisual(
    'upvFinalPozo'
  );

  conectarContadorObservacion(
    'upvFinalObsOperacionTermino',
    'upvObsTerminoContador'
  );

  activarEvidencia();

  activarPanelPermisosUPV();




  /* =============================================
     CONVERSIÓN AUTOMÁTICA M3 → BBLS
     ============================================= */

  const inputM3 =
    document.getElementById(
      'upvFinalCantidadM3'
    );

  const inputBbl =
    document.getElementById(
      'upvFinalCantidadBbl'
    );

  function convertir(){

    const m3 = Number(
      inputM3?.value || 0
    );

    const bbl =
      Number.isFinite(m3)
        ? m3 * 6.28981
        : 0;

    if(inputBbl){
      inputBbl.value =
        bbl.toFixed(2);
    }
  }

  inputM3?.addEventListener(
    'input',
    convertir
  );

  convertir();



  /* =============================================
     CONFIRMACIÓN FINALIZAR
     ============================================= */

  document
    .getElementById(
      'upvFinalTerminoBtn'
    )
    .addEventListener(
      'click',
      async function(){

        if(!unidad()){

          error(
            'Selecciona primero la unidad.'
          );

          return;
        }

        const destino =
          document.getElementById(
            'upvFinalDestino'
          ).value;

        if(!destino){

          error(
            'Selecciona dónde termina.'
          );

          return;
        }

        const pozo =
          document.getElementById(
            'upvFinalPozo'
          )?.value || '';

        if(
          destino === 'POZO' &&
          !pozo
        ){

          error(
            'Selecciona el pozo.'
          );

          return;
        }

        const esTerminoDescarga =
          String(tipo).toUpperCase() ===
          'DESCARGA';


        const cantidadM3 =
          esTerminoDescarga
            ? Number(
                inicio?.cantidadM3 ||
                inicio?.volumenDescargaM3 ||
                0
              )
            : Number(
                inputM3?.value || 0
              );

        if(
          !Number.isFinite(cantidadM3) ||
          cantidadM3 <= 0
        ){

          error(
            'Ingresa una cantidad válida en m³.'
          );

          return;
        }

        const cantidadBbl =
          esTerminoDescarga
            ? Number(
                inicio?.cantidadBbl ||
                (
                  cantidadM3 *
                  6.28981
                )
              )
            : cantidadM3 * 6.28981;

        const lugarPreview =
          destino === 'POZO'
            ? formatoPozoUPV(pozo)
            : destino;

        const observacionesOperacion =
          leerObservacionOperacion(
            'FINALIZAR'
          );


        const ubicacionTermino =
          ubicacionInicioGuardadoUPV(
            inicio
          );

        const gpsValidacionTermino =
          await validarGPSOperacionUPV(
            destino,
            pozo
          );


        const mensajeWA =
          mensajeWhatsappTermino({
            ubicacionTermino:
              ubicacionTermino,

            observacionesOperacion:
              observacionesOperacion,

            gps:
              gpsValidacionTermino,


            tipo,

            empresa:
              empresaActiva(),

            unidad:
              unidad(),

            destino,

            pozo,

            cantidadM3,

            cantidadBbl,

            inicio
          });


        const ok =
          await confirmarUPVVisual({
            ubicacionTermino:
              ubicacionTermino,

            observacionesOperacion:
              observacionesOperacion,

            gps:
              gpsValidacionTermino,


            etapa:'FINALIZAR',

            mensajeWhatsapp:
              mensajeWA,

            resumenHtml:`
              <div class="upv-confirm-row">
                <span>PROVEEDOR</span>
                <strong>
                  ${escaparHtml(
                    empresaActiva()
                  )}
                </strong>
              </div>

              <div class="upv-confirm-row">
                <span>UNIDAD</span>
                <strong>
                  ${escaparHtml(
                    unidad()
                  )}
                </strong>
              </div>

              <div class="upv-confirm-row">
                <span>OPERACIÓN</span>
                <strong>
                  ${escaparHtml(tipo)}
                </strong>
              </div>

              <div class="upv-confirm-row">
                <span>SE DIRIGE A</span>
                <strong>
                  ${escaparHtml(
                    lugarPreview
                  )}
                </strong>
              </div>

              <div class="upv-confirm-row volumen">
                <span>VOLUMEN</span>

                <strong>
                  ${cantidadM3.toFixed(2)}
                  m³
                </strong>

                <small>
                  ${cantidadBbl.toFixed(2)}
                  BBLS
                </small>
              </div>
            `
          });


        if(!ok){
          return;
        }

        const momento =
          horaActual();

        const unidadData =
          leerUnidadSeleccionada();


        const registro = {

          tipo,

          subtipo:'FINALIZAR',

          empresa:
            empresaActiva(),

          unidad:
            unidad(),

          capacidadUnidadM3:
            unidadData?.capacidadM3 || null,

          origen:
            inicio?.origen || null,

          pozoOrigen:
            inicio?.pozo || null,

          destino,

          pozoDestino:
            pozo || null,


          /* Volumen principal */
          cantidadM3:
            Number(
              cantidadM3.toFixed(2)
            ),

          /* Conversión automática */
          cantidadBbl:
            Number(
              cantidadBbl.toFixed(2)
            ),

          unidadVolumen:
            'm3',

          factorConversionBbl:
            6.28981,


          fechaInicio:
            inicio?.fecha || null,

          horaInicio:
            inicio?.hora || null,

          inicioTimestamp:
            inicio?.timestamp || null,

          fechaTermino:
            momento.fecha,

          horaTermino:
            momento.hora,

          terminoTimestamp:
            momento.timestamp,

          gps:
            window.UPV_FINAL_GPS || null,

          /*
           * Texto EXACTO que el operador acaba
           * de confirmar en la vista previa.
           */
          mensajeWhatsapp:
            mensajeWA,

          observaciones:
            observacionesOperacion,

          etapa:
            'FINALIZAR',

          createdAt:
            new Date().toISOString()
        };


        window.UPV_FINAL_REGISTRO =
          registro;


        /*
         * PUENTE HACIA EL SISTEMA OFFLINE-FIRST UPV.
         *
         * Primero queda en IndexedDB.
         * Después upv.js decide cuándo sincronizar Firebase.
         *
         * NO existe envío directo a UltraMsg aquí.
         */
        try{

          if(
            typeof window.guardarRegistroFinalUPV ===
            'function'
          ){

            await window.guardarRegistroFinalUPV(
              registro
            );

            console.log(
              '[UPV-FINAL] FINALIZAR conectado a IndexedDB'
            );

          }else{

            console.warn(
              '[UPV-FINAL] guardarRegistroFinalUPV no disponible'
            );

          }

        }catch(errorPuente){

          console.error(
            '[UPV-FINAL] Error guardando FINALIZAR:',
            errorPuente
          );

          /*
           * No rompemos la operación visual.
           * El registro sigue disponible en
           * window.UPV_FINAL_REGISTRO.
           */
        }


        
          /*
           * Si acaba de finalizar una CARGA
           * iniciada en un POZO, conservarla
           * para el próximo INICIO DE DESCARGA.
           */
          if(
            String(tipo).toUpperCase() === 'CARGA' &&
            inicio?.origen
          ){

            const origenCarga =
              String(
                inicio.origen || ''
              )
              .trim()
              .toUpperCase();


            const referenciaCarga =
              origenCarga === 'POZO'
                ? String(
                    inicio.pozo || ''
                  ).trim()
                : origenCarga;


            if(referenciaCarga){

              registrarPozoCargadoPendiente({

                /*
                 * Compatibilidad:
                 * mantenemos `pozo` porque el manifiesto
                 * existente ya trabaja con este campo.
                 *
                 * Ahora puede contener:
                 * 106D / 119 / ECO / PIA / BASE...
                 */
                pozo:
                  referenciaCarga,

                origen:
                  origenCarga,

                esPozo:
                  origenCarga === 'POZO',

                fecha:
                  momento.fecha,

                hora:
                  momento.hora,

                timestamp:
                  momento.timestamp,

                volumenM3:
                  cantidadM3,

                /*
                 * DESTINO DEFINIDO EN FINALIZÓ CARGA.
                 * Inicio Descarga NO volverá a preguntarlo.
                 */
                destino:
                  String(
                    destino || ''
                  ).trim().toUpperCase(),

                /*
                 * lugarPreview YA contiene el destino
                 * real que se mostró en FINALIZÓ CARGA.
                 *
                 * Ejemplos:
                 * POZO -> C-107
                 * ECO  -> ECO
                 * PIA  -> PIA
                 */
                destinoNombre:
                  String(
                    lugarPreview || destino || ''
                  ).trim(),

                destinoPozo:
                  String(destino || '').toUpperCase() === 'POZO'
                    ? String(
                        lugarPreview || ''
                      )
                      .trim()
                      .replace(/^C[-\s]*/i,'')
                    : ''

              });

            }

          }

          /*
           * Al terminar una DESCARGA,
           * retirar solamente las cargas
           * que formaron parte de ella.
           */
          if(
            String(tipo).toUpperCase() === 'DESCARGA' &&
            Array.isArray(
              inicio?.cargasSeleccionadasIds
            )
          ){

            quitarPozosDescargados(
              inicio.cargasSeleccionadasIds
            );

          }


          borrarInicio(tipo);


        const panel =
          document.querySelector(
            '.upv-panel-final'
          );

        panel.innerHTML = `
          <div
            class="upv-registro-ok termino-ok">

            <div class="check">
              ✓
            </div>

            <strong>
              FINALIZACIÓN REGISTRADA
            </strong>

            <span>
              ${momento.fecha} ·
              ${momento.hora}
            </span>

            <div class="upv-volumen-resumen">

              <b>
                ${cantidadM3.toFixed(2)} m³
              </b>

              <small>
                ${cantidadBbl.toFixed(2)}
                BBLS
              </small>

            </div>

          </div>
        `;

        console.log(
          '[UPV FINAL]',
          registro
        );
      }
    );
}


/* ========================================================
   OBSERVACIONES
   ======================================================== */

function renderObs(){

  const r = root();

  if(!r) return;

  r.innerHTML = `
    <section class="upv-panel-final">

      ${volverBtn()}

      <header class="upv-panel-title">
        <strong>OBSERVACIONES</strong>
        <h2>Registro de campo</h2>
      </header>

      <div class="upv-final-field">

        <label>
          UNIDAD (NÚMERO DE PIPA)
        </label>

        <input
          type="text"
          value="${unidad()}"
          placeholder="Ej: 124"
          class="upv-final-control"
          id="upvFinalObsUnidad">

      </div>

      <div class="upv-final-field">

        <label>
          TIPO DE OBSERVACIÓN
        </label>

        <select
          id="upvFinalObsTipo"
          class="upv-final-control">

          <option value="">
            Seleccionar tipo...
          </option>

          <option>
            Operativa
          </option>

          <option>
            Unidad
          </option>

          <option>
            Seguridad
          </option>

          <option>
            Instalación
          </option>

          <option>
            Otro
          </option>

        </select>

      </div>

      <div class="upv-final-field">

        <label>DESCRIPCIÓN</label>

        <textarea
          id="upvFinalObsTexto"
          class="upv-final-control upv-final-textarea"
          placeholder="Escribe aquí tu observación...">
        </textarea>

      </div>

      ${evidenciaHtml()}

      <button
        type="button"
        class="upv-action-final observacion"
        id="upvFinalGuardarObs">
        💾 GUARDAR OBSERVACIÓN
      </button>

    </section>
  `;

  activarBack();
  activarEvidencia();

  activarPanelPermisosUPV();
}


/* ========================================================
   ABRIR FLUJO
   ======================================================== */

function abrir(flow){

  console.log(
    '[UPV OPERACION] Abriendo:',
    flow
  );

  const contenedor = root();

  if(!contenedor){
    console.error(
      '[UPV OPERACION] No existe contenedor de formulario'
    );
    return;
  }

  switch(flow){

    case 'CARGA_INICIO':
      renderInicio('CARGA');
      break;

    case 'CARGA_FINALIZAR':
      renderTermino('CARGA');
      break;

    case 'DESCARGA_INICIO':
      renderInicio('DESCARGA');
      break;

    case 'DESCARGA_FINALIZAR':
      renderTermino('DESCARGA');
      break;

    case 'OBS':
      renderObs();
      break;
  }
}


/* ========================================================
   INSTALAR
   ======================================================== */

function instalar(){

  if(!instalarMenu()){
    return false;
  }

  if(!root()){
    return false;
  }

  document.body.classList.add(
    'upv-operacion-final-activa'
  );

  instalarSelectorUnidad(false);

  return true;
}


function iniciar(){

  if(instalar()) return;

  let intentos = 0;

  const timer = setInterval(
    function(){

      intentos++;

      if(
        instalar() ||
        intentos >= 30
      ){
        clearInterval(timer);
      }

    },
    250
  );
}


if(
  document.readyState ===
  'loading'
){
  document.addEventListener(
    'DOMContentLoaded',
    iniciar,
    {once:true}
  );
}else{
  iniciar();
}


/*
 * Al entrar nuevamente a la pantalla UPV,
 * hacemos una comprobación ligera.
 * NO MutationObserver.
 */
document.addEventListener(
  'click',
  function(e){

    const texto = txt(
      e.target.textContent
    );

    if(
      texto === 'UPV' ||
      texto.includes('PETROSMART') ||
      texto.includes('IPEP')
    ){
      setTimeout(instalar,120);
    }
  }
);


/*
 * Cuando cambie PETROSMART / IPEP,
 * olvidar la unidad anterior.
 */
document.addEventListener(
  'click',
  function(event){

    const texto = txt(
      event.target.textContent
    );

    if(
      texto === 'PETROSMART' ||
      texto === 'IPEP'
    ){

      try{
        sessionStorage.removeItem(
          'upv_unidad_operativa'
        );
      }catch(e){}

      setTimeout(
        function(){
          instalarSelectorUnidad(true);
        },
        180
      );
    }
  },
  false
);


window.UPVOperacionFinal = {
  abrir,
  pozos:POZOS.slice(),
  getInicio:leerInicio,
  getUnidad:leerUnidadSeleccionada
};

})();

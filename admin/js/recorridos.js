/* ============================================================
   RECORRIDOS DE CAMPO — CUICHAPA
   Módulo independiente
   ============================================================ */

(function(){

  'use strict';

  const R = {

    mapa: null,
    capas: [],
    linea: null,

    modo: 'otros',
    subtipo: 'todos',
    recorredor: '',
    fecha: '',

    colores: {
      nivel:    '#dc2626',
      visita:   '#2563eb',
      cabezal:  '#16a34a',
      estacion: '#7c3aed',
      aforo:    '#f59e0b',
      nota:     '#111827'
    }

  };


  /* ==========================================================
     NORMALIZAR TEXTO
     ========================================================== */

  function txt(v){
    return String(v == null ? '' : v).trim();
  }


  /* ==========================================================
     MENSAJE DEL REPORTE
     ========================================================== */

  function mensaje(r){

    return txt(
      r.mensaje ||
      r.message ||
      r.texto ||
      r.msg ||
      ''
    ).toUpperCase();

  }


  /* ==========================================================
     CLASIFICAR REPORTE
     ========================================================== */

  function tipoReporte(r){

    if(!r){
      return '';
    }

    const msg =
      String(
        r.msg ||
        r.mensaje ||
        r.message ||
        r.texto ||
        ''
      )
      .trim()
      .toUpperCase();


    const modo =
      String(
        r.modo ||
        r.tipo ||
        r.tipoReporte ||
        ''
      )
      .trim()
      .toUpperCase();


    const lugar =
      String(
        r.lugar ||
        r.ubicacionNombre ||
        r.nombre ||
        ''
      )
      .trim()
      .toUpperCase();


    /*
     * ========================================================
     * PRIORIDAD 1
     * EL CONTENIDO REAL DEL REPORTE MANDA.
     *
     * Esto evita que una NOTA con modo="co"
     * termine pintada como visita azul.
     * ========================================================
     */

    if(
      msg.includes('NIVELES DE GUARDIA') ||
      msg.includes('NIVEL DE GUARDIA')
    ){
      return 'nivel';
    }


    if(
      msg.includes('AFORO') ||
      msg.includes('PROYECCION') ||
      msg.includes('PROYECCIÓN')
    ){
      return 'aforo';
    }


    if(
      msg.includes('NOTA DE CAMPO') ||
      lugar === 'NOTA'
    ){
      return 'nota';
    }


    if(
      msg.includes('REPORTE CABEZAL') ||
      msg.includes('CABEZAL') ||
      lugar.includes('CABEZAL')
    ){
      return 'cabezal';
    }


    if(
      msg.includes('ESTACION') ||
      msg.includes('ESTACIÓN') ||
      lugar.includes('ESTACION') ||
      lugar.includes('ESTACIÓN')
    ){
      return 'estacion';
    }


    if(
      msg.includes('REPORTE DE VISITA') ||
      msg.includes('CONTROL OPERATIVO')
    ){
      return 'visita';
    }


    /*
     * ========================================================
     * PRIORIDAD 2
     * RESPALDO POR EL CAMPO modo.
     * ========================================================
     */

    if(
      modo === 'GUARDIA' ||
      modo === 'NIVEL' ||
      modo === 'NIVELES'
    ){
      return 'nivel';
    }


    if(
      modo === 'AFORO' ||
      modo.includes('PROYECCION') ||
      modo.includes('PROYECCIÓN')
    ){
      return 'aforo';
    }


    if(
      modo === 'NOTA' ||
      modo === 'NOTA DE CAMPO'
    ){
      return 'nota';
    }


    if(
      modo === 'CABEZAL'
    ){
      return 'cabezal';
    }


    if(
      modo === 'ESTACION' ||
      modo === 'ESTACIÓN'
    ){
      return 'estacion';
    }


    /*
     * CO queda AL FINAL.
     */
    if(
      modo === 'CO'
    ){
      return 'visita';
    }


    return '';

  }

  function gpsReporte(r){

    if(!r){
      return null;
    }


    /* ========================================================
       1. ESTRUCTURAS GPS DIRECTAS
       ======================================================== */

    const candidatos = [

      r.gps,

      r.ubicacion,

      r.location,

      r.coords,

      r.coordinates,

      r.coordenadas

    ];


    for(const obj of candidatos){

      if(
        !obj ||
        typeof obj !== 'object'
      ){
        continue;
      }


      const lat =
        Number(
          obj.lat ??
          obj.latitude ??
          obj.latitud
        );


      const lng =
        Number(
          obj.lng ??
          obj.lon ??
          obj.longitude ??
          obj.longitud
        );


      if(
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      ){

        return {

          lat,

          lng,

          precision:
            obj.precision ??
            obj.accuracy ??
            null,

          rango:
            obj.rango ??
            null,

          source:'gps'

        };

      }

    }


    /* ========================================================
       2. CAMPOS DIRECTOS DEL REPORTE
       ======================================================== */

    const latDirecta =
      Number(
        r.lat ??
        r.latitude ??
        r.latitud ??
        r.gpsLat
      );


    const lngDirecta =
      Number(
        r.lng ??
        r.lon ??
        r.longitude ??
        r.longitud ??
        r.gpsLng ??
        r.gpsLon
      );


    if(
      Number.isFinite(latDirecta) &&
      Number.isFinite(lngDirecta) &&
      Math.abs(latDirecta) <= 90 &&
      Math.abs(lngDirecta) <= 180
    ){

      return {

        lat:latDirecta,

        lng:lngDirecta,

        source:'direct'

      };

    }


    /* ========================================================
       3. GPS CONTENIDO EN EL MENSAJE
       
       Ejemplos reales:
       GPS: 17.923303, -94.292733
       maps.google.com/?q=17.923303,-94.292733
       ======================================================== */

    const texto =
      String(
        r.msg ||
        r.mensaje ||
        r.message ||
        r.texto ||
        ''
      );


    const patrones = [

      /GPS\s*:\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i,

      /maps\.google\.com\/\?q=(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i,

      /[?&]q=(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i

    ];


    for(const patron of patrones){

      const m =
        texto.match(patron);

      if(!m){
        continue;
      }


      const lat =
        Number(m[1]);

      const lng =
        Number(m[2]);


      if(
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      ){

        return {

          lat,

          lng,

          source:'mensaje'

        };

      }

    }


    return null;

  }

  function nombreRecorredor(r){

    return txt(
      r.recorredor ||
      r.usuario ||
      r.nombre ||
      r.operador ||
      r.user ||
      ''
    );

  }


  /* ==========================================================
     FECHA / HORA
     ========================================================== */

  function timestampReporte(r){

    if(!r){
      return null;
    }


    /*
     * 1. ID FIREBASE / ID DEL REPORTE
     */
    const idNum =
      Number(r.id);

    if(
      Number.isFinite(idNum) &&
      idNum > 1000000000000
    ){
      return idNum;
    }


    /*
     * 2. CAMPOS NUMÉRICOS
     */
    const numericos = [

      r.timestamp,
      r.ts,
      r.createdAt,
      r.fechaMs,
      r.time

    ];


    for(const valor of numericos){

      let n =
        Number(valor);

      if(!Number.isFinite(n)){
        continue;
      }

      /*
       * Timestamp en segundos.
       */
      if(
        n > 1000000000 &&
        n < 100000000000
      ){
        n *= 1000;
      }

      if(n > 1000000000000){
        return n;
      }

    }


    /*
     * 3. FECHA ISO / TEXTO
     */
    const textos = [

      r.fecha,
      r.fechaHora,
      r.datetime,
      r.date

    ];


    for(const valor of textos){

      if(!valor){
        continue;
      }

      const t =
        Date.parse(
          String(valor)
        );

      if(Number.isFinite(t)){
        return t;
      }

    }


    /*
     * 4. dd/mm/yyyy + hora
     */
    const fechaTxt =
      String(
        r.fechaTexto ||
        r.fechaLocal ||
        ''
      ).trim();


    if(fechaTxt){

      const m =
        fechaTxt.match(
          /(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );

      if(m){

        const d =
          Number(m[1]);

        const mes =
          Number(m[2]) - 1;

        const y =
          Number(m[3]);

        const dt =
          new Date(
            y,
            mes,
            d,
            12,
            0,
            0
          );

        if(
          !Number.isNaN(
            dt.getTime()
          )
        ){
          return dt.getTime();
        }

      }

    }


    return null;

  }


  /* ==========================================================
     DISTANCIA HAVERSINE
     ========================================================== */

  function distanciaKm(a,b){

    if(!a || !b){
      return 0;
    }

    const Rkm = 6371;

    const rad = x =>
      x * Math.PI / 180;


    const dLat =
      rad(b.lat - a.lat);

    const dLng =
      rad(b.lng - a.lng);


    const x =
      Math.sin(dLat/2) ** 2 +
      Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(dLng/2) ** 2;


    return (
      Rkm *
      2 *
      Math.atan2(
        Math.sqrt(x),
        Math.sqrt(1-x)
      )
    );

  }


  /* ==========================================================
     VELOCIDAD ESTIMADA
     ========================================================== */

  function velocidadEntre(a,b){

    if(
      !a ||
      !b ||
      !a.ts ||
      !b.ts
    ){
      return null;
    }


    const horas =
      (b.ts - a.ts) / 3600000;


    if(horas <= 0){
      return null;
    }


    const km =
      distanciaKm(
        a.gps,
        b.gps
      );


    return km / horas;

  }


  /* ==========================================================
     EXPONER MOTOR
     ========================================================== */

  window.RecorridosCampo = {

    estado: R,

    tipoReporte,
    gpsReporte,
    nombreRecorredor,
    timestampReporte,
    distanciaKm,
    velocidadEntre

  };


  console.log(
    '[RECORRIDOS] Motor cargado correctamente'
  );

})();


/* ============================================================
   NAVEGACIÓN PRODUCCIÓN ↔ RECORRIDOS
   ============================================================ */

(function(){

  function abrirRecorridos(){

    const produccion =
      document.getElementById(
        'pozosView'
      );

    const recorridos =
      document.getElementById(
        'recorridosSubView'
      );

    if(!produccion || !recorridos){
      return;
    }

    produccion.classList.add(
      'hidden'
    );

    recorridos.classList.remove(
      'hidden'
    );

    document
      .documentElement
      .scrollTo({
        top:0,
        behavior:'smooth'
      });


    /*
     * El mapa se conectará después.
     * Aquí únicamente abrimos el subacceso.
     */
    window.dispatchEvent(
      new CustomEvent(
        'recorridos:abrir'
      )
    );

  }


  function volverProduccion(){

    const produccion =
      document.getElementById(
        'pozosView'
      );

    const recorridos =
      document.getElementById(
        'recorridosSubView'
      );

    if(!produccion || !recorridos){
      return;
    }

    recorridos.classList.add(
      'hidden'
    );

    produccion.classList.remove(
      'hidden'
    );

  }


  function instalarNavegacionRecorridos(){

    const abrir =
      document.getElementById(
        'btnAbrirRecorridos'
      );

    const volver =
      document.getElementById(
        'btnVolverProduccionRecorridos'
      );


    if(abrir && !abrir.dataset.recorridosReady){

      abrir.dataset.recorridosReady =
        '1';

      abrir.addEventListener(
        'click',
        abrirRecorridos
      );

    }


    if(volver && !volver.dataset.recorridosReady){

      volver.dataset.recorridosReady =
        '1';

      volver.addEventListener(
        'click',
        volverProduccion
      );

    }

  }


  if(
    document.readyState ===
    'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      instalarNavegacionRecorridos
    );

  }else{

    instalarNavegacionRecorridos();

  }


  window.abrirRecorridos =
    abrirRecorridos;

  window.volverProduccionRecorridos =
    volverProduccion;

})();


/* ============================================================
   DATOS REALES DE REPORTES
   ============================================================ */

(function(){

  function fechaISO(ts){

    if(!ts){
      return '';
    }

    const d =
      new Date(ts);

    if(Number.isNaN(d.getTime())){
      return '';
    }

    return [
      d.getFullYear(),
      String(d.getMonth()+1).padStart(2,'0'),
      String(d.getDate()).padStart(2,'0')
    ].join('-');

  }


  function reportesBase(){

    const fuente =
      window.AdminFirebase?.reportes;

    if(!Array.isArray(fuente)){
      return [];
    }

    return fuente
      .map(function(r){

        let tipo =
          window.RecorridosCampo
            .tipoReporte(r);


        /*
         * Refuerzo de clasificación usando los datos
         * REALES almacenados en Firebase.
         */
        const modoReal =
          String(
            r.modo ||
            r.tipo ||
            ''
          )
          .trim()
          .toUpperCase();


        const msgReal =
          String(
            r.msg ||
            r.mensaje ||
            ''
          )
          .trim()
          .toUpperCase();


        /*
         * Las categorías específicas tienen prioridad
         * sobre el modo CO.
         */

        if(
          modoReal === 'AFORO' ||
          msgReal.includes('AFORO') ||
          msgReal.includes('PROYECCION') ||
          msgReal.includes('PROYECCIÓN')
        ){
          tipo = 'aforo';
        }

        else if(
          modoReal === 'NOTA' ||
          msgReal.includes('NOTA DE CAMPO')
        ){
          tipo = 'nota';
        }

        else if(
          modoReal === 'CABEZAL' ||
          msgReal.includes('CABEZAL')
        ){
          tipo = 'cabezal';
        }

        else if(
          modoReal === 'ESTACION' ||
          modoReal === 'ESTACIÓN' ||
          msgReal.includes('ESTACION') ||
          msgReal.includes('ESTACIÓN')
        ){
          tipo = 'estacion';
        }

        else if(
          modoReal === 'GUARDIA' ||
          msgReal.includes('NIVELES DE GUARDIA') ||
          msgReal.includes('NIVEL DE GUARDIA')
        ){
          tipo = 'nivel';
        }

        else if(
          modoReal === 'CO'
        ){
          tipo = 'visita';
        }

        const gps =
          window.RecorridosCampo
            .gpsReporte(r);

        const persona =
          window.RecorridosCampo
            .nombreRecorredor(r);

        const ts =
          window.RecorridosCampo
            .timestampReporte(r);

        return {
          source:r,
          tipo,
          gps,
          persona,
          ts,
          fecha:fechaISO(ts)
        };

      })
      .filter(function(r){

        return (
          r.tipo &&
          r.gps &&
          r.ts
        );

      });

  }


  function llenarRecorredores(){

    const select =
      document.getElementById(
        'recorridosPersona'
      );

    if(!select){
      return;
    }

    const actual =
      select.value;

    const nombres =
      Array.from(
        new Set(
          reportesBase()
            .map(r => r.persona)
            .filter(Boolean)
        )
      )
      .sort((a,b) =>
        a.localeCompare(
          b,
          'es',
          {sensitivity:'base'}
        )
      );

    select.innerHTML =
      '<option value="">Todos los recorredores</option>' +
      nombres
        .map(function(nombre){
          return (
            '<option value="' +
            nombre.replace(/"/g,'&quot;') +
            '">' +
            nombre +
            '</option>'
          );
        })
        .join('');

    if(
      actual &&
      nombres.includes(actual)
    ){
      select.value = actual;
    }

  }


  function filtrarReportes(){

    const fecha =
      document.getElementById(
        'recorridosFecha'
      )?.value || '';

    const persona =
      document.getElementById(
        'recorridosPersona'
      )?.value || '';

    const modo =
      window.RecorridosCampo
        .estado.modo;


    return reportesBase()
      .filter(function(r){

        if(
          fecha &&
          r.fecha !== fecha
        ){
          return false;
        }

        if(
          persona &&
          r.persona !== persona
        ){
          return false;
        }

        if(modo === 'nivel'){
          return r.tipo === 'nivel';
        }

        return (
          r.tipo === 'visita' ||
          r.tipo === 'cabezal' ||
          r.tipo === 'estacion' ||
          r.tipo === 'aforo' ||
          r.tipo === 'nota'
        );

      })
      .sort(
        (a,b) =>
          a.ts - b.ts
      );

  }


  function nombrePunto(r){

    const src =
      r.source || {};

    return String(
      src.pozo ||
      src.lugar ||
      src.nombre ||
      src.estacion ||
      src.cabezal ||
      src.ubicacionNombre ||
      'Punto'
    ).trim();

  }


  function actualizarResumenSimple(){

    const filas =
      filtrarReportes();

    const empty =
      document.getElementById(
        'recorridosEmpty'
      );

    const resumen =
      document.getElementById(
        'recorridosResumen'
      );

    const total =
      document.getElementById(
        'recorridosTotalPuntos'
      );

    const ultimo =
      document.getElementById(
        'recorridosUltimoPunto'
      );

    if(total){
      total.textContent =
        String(filas.length);
    }

    if(ultimo){

      ultimo.textContent =
        filas.length
          ? nombrePunto(
              filas[filas.length-1]
            )
          : '—';

    }

    if(empty){

      empty.classList.toggle(
        'hidden',
        filas.length > 0
      );

    }

    if(resumen){

      resumen.classList.toggle(
        'hidden',
        filas.length === 0
      );

    }

    window.RECORRIDOS_FILTRADOS =
      filas;

    console.log(
      '[RECORRIDOS] filtrados:',
      filas.length,
      filas
    );

  }


  function cambiarModo(modo){

    window.RecorridosCampo
      .estado.modo = modo;


    document
      .querySelectorAll(
        '[data-recorridos-modo]'
      )
      .forEach(function(btn){

        btn.classList.toggle(
          'active',
          btn.dataset.recorridosModo === modo
        );

      });


    actualizarResumenSimple();

  }


  function fechaHoy(){

    const d =
      new Date();

    return [
      d.getFullYear(),
      String(d.getMonth()+1).padStart(2,'0'),
      String(d.getDate()).padStart(2,'0')
    ].join('-');

  }


  function instalarDatosRecorridos(){

    const fecha =
      document.getElementById(
        'recorridosFecha'
      );

    const persona =
      document.getElementById(
        'recorridosPersona'
      );

    const otros =
      document.getElementById(
        'recorridosBtnOtros'
      );

    const nivel =
      document.getElementById(
        'recorridosBtnNivel'
      );


    if(fecha && !fecha.value){
      fecha.value = fechaHoy();
    }


    llenarRecorredores();


    fecha?.addEventListener(
      'change',
      actualizarResumenSimple
    );


    persona?.addEventListener(
      'change',
      actualizarResumenSimple
    );


    otros?.addEventListener(
      'click',
      function(){
        cambiarModo('otros');
      }
    );


    nivel?.addEventListener(
      'click',
      function(){
        cambiarModo('nivel');
      }
    );


    actualizarResumenSimple();

  }


  window.addEventListener(
    'recorridos:abrir',
    function(){

      llenarRecorredores();

      actualizarResumenSimple();

    }
  );


  if(
    document.readyState ===
    'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      function(){

        setTimeout(
          instalarDatosRecorridos,
          600
        );

      }
    );

  }else{

    setTimeout(
      instalarDatosRecorridos,
      600
    );

  }


  window.RecorridosCampo.reportesBase =
    reportesBase;

  window.RecorridosCampo.filtrarReportes =
    filtrarReportes;

  window.RecorridosCampo.actualizar =
    actualizarResumenSimple;

})();


/* ============================================================
   DATOS REALES PARA RECORRIDOS
   ============================================================ */

(function(){

  function fechaISO(ts){

    if(!ts){
      return '';
    }

    const d = new Date(ts);

    if(Number.isNaN(d.getTime())){
      return '';
    }

    return [
      d.getFullYear(),
      String(d.getMonth()+1).padStart(2,'0'),
      String(d.getDate()).padStart(2,'0')
    ].join('-');

  }


  function reportesRecorridos(){

    /*
     * Fuente de reportes.
     *
     * El Admin ha manejado los reportes con distintas
     * exposiciones globales. No dependemos únicamente de
     * AdminFirebase.reportes.
     */

    const candidatos = [

      window.AdminFirebase?.reportes,

      window.AdminData?.reportes,

      window.adminData?.reportes,

      window.reportes,

      window.REPORTES,

      window.todosLosReportes,

      window.reportesData

    ];

    let fuente = [];

    for(const candidato of candidatos){

      if(Array.isArray(candidato) && candidato.length){

        fuente = candidato;
        break;

      }

      /*
       * Firebase puede entregar un objeto indexado por ID.
       */

      if(
        candidato &&
        typeof candidato === 'object' &&
        !Array.isArray(candidato)
      ){

        const valores =
          Object.values(candidato);

        if(valores.length){

          fuente = valores;
          break;

        }

      }

    }


    /*
     * Último fallback:
     * reutilizar el estado que ya maneja Producción.
     */

    if(
      !fuente.length &&
      Array.isArray(window.AdminPozos?.reports)
    ){
      fuente = window.AdminPozos.reports;
    }


    if(!fuente.length){

      console.warn(
        '[RECORRIDOS] No encontré fuente global de reportes'
      );

      return [];

    }


    console.log(
      '[RECORRIDOS] fuente detectada:',
      fuente.length
    );


    return fuente

      .map(function(r){

        if(!r){
          return null;
        }


        const tipo =
          window.RecorridosCampo
            .tipoReporte(r);


        const persona =
          window.RecorridosCampo
            .nombreRecorredor(r);


        const ts =
          window.RecorridosCampo
            .timestampReporte(r);


        /*
         * GPS capturado por el reporte.
         */

        let gps =
          window.RecorridosCampo
            .gpsReporte(r);


        /*
         * Si el reporte no trae GPS válido,
         * usar coordenada maestra del pozo.
         */

        if(!gps){

          const valorPozo =
            r.pozo ||
            r.pozoNombre ||
            r.well ||
            r.wellName ||
            r.numeroPozo ||
            r.numPozo ||
            r.lugar ||
            '';


          let pozo = String(valorPozo).trim();


          if(
            window.CatalogoPozos &&
            typeof window.CatalogoPozos.normalizarPozo === 'function'
          ){

            pozo =
              window.CatalogoPozos
                .normalizarPozo(pozo);

          }


          const master =
            window.WELL_COORDS_ALL?.[pozo];


          if(
            master &&
            Number.isFinite(Number(master.lat)) &&
            Number.isFinite(
              Number(master.lon ?? master.lng)
            )
          ){

            gps = {

              lat:Number(master.lat),

              lng:Number(
                master.lon ?? master.lng
              ),

              source:'master'

            };

          }

        }


        /*
         * Normalización final.
         */

        if(gps){

          const lat =
            Number(
              gps.lat ??
              gps.latitude ??
              gps.latitud
            );

          const lng =
            Number(
              gps.lng ??
              gps.lon ??
              gps.longitude ??
              gps.longitud
            );


          if(
            Number.isFinite(lat) &&
            Number.isFinite(lng)
          ){

            gps = {
              ...gps,
              lat,
              lng
            };

          }else{

            gps = null;

          }

        }


        return {

          source:r,

          tipo,

          gps,

          persona,

          ts,

          fecha:fechaISO(ts)

        };

      })


      .filter(function(r){

        /*
         * Para formar un recorrido necesitamos:
         *
         * - tipo reconocible
         * - fecha/hora
         * - coordenadas
         *
         * El nombre del recorredor puede resolverse después.
         */

        return (
          r &&
          r.tipo &&
          r.ts &&
          r.gps
        );

      });

  }

  function llenarPersonas(){

    const sel =
      document.getElementById(
        'recorridosPersona'
      );

    if(!sel){
      return;
    }

    const actual = sel.value;

    const nombres =
      Array.from(
        new Set(
          reportesRecorridos()
            .map(r => r.persona)
            .filter(Boolean)
        )
      )
      .sort((a,b) =>
        a.localeCompare(
          b,
          'es',
          {sensitivity:'base'}
        )
      );

    sel.innerHTML =
      '<option value="">Todos los recorredores</option>' +
      nombres
        .map(n =>
          '<option value="' +
          n.replace(/"/g,'&quot;') +
          '">' +
          n +
          '</option>'
        )
        .join('');

    if(
      actual &&
      nombres.includes(actual)
    ){
      sel.value = actual;
    }

  }


  function filtrar(){

    const fecha =
      document.getElementById(
        'recorridosFecha'
      )?.value || '';

    const persona =
      document.getElementById(
        'recorridosPersona'
      )?.value || '';

    const modo =
      window.RecorridosCampo
        .estado.modo;


    return reportesRecorridos()
      .filter(function(r){

        if(
          fecha &&
          r.fecha !== fecha
        ){
          return false;
        }

        if(
          persona &&
          r.persona !== persona
        ){
          return false;
        }

        /*
         * NIVEL DE GUARDIA permanece totalmente separado.
         */
        if(modo === 'nivel'){
          return r.tipo === 'nivel';
        }


        /*
         * OTROS REPORTES.
         */
        const subtipo =
          window.RecorridosCampo
            .estado.subtipo ||
          'todos';


        if(
          subtipo !== 'todos'
        ){
          return r.tipo === subtipo;
        }


        /*
         * TODOS los tipos que pertenecen a Otros reportes.
         */
        return (
          r.tipo === 'visita' ||
          r.tipo === 'aforo' ||
          r.tipo === 'nota' ||
          r.tipo === 'cabezal' ||
          r.tipo === 'estacion'
        );

      })
      .sort((a,b) =>
        a.ts - b.ts
      );

  }


  function fechaHoy(){

    const d = new Date();

    return [
      d.getFullYear(),
      String(d.getMonth()+1).padStart(2,'0'),
      String(d.getDate()).padStart(2,'0')
    ].join('-');

  }


  function actualizarDatos(){

    const filas =
      filtrar();

    window.RECORRIDOS_FILTRADOS =
      filas;

    const empty =
      document.getElementById(
        'recorridosEmpty'
      );

    const mapaWrap =
      document.getElementById(
        'recorridosMapaWrap'
      );

    const resumen =
      document.getElementById(
        'recorridosResumen'
      );

    const total =
      document.getElementById(
        'recorridosTotalPuntos'
      );

    const ultimo =
      document.getElementById(
        'recorridosUltimoPunto'
      );

    if(total){
      total.textContent =
        String(filas.length);
    }

    if(ultimo){

      const r =
        filas[filas.length - 1];

      ultimo.textContent =
        r
          ? (
              r.source.pozo ||
              r.source.lugar ||
              r.source.nombre ||
              'Punto'
            )
          : '—';

    }

    if(empty){
      empty.classList.toggle(
        'hidden',
        filas.length > 0
      );
    }

    if(mapaWrap){
      mapaWrap.classList.toggle(
        'hidden',
        filas.length === 0
      );
    }

    if(resumen){
      resumen.classList.toggle(
        'hidden',
        filas.length === 0
      );
    }

    window.dispatchEvent(
      new CustomEvent(
        'recorridos:datos',
        {
          detail:{
            filas
          }
        }
      )
    );

    console.log(
      '[RECORRIDOS] puntos:',
      filas.length
    );

    const conteoTipos =
      filas.reduce(
        function(acc,r){

          acc[r.tipo] =
            (acc[r.tipo] || 0) + 1;

          return acc;

        },
        {}
      );

    console.log(
      '[RECORRIDOS] por tipo:',
      conteoTipos
    );

  }


  function cambiarModo(modo){

    window.RecorridosCampo
      .estado.modo = modo;

    document
      .querySelectorAll(
        '[data-recorridos-modo]'
      )
      .forEach(function(btn){

        btn.classList.toggle(
          'active',
          btn.dataset.recorridosModo === modo
        );

      });

    actualizarDatos();

  }


  function instalar(){

    const fecha =
      document.getElementById(
        'recorridosFecha'
      );

    const persona =
      document.getElementById(
        'recorridosPersona'
      );

    const otros =
      document.getElementById(
        'recorridosBtnOtros'
      );

    const nivel =
      document.getElementById(
        'recorridosBtnNivel'
      );


    if(fecha && !fecha.value){
      fecha.value = fechaHoy();
    }

    llenarPersonas();

    fecha?.addEventListener(
      'change',
      actualizarDatos
    );

    persona?.addEventListener(
      'change',
      actualizarDatos
    );

    otros?.addEventListener(
      'click',
      function(){
        cambiarModo('otros');
      }
    );

    nivel?.addEventListener(
      'click',
      function(){
        cambiarModo('nivel');
      }
    );

    actualizarDatos();

  }


  window.addEventListener(
    'recorridos:abrir',
    function(){

      llenarPersonas();
      actualizarDatos();

    }
  );


  if(document.readyState === 'loading'){

    document.addEventListener(
      'DOMContentLoaded',
      function(){
        setTimeout(
          instalar,
          700
        );
      }
    );

  }else{

    setTimeout(
      instalar,
      700
    );

  }


  window.RecorridosCampo
    .reportesRecorridos =
      reportesRecorridos;

  window.RecorridosCampo
    .filtrar =
      filtrar;

  window.RecorridosCampo
    .actualizar =
      actualizarDatos;

})();


/* ============================================================
   MAPA DEL RECORRIDO
   ============================================================ */

(function(){

  let map = null;
  let layers = [];
  let recorridoRenderer = null;


  function limpiar(){

    if(!map){
      return;
    }

    layers.forEach(function(l){

      try{
        map.removeLayer(l);
      }catch(e){}

    });

    layers = [];

  }


  function colorTipo(tipo){

    const c =
      window.RecorridosCampo
        .estado.colores;

    return c[tipo] || '#64748b';

  }


  function etiquetaTipo(tipo){

    const m = {
      nivel:'Nivel de Guardia',
      visita:'Reporte de visita',
      cabezal:'Cabezal',
      estacion:'Estación',
      aforo:'Aforo',
      nota:'Nota de campo'
    };

    return m[tipo] || tipo;
  }


  function nombrePunto(item){

    const r =
      item.source || {};

    if(item.tipo === 'nota'){
      return 'Nota de Campo';
    }

    return String(
      r.pozo ||
      r.lugar ||
      r.nombre ||
      r.estacion ||
      r.cabezal ||
      r.ubicacionNombre ||
      etiquetaTipo(item.tipo)
    ).trim();

  }


  function hora(item){

    if(!item.ts){
      return '';
    }

    return new Date(
      item.ts
    ).toLocaleTimeString(
      'es-MX',
      {
        hour:'2-digit',
        minute:'2-digit'
      }
    );

  }


  function iconoNumero(item,numero){

    const color =
      colorTipo(item.tipo);

    return L.divIcon({

      className:
        'recorridos-marker-wrapper',

      html:
        '<div class="recorridos-marker" ' +
        'style="background:' +
        color +
        '">' +
        numero +
        '</div>',

      iconSize:[32,32],

      iconAnchor:[16,16]

    });

  }


  function asegurarMapa(){

    if(map){
      return map;
    }

    const cont =
      document.getElementById(
        'recorridosMapa'
      );

    if(!cont || typeof L === 'undefined'){
      return null;
    }


    map = L.map(
      cont,
      {
        zoomControl:true,
        preferCanvas:true
      }
    ).setView(
      [17.945,-94.285],
      13
    );

    /*
     * Renderer exclusivo para recorridos.
     * Evita conflictos de estilos SVG del Admin.
     */
    recorridoRenderer =
      L.canvas({
        padding:0.5
      });


    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom:19,
        attribution:'© OpenStreetMap'
      }
    ).addTo(map);


    setTimeout(
      function(){
        map.invalidateSize();
      },
      100
    );


    return map;

  }



  /* ==========================================================
     HELPERS LOCALES DEL POPUP
     Deben vivir dentro del mismo motor del mapa
     ========================================================== */

  function escaparHTMLMapa(valor){

    return String(
      valor == null ? '' : valor
    )
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');

  }


  function detalleReporteMapa(item){

    const r =
      item?.source || {};

    /*
     * El contenido completo que realmente llegó
     * en el reporte de Firebase.
     */
    let texto = String(
      r.msg ||
      r.mensaje ||
      r.message ||
      r.texto ||
      ''
    ).trim();


    if(!texto){

      texto = String(
        r.observaciones ||
        r.observacion ||
        r.obs ||
        ''
      ).trim();

    }


    if(!texto){
      return '';
    }


    /*
     * Limpiar solamente saltos excesivos.
     * No eliminamos datos operativos.
     */
    texto =
      texto
        .replace(/\r/g,'')
        .replace(/\n{3,}/g,'\n\n');


    return escaparHTMLMapa(texto)
      .replace(/\n/g,'<br>');

  }


  function dibujar(filas){

    const m =
      asegurarMapa();

    if(!m){
      return;
    }

    limpiar();

    if(!filas.length){
      return;
    }


    const coords = [];


    filas.forEach(
      function(item,index){

        if(!item.gps){
          return;
        }

        const lat =
          Number(item.gps.lat);

        const lng =
          Number(
            item.gps.lng ??
            item.gps.lon
          );

        if(
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ){
          console.warn(
            '[RECORRIDOS] coordenada inválida',
            item
          );
          return;
        }


        const latlng = [
          lat,
          lng
        ];

        coords.push(latlng);


        /*
         * CÍRCULO NATIVO LEAFLET.
         * Evitamos divIcon para garantizar visibilidad
         * en todos los navegadores.
         */
        const marker =
          L.circleMarker(
            latlng,
            {
              radius:14,
              color:'#ffffff',
              weight:3,
              fillColor:
                colorTipo(item.tipo),
              fillOpacity:1,
              opacity:1,
              renderer:
                recorridoRenderer,
              pane:'markerPane'
            }
          );


        /*
         * Número de orden encima del punto.
         */
        marker.bindTooltip(
          String(index + 1),
          {
            permanent:true,
            direction:'center',
            className:
              'recorridos-numero-tooltip'
          }
        );


        const detalle =
          detalleReporteMapa(item);


        marker.bindPopup(
          '<div class="recorridos-popup">' +

            '<div class="recorridos-popup-head">' +

              '<span class="recorridos-popup-num" ' +
              'style="background:' +
              colorTipo(item.tipo) +
              '">' +
              (index + 1) +
              '</span>' +

              '<div>' +

                '<strong class="recorridos-popup-pozo">' +
                escaparHTMLMapa(
                  'C-' + nombrePunto(item)
                ) +
                '</strong>' +

                '<div class="recorridos-popup-meta">' +
                escaparHTMLMapa(
                  hora(item)
                ) +
                '</div>' +

              '</div>' +

            '</div>' +

            '<div class="recorridos-popup-tipo" ' +
            'style="color:' +
            colorTipo(item.tipo) +
            '">' +
            escaparHTMLMapa(
              etiquetaTipo(item.tipo)
            ) +
            '</div>' +

            (
              detalle
                ? '<div class="recorridos-popup-detalle">' +
                  detalle +
                  '</div>'
                : ''
            ) +

          '</div>',
          {
            maxWidth:390,
            minWidth:280
          }
        );


        marker.addTo(m);

        layers.push(marker);


        console.log(
          '[RECORRIDOS] punto',
          index + 1,
          nombrePunto(item),
          item.tipo,
          lat,
          lng
        );

      }
    );

    if(coords.length >= 2){

      const linea =
        L.polyline(
          coords,
          {
            color:'#475569',
            weight:3,
            opacity:.78,
            renderer:
              recorridoRenderer
          }
        );

      linea.addTo(m);

      layers.push(linea);


      for(
        let i = 0;
        i < filas.length - 1;
        i++
      ){

        const a = filas[i];
        const b = filas[i+1];

        if(
          !a.gps ||
          !b.gps
        ){
          continue;
        }


        const vel =
          window.RecorridosCampo
            .velocidadEntre(
              a,
              b
            );


        if(
          vel == null ||
          !Number.isFinite(vel)
        ){
          continue;
        }


        const medio = [
          (
            a.gps.lat +
            b.gps.lat
          ) / 2,
          (
            a.gps.lng +
            b.gps.lng
          ) / 2
        ];


        const etiqueta =
          L.marker(
            medio,
            {
              interactive:false,

              icon:
                L.divIcon({

                  className:
                    'recorridos-speed-wrapper',

                  html:
                    '<div class="recorridos-speed">' +
                    vel.toFixed(1) +
                    ' km/h' +
                    '</div>',

                  iconSize:[78,28],

                  iconAnchor:[39,14]

                })

            }
          );


        etiqueta.addTo(m);

        layers.push(etiqueta);

      }

    }


    /*
     * Ajustar el mapa directamente a todas las
     * coordenadas del recorrido.
     */
    if(coords.length){

      const bounds =
        L.latLngBounds(coords);

      if(bounds.isValid()){

        m.fitBounds(
          bounds,
          {
            padding:[45,45],
            maxZoom:16
          }
        );

      }

    }

    setTimeout(
      function(){
        m.invalidateSize();
      },
      100
    );

  }


  window.addEventListener(
    'recorridos:datos',
    function(e){

      dibujar(
        e.detail?.filas || []
      );

    }
  );


  window.addEventListener(
    'recorridos:abrir',
    function(){

      setTimeout(
        function(){

          if(map){
            map.invalidateSize();
          }

          const filas =
            window.RECORRIDOS_FILTRADOS ||
            [];

          if(filas.length){
            dibujar(filas);
          }

        },
        120
      );

    }
  );

})();



/* ============================================================
   RECORRIDOS_SUBTIPO_UI_V1
   ============================================================ */

(function(){

  function actualizarBotones(){

    const estado =
      window.RecorridosCampo?.estado;

    if(!estado){
      return;
    }

    const subtipo =
      estado.subtipo || 'todos';


    document
      .querySelectorAll(
        '[data-recorridos-subtipo]'
      )
      .forEach(function(btn){

        btn.classList.toggle(
          'active',
          btn.dataset.recorridosSubtipo === subtipo
        );

      });

  }


  function actualizarVisibilidad(){

    const panel =
      document.getElementById(
        'recorridosSubtipoFiltros'
      );

    if(!panel){
      return;
    }

    const modo =
      window.RecorridosCampo
        ?.estado
        ?.modo ||
      'otros';


    /*
     * Los filtros específicos se usan únicamente
     * con "Otros reportes".
     *
     * La leyenda sigue siendo visible.
     */
    panel.classList.toggle(
      'modo-nivel',
      modo === 'nivel'
    );

  }


  document.addEventListener(
    'click',
    function(e){

      const btn =
        e.target.closest(
          '[data-recorridos-subtipo]'
        );

      if(btn){

        const tipo =
          btn.dataset
            .recorridosSubtipo ||
          'todos';


        if(
          window.RecorridosCampo?.estado
        ){

          window.RecorridosCampo
            .estado.subtipo =
              tipo;

        }


        actualizarBotones();


        if(
          typeof window
            .RecorridosCampo
            ?.actualizar ===
          'function'
        ){

          window.RecorridosCampo
            .actualizar();

        }

        return;

      }


      const modoBtn =
        e.target.closest(
          '[data-recorridos-modo]'
        );

      if(modoBtn){

        setTimeout(
          actualizarVisibilidad,
          20
        );

      }

    }
  );


  window.addEventListener(
    'recorridos:abrir',
    function(){

      actualizarBotones();
      actualizarVisibilidad();

    }
  );


  document.addEventListener(
    'DOMContentLoaded',
    function(){

      actualizarBotones();
      actualizarVisibilidad();

    }
  );

})();

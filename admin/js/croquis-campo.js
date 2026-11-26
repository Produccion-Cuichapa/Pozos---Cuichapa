(function () {
  'use strict';


  // Estados operativos recibidos en los reportes.
  // No utilizar el campo 'estado': corresponde al envío.
  function interpretarEstadoCroquis(reporte) {
    if (!reporte || typeof reporte !== 'object') return null;

    const valores = [
      reporte.estadoPozo,
      reporte.estatusPozo,
      reporte.co?.estadoPozo,
      reporte.parsed?.estadoPozo
    ];

    for (const valor of valores) {
      const estado = String(valor || '')
        .trim()
        .toUpperCase();

      if (estado === 'ABIERTO') return 'ABIERTO';
      if (estado === 'CERRADO') return 'CERRADO';
      if (estado === 'INTERMITENTE') return 'INTERMITENTE';
      if (estado === 'TAPONADO') return 'TAPONADO';
    }

    return null;
  }

  const coloresEstadoCroquis = {
    ABIERTO: '#16a34a',
    CERRADO: '#dc2626',
    INTERMITENTE: '#f59e0b',
    TAPONADO: '#7c3aed',
    SIN_INFORMACION: '#64748b'
  };


  // Obtiene la fecha efectiva del reporte operativo.
  function fechaEstadoCroquis(r) {
    if (!r || typeof r !== 'object') return 0;

    const timestamps = [
      r.timestamp, r.createdAt, r.created_at,
      r.capturedAt, r.fechaHoraMs,
      r.fechaTimestamp, r.serverTimestamp, r.savedAt
    ];

    for (const valor of timestamps) {
      const n = Number(valor);
      if (Number.isFinite(n) && n > 100000000000) {
        return n;
      }
    }

    const fecha = String(
      r.fecha || r.date || r.fechaReporte || ''
    ).trim();

    let m = fecha.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (!m) {
      const dmy = fecha.match(
        /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
      );

      if (dmy) {
        m = [null, dmy[3], dmy[2], dmy[1]];
      }
    }

    if (m) {
      const hora = String(
        r.hora || r.time || r.horaReporte ||
        r.horaGuardia || ''
      ).toUpperCase().replace(/\./g, '').trim();

      const hm = hora.match(
        /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/
      );

      let h = hm ? Number(hm[1]) : 0;
      const min = hm ? Number(hm[2]) : 0;
      const sec = hm ? Number(hm[3] || 0) : 0;
      const mer = hm ? hm[4] : '';

      if (mer === 'PM' && h < 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;

      const d = new Date(
        Number(m[1]), Number(m[2]) - 1,
        Number(m[3]), h, min, sec
      );

      if (!Number.isNaN(d.getTime())) {
        return d.getTime();
      }
    }

    for (const valor of [
      r.fechaHora, r.dateTime, r.datetime, r.iso
    ]) {
      if (!valor) continue;
      const n = Date.parse(valor);
      if (Number.isFinite(n)) return n;
    }

    return 0;
  }

  let mapa = null;
  let capas = {};

  const categorias = {
    pozos: { nombre: 'Pozos', color: '#f97316' },
    cabezales: { nombre: 'Cabezales', color: '#0f766e' },
    estaciones: { nombre: 'Estaciones', color: '#2563eb' },
    instalaciones: { nombre: 'PIA / ECO / BSC', color: '#7c3aed' },
    tuberias: { nombre: 'Tuberías', color: '#64748b' }
  };

  function iniciar() {
    const contenedor = document.getElementById('croquisMapa');
    if (!contenedor || mapa || typeof L === 'undefined') return;

    mapa = L.map(contenedor, {
      center: [17.945, -94.291],
      zoom: 13,
      preferCanvas: false
    });

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }
    ).addTo(mapa);

    Object.keys(categorias).forEach(tipo => {
      capas[tipo] = L.layerGroup().addTo(mapa);
    });

    cargarPozos();
    cargarCabezales();
    cargarInstalaciones();
    cargarTuberias();

    // Aplicar los estados ya recibidos por AdminFirebase.
    // No realiza consultas adicionales a Firebase.
    if (
      window.AdminFirebase &&
      Array.isArray(AdminFirebase.reportes)
    ) {
      actualizarEstadosCroquis(AdminFirebase.reportes);
    }

    setTimeout(() => mapa.invalidateSize(), 250);
  }


  const marcadoresPozos = new Map();

  function iconoEstadoCroquis(color) {
    return L.divIcon({
      className: 'croquis-icono',
      html: `<span style="background:${color}"></span>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  function marcador(lat, lon, nombre, tipo) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const esPozo = tipo === 'pozos';

    const color = esPozo
      ? coloresEstadoCroquis.SIN_INFORMACION
      : categorias[tipo].color;


    const colorEspecial = {
      'CAB-191': '#FFFF00',
      'CAB-503': '#FF6D00',
      'CAB-324': '#FF00FF'
    };

    const colorMarcador = colorEspecial[nombre] ||
      (!esPozo ? '#39FF14' : null);

    const icono = colorMarcador
      ? L.divIcon({
          className: 'croquis-icono croquis-icono-neon',
          html: '<span style="background:' +
            colorMarcador +
            ';--neon-color:' +
            colorMarcador +
            '"></span>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      : iconoEstadoCroquis(color);

    const punto = L.marker([lat, lon], {

      icon: icono
    });

    const nombreSeguro = String(nombre)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    punto.bindPopup(
      `<strong>${nombreSeguro}</strong><br>` +
      `${lat.toFixed(6)}, ${lon.toFixed(6)}` +
      (esPozo ? '<br>Estado: Sin información' : '')
    );

    punto.addTo(capas[tipo]);

    if (esPozo) {
      marcadoresPozos.set(String(nombre).trim(), {
        marcador: punto,
        nombre: String(nombre).trim(),
        lat,
        lon
      });
    }

    return punto;
  }


  function normalizarPozoCroquis(valor) {
    return String(valor ?? '')
      .trim()
      .toUpperCase()
      .replace(/^POZO\s*[-:#]?\s*/i, '')
      .replace(/^0+(?=\d)/, '');
  }


  /* CROQUIS_ULTIMO_REPORTE_V1 */
  function actualizarEstadosCroquis(reportes) {
    if (!mapa || !Array.isArray(reportes)) return;

    const motor = window.AdminPozos;

    if (!motor ||
        typeof motor.reportWell !== 'function' ||
        typeof motor.reportWellState !== 'function') return;

    const ultimosReportes = new Map();
    const ultimosEstados = new Map();

    /* CROQUIS_PRESIONES_TIEMPO_REAL_V1 */

    // Cada variable conserva su última lectura válida.
    // Solo se utilizan los reportes ya cargados por AdminFirebase.
    const ultimasPresiones = new Map();

    const camposPresion = [
      ['ptr', 'TR'],
      ['ptp', 'TP'],
      ['ldd', 'LDD'],
      ['lbn', 'LBN']
    ];

    function extraerPresion(reporte, campo) {
      const graficas = window.AdminGraficas;

      // Reutilizar el extractor de las gráficas si está disponible.
      if (graficas &&
          typeof graficas.fieldValue === 'function') {
        try {
          const valor = graficas.fieldValue(reporte, campo);
          if (typeof valor === 'number' &&
              Number.isFinite(valor)) {
            return valor;
          }
        } catch (error) {
          console.warn(
            'Error al extraer presión del croquis',
            error
          );
        }
      }

      const co = reporte?.co || {};
      const util = window.AdminUtils;

      let parsed = {};

      if (util && typeof util.parseMsg === 'function') {
        try {
          parsed = util.parseMsg(reporte) || {};
        } catch (_) {
          parsed = {};
        }
      }

      const candidatos = [
        co[campo],
        reporte?.[campo],
        reporte?.[campo.toUpperCase()],
        parsed[campo],
        parsed[campo.toUpperCase()]
      ];

      for (const candidato of candidatos) {
        if (candidato === null ||
            candidato === undefined ||
            String(candidato).trim() === '') {
          continue;
        }

        const coincidencia = String(candidato)
          .replace(/,/g, '.')
          .match(/[-+]?\\d+(?:\\.\\d+)?/);

        if (!coincidencia) continue;

        const valor = Number(coincidencia[0]);

        if (Number.isFinite(valor)) {
          return valor;
        }
      }

      // Compatibilidad con reportes almacenados como mensaje.
      const mensaje = String(
        reporte?.msg ||
        reporte?.mensaje ||
        reporte?.message ||
        reporte?.texto ||
        ''
      );

      const patron = new RegExp(
        '\\b' + campo.toUpperCase() +
        '\\s*[:=-]\\s*([-+]?\\d+(?:[.,]\\d+)?)',
        'i'
      );

      const coincidencia = mensaje.match(patron);

      return coincidencia
        ? Number(coincidencia[1].replace(',', '.'))
        : null;
    }

    function guardarPresiones(pozo, reporte, fecha) {
      let presiones = ultimasPresiones.get(pozo);

      if (!presiones) {
        presiones = {};
        ultimasPresiones.set(pozo, presiones);
      }

      for (const [campo] of camposPresion) {
        const valor = extraerPresion(reporte, campo);

        if (valor === null ||
            !Number.isFinite(valor)) {
          continue;
        }

        const anterior = presiones[campo];

        if (!anterior || fecha > anterior.fecha) {
          presiones[campo] = { valor, fecha };
        }
      }
    }

    function escaparPresion(valor) {
      return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function fichaPresiones(pozo) {
      const presiones = ultimasPresiones.get(pozo) || {};

      let html =
        '<div style="margin-top:9px;' +
        'padding-top:8px;' +
        'border-top:1px solid #64748b">' +
        '<strong>PRESIONES DEL POZO</strong>' +
        '<div style="display:grid;' +
        'grid-template-columns:1fr 1fr;' +
        'gap:6px;margin-top:7px">';

      for (const [campo, etiqueta] of camposPresion) {
        const lectura = presiones[campo];

        const valor = lectura
          ? escaparPresion(lectura.valor) + ' kg/cm²'
          : 'Sin dato';

        const fecha = lectura
          ? escaparPresion(formatoFecha(lectura.fecha))
          : 'Sin lectura disponible';

        html +=
          '<div style="padding:7px;' +
          'background:#142438;color:#fff;' +
          'border-radius:6px">' +
          '<div style="font-size:11px;opacity:.8">' +
          etiqueta + '</div>' +
          '<div style="font-weight:700;' +
          'font-size:14px">' +
          valor + '</div>' +
          '<div style="font-size:10px;' +
          'opacity:.75;margin-top:3px">' +
          fecha + '</div></div>';
      }

      html += '</div>' +
        '<div style="font-size:10px;' +
        'margin-top:6px;opacity:.8">' +
        'Últimas lecturas disponibles en los reportes cargados.' +
        '</div></div>';

      return html;
    }



    function fechaReporte(reporte) {
      const util = window.AdminUtils;

      const fecha = util &&
        typeof util.dateObj === 'function'
          ? util.dateObj(reporte)
          : null;

      if (fecha instanceof Date &&
          Number.isFinite(fecha.getTime())) {
        return fecha.getTime();
      }

      const tiempo = util &&
        typeof util.getTime === 'function'
          ? util.getTime(reporte)
          : 0;

      return tiempo || fechaEstadoCroquis(reporte);
    }

    for (const reporte of reportes) {
      const pozo = normalizarPozoCroquis(
        motor.reportWell(reporte)
      );

      if (!pozo || !marcadoresPozos.has(pozo)) continue;

      const fecha = fechaReporte(reporte);
      const anterior = ultimosReportes.get(pozo);

      if (!anterior || fecha > anterior.fecha) {
        ultimosReportes.set(pozo, {
          fecha,
          reporte
        });
      }

      guardarPresiones(pozo, reporte, fecha);

      const estado = motor.reportWellState(reporte);

      if (!estado || !coloresEstadoCroquis[estado]) {
        continue;
      }

      const anteriorEstado = ultimosEstados.get(pozo);

      if (!anteriorEstado ||
          fecha > anteriorEstado.fecha) {
        ultimosEstados.set(pozo, {
          estado,
          fecha
        });
      }
    }

    function formatoFecha(valor) {
      if (!valor || !Number.isFinite(valor)) {
        return 'Fecha no disponible';
      }

      return new Date(valor).toLocaleString(
        'es-MX',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }
      );
    }

    for (const [nombre, dato] of marcadoresPozos) {
      const pozo = normalizarPozoCroquis(nombre);

      const ultimoReporte = ultimosReportes.get(pozo);
      const ultimoEstado = ultimosEstados.get(pozo);

      const fichaPresionPozo = fichaPresiones(pozo);

      const estado = ultimoEstado?.estado ||
        'SIN_INFORMACION';

      const color = coloresEstadoCroquis[estado];

      dato.marcador.setIcon(
        iconoEstadoCroquis(color)
      );

      const nombreSeguro = String(nombre)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const sap = String(
        window.CatalogoPozos?.obtener?.(nombre)?.sap ||
        'No clasificado'
      )
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const textoReporte = ultimoReporte
        ? formatoFecha(ultimoReporte.fecha)
        : 'No encontrado entre los reportes cargados';

      const textoEstado = ultimoEstado
        ? formatoFecha(ultimoEstado.fecha)
        : 'No disponible';

      dato.marcador.setPopupContent(
        '<strong>Pozo ' + nombreSeguro + '</strong><br>' +
        'Sistema: ' + sap + '<br>' +
        'Estado operativo: ' +
        estado.replace(/_/g, ' ') + '<br>' +
        'Último reporte disponible: ' +
        textoReporte + '<br>' +
        'Último estado reportado: ' +
        textoEstado + '<br>' +
        fichaPresionPozo + '<br>' +
        dato.lat.toFixed(6) + ', ' +
        dato.lon.toFixed(6)
      );
    }
  }

  function cargarPozos() {
    if (typeof WELL_COORDS_ALL === 'undefined') return;

    Object.entries(WELL_COORDS_ALL).forEach(([nombre, p]) => {
      if (nombre.startsWith('CAB-')) return;

      if (!window.CatalogoPozos ||
          typeof window.CatalogoPozos.existe !== 'function' ||
          !window.CatalogoPozos.existe(nombre)) return;

      const lat = Number(p.lat);
      const lon = Number(p.lon);

      marcador(lat, lon, nombre, 'pozos');
    });
  }

  function cargarCabezales() {
    if (typeof WELL_COORDS_ALL === 'undefined') return;

    ['CAB-191', 'CAB-503', 'CAB-324'].forEach(nombre => {
      const p = WELL_COORDS_ALL[nombre];
      if (!p) return;

      marcador(
        Number(p.lat),
        Number(p.lon),
        nombre,
        'cabezales'
      );
    });
  }

  function cargarInstalaciones() {
    const ubicaciones = [
      { nombre: 'BSC - Batería Cuichapa 2', lat: 17.94236, lon: -94.29749, tipo: 'instalaciones' },
      { nombre: 'ECO - Estación de Compresión Cuichapa', lat: 17.94596, lon: -94.28284, tipo: 'instalaciones' },
      { nombre: 'PIA - Planta de Inyección de Agua', lat: 17.94083, lon: -94.30137, tipo: 'instalaciones' },
      { nombre: 'Estación 11', lat: 17.93950, lon: -94.29383, tipo: 'estaciones' },
      { nombre: 'Estación 8', lat: 17.94462, lon: -94.29456, tipo: 'estaciones' },
      { nombre: 'Estación A', lat: 17.96441, lon: -94.29331, tipo: 'estaciones' },
      { nombre: 'Estación B', lat: 17.95013, lon: -94.30171, tipo: 'estaciones' },
      { nombre: 'Estación C', lat: 17.93610, lon: -94.30202, tipo: 'estaciones' },
      { nombre: 'Estación D', lat: 17.92826, lon: -94.29333, tipo: 'estaciones' },
      { nombre: 'Estación E', lat: 17.92161, lon: -94.28654, tipo: 'estaciones' }
    ];

    /* CROQUIS_ECO_MTC_V1 */
    ubicaciones.forEach(p => {
      const punto = marcador(
        p.lat,
        p.lon,
        p.nombre,
        p.tipo
      );

      if (!punto) return;

      if (p.nombre.startsWith('ECO -')) {
        punto.bindPopup(
          '<strong>ECO - Estación de Compresión Cuichapa</strong>' +
          '<br><strong>Motocompresoras: 2</strong>' +
          '<br>⚙️ MTC 1 - Motocompresora' +
          '<br>⚙️ MTC 2 - Motocompresora' +
          '<br><small>Equipos asociados a ECO; ' +
          'ubicaciones individuales no registradas.</small>' +
          '<br>' +
          p.lat.toFixed(6) + ', ' +
          p.lon.toFixed(6)
        );
      }
    });
  }


  /* CROQUIS_NEON_ANIMADO_V1 */



  /* CROQUIS_ESTACIONES_NEON_V3 */

  function colorNeonTuberia(linea) {
    const n = String(linea.n || '')
      .toUpperCase()
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Cabezales y sus tuberías identificadas.
    if (/\bCAB\s*(?:CUI\s*)?191\b/.test(n))
      return '#FFFF00';

    if (/\bCAB\s*(?:CUI\s*)?503\b/.test(n))
      return '#FF6D00';

    if (/\bCAB\s*(?:CUI\s*)?324\b/.test(n))
      return '#FF00FF';

    // Líneas identificadas hacia/desde ECO.
    if (/\bECO\b/.test(n))
      return '#00FF88';

    // Líneas identificadas de Estación 11.
    if (/\bEST\s*11\b/.test(n))
      return '#00FF88';

    // Bombeo neumático identificado.
    if (/\bLBN\b/.test(n))
      return '#00F5FF';

    // Colectores identificados.
    if (/\bLG\b|\bLM\b/.test(n))
      return '#39FF14';

    return null;
  }


  /* CROQUIS_BC_CANDIDATAS_V1 */

  // Índices de KMZ_LINES, identificados mediante proximidad
  // de extremos a las estaciones. Conexión no verificada.
  const lineasCandidatasBC = {
    104: '#008CFF',
    105: '#008CFF',
    106: '#008CFF',
    107: '#008CFF',
    108: '#008CFF',
    114: '#008CFF',

    100: '#FF00E5',
    101: '#FF00E5',
    102: '#FF00E5',
    112: '#FF00E5'
  };

  function cargarTuberias() {
    if (typeof KMZ_LINES === 'undefined') return;

    /* CROQUIS_CLASIFICACION_OPTIMIZADA_V1 */
    const clasificacionProvisional = {"60":{"instalacion_candidata":"BSC","distancia_m":760.2,"segunda_candidata":"ECO","segunda_distancia_m":922.1,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"61":{"instalacion_candidata":"ECO","distancia_m":100.3,"segunda_candidata":"BSC","segunda_distancia_m":1417.8,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"62":{"instalacion_candidata":"BSC","distancia_m":55.2,"segunda_candidata":"PIA","segunda_distancia_m":435.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"63":{"instalacion_candidata":"BSC","distancia_m":63.1,"segunda_candidata":"PIA","segunda_distancia_m":454.0,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"64":{"instalacion_candidata":"BSC","distancia_m":421.2,"segunda_candidata":"PIA","segunda_distancia_m":683.9,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"65":{"instalacion_candidata":"BSC","distancia_m":166.1,"segunda_candidata":"PIA","segunda_distancia_m":362.4,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"66":{"instalacion_candidata":"BSC","distancia_m":375.3,"segunda_candidata":"PIA","segunda_distancia_m":583.3,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"67":{"instalacion_candidata":"BSC","distancia_m":54.9,"segunda_candidata":"PIA","segunda_distancia_m":434.7,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"68":{"instalacion_candidata":"BSC","distancia_m":55.0,"segunda_candidata":"PIA","segunda_distancia_m":434.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"69":{"instalacion_candidata":"BSC","distancia_m":420.7,"segunda_candidata":"PIA","segunda_distancia_m":683.5,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"70":{"instalacion_candidata":"BSC","distancia_m":398.5,"segunda_candidata":"PIA","segunda_distancia_m":834.4,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"71":{"instalacion_candidata":"BSC","distancia_m":55.6,"segunda_candidata":"PIA","segunda_distancia_m":438.7,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"72":{"instalacion_candidata":"ECO","distancia_m":621.8,"segunda_candidata":"BSC","segunda_distancia_m":747.8,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"73":{"instalacion_candidata":"ECO","distancia_m":621.5,"segunda_candidata":"BSC","segunda_distancia_m":747.8,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"74":{"instalacion_candidata":"BSC","distancia_m":55.9,"segunda_candidata":"PIA","segunda_distancia_m":439.2,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"75":{"instalacion_candidata":"BSC","distancia_m":58.6,"segunda_candidata":"PIA","segunda_distancia_m":383.6,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"76":{"instalacion_candidata":"BSC","distancia_m":34.9,"segunda_candidata":"PIA","segunda_distancia_m":393.2,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"77":{"instalacion_candidata":"BSC","distancia_m":52.2,"segunda_candidata":"PIA","segunda_distancia_m":362.3,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"78":{"instalacion_candidata":"BSC","distancia_m":387.6,"segunda_candidata":"EST_B","segunda_distancia_m":604.6,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"79":{"instalacion_candidata":"BSC","distancia_m":55.5,"segunda_candidata":"ECO","segunda_distancia_m":389.7,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"80":{"instalacion_candidata":"EST_C","distancia_m":44.1,"segunda_candidata":"PIA","segunda_distancia_m":238.2,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"81":{"instalacion_candidata":"ECO","distancia_m":1058.8,"segunda_candidata":"EST_B","segunda_distancia_m":1225.7,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"82":{"instalacion_candidata":"ECO","distancia_m":100.8,"segunda_candidata":"EST_B","segunda_distancia_m":647.1,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"83":{"instalacion_candidata":"ECO","distancia_m":119.4,"segunda_candidata":"EST_B","segunda_distancia_m":1342.8,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"84":{"instalacion_candidata":"EST_C","distancia_m":778.8,"segunda_candidata":"BSC","segunda_distancia_m":837.4,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"85":{"instalacion_candidata":"PIA","distancia_m":64.8,"segunda_candidata":"BSC","segunda_distancia_m":318.5,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"86":{"instalacion_candidata":"ECO","distancia_m":948.1,"segunda_candidata":"EST_B","segunda_distancia_m":1349.8,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"87":{"instalacion_candidata":"BSC","distancia_m":54.7,"segunda_candidata":"PIA","segunda_distancia_m":433.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"88":{"instalacion_candidata":"EST_C","distancia_m":1891.6,"segunda_candidata":"BSC","segunda_distancia_m":2254.9,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"89":{"instalacion_candidata":"EST_C","distancia_m":1764.7,"segunda_candidata":"BSC","segunda_distancia_m":2108.0,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"90":{"instalacion_candidata":"EST_C","distancia_m":1762.7,"segunda_candidata":"BSC","segunda_distancia_m":2061.7,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"91":{"instalacion_candidata":"EST_C","distancia_m":1761.4,"segunda_candidata":"BSC","segunda_distancia_m":2060.5,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"92":{"instalacion_candidata":"BSC","distancia_m":447.7,"segunda_candidata":"PIA","segunda_distancia_m":664.9,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"93":{"instalacion_candidata":"BSC","distancia_m":54.4,"segunda_candidata":"PIA","segunda_distancia_m":433.1,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"94":{"instalacion_candidata":"EST_C","distancia_m":1459.5,"segunda_candidata":"BSC","segunda_distancia_m":1773.4,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"95":{"instalacion_candidata":"EST_C","distancia_m":627.9,"segunda_candidata":"PIA","segunda_distancia_m":1101.8,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"96":{"instalacion_candidata":"EST_C","distancia_m":598.6,"segunda_candidata":"PIA","segunda_distancia_m":1022.9,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"97":{"instalacion_candidata":"ECO","distancia_m":100.3,"segunda_candidata":"BSC","segunda_distancia_m":1417.8,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"98":{"instalacion_candidata":"BSC","distancia_m":54.0,"segunda_candidata":"PIA","segunda_distancia_m":430.2,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"99":{"instalacion_candidata":"BSC","distancia_m":68.0,"segunda_candidata":"ECO","segunda_distancia_m":116.2,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"100":{"instalacion_candidata":"EST_C","distancia_m":0.8,"segunda_candidata":"PIA","segunda_distancia_m":523.0,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"101":{"instalacion_candidata":"EST_C","distancia_m":4.7,"segunda_candidata":"PIA","segunda_distancia_m":520.5,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"102":{"instalacion_candidata":"EST_C","distancia_m":1.5,"segunda_candidata":"PIA","segunda_distancia_m":90.8,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"103":{"instalacion_candidata":"EST_C","distancia_m":45.2,"segunda_candidata":"PIA","segunda_distancia_m":67.4,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"104":{"instalacion_candidata":"EST_B","distancia_m":2.4,"segunda_candidata":"BSC","segunda_distancia_m":773.1,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"105":{"instalacion_candidata":"EST_B","distancia_m":3.3,"segunda_candidata":"BSC","segunda_distancia_m":767.7,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"106":{"instalacion_candidata":"EST_B","distancia_m":4.3,"segunda_candidata":"PIA","segunda_distancia_m":93.4,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"107":{"instalacion_candidata":"EST_B","distancia_m":5.4,"segunda_candidata":"PIA","segunda_distancia_m":278.8,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"108":{"instalacion_candidata":"EST_B","distancia_m":6.4,"segunda_candidata":"PIA","segunda_distancia_m":405.4,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"109":{"instalacion_candidata":"PIA","distancia_m":53.5,"segunda_candidata":"EST_B","segunda_distancia_m":172.8,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"110":{"instalacion_candidata":"EST_C","distancia_m":49.1,"segunda_candidata":"PIA","segunda_distancia_m":69.2,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"111":{"instalacion_candidata":"BSC","distancia_m":760.7,"segunda_candidata":"ECO","segunda_distancia_m":922.1,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"112":{"instalacion_candidata":"EST_C","distancia_m":9.0,"segunda_candidata":"PIA","segunda_distancia_m":502.6,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"113":{"instalacion_candidata":"EST_B","distancia_m":27.1,"segunda_candidata":"PIA","segunda_distancia_m":59.3,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"114":{"instalacion_candidata":"EST_B","distancia_m":4.6,"segunda_candidata":"BSC","segunda_distancia_m":972.6,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"115":{"instalacion_candidata":"EST_C","distancia_m":2289.6,"segunda_candidata":"BSC","segunda_distancia_m":2574.9,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"116":{"instalacion_candidata":"EST_C","distancia_m":1263.6,"segunda_candidata":"BSC","segunda_distancia_m":1623.8,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"117":{"instalacion_candidata":"EST_B","distancia_m":179.5,"segunda_candidata":"BSC","segunda_distancia_m":733.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"118":{"instalacion_candidata":"PIA","distancia_m":263.6,"segunda_candidata":"BSC","segunda_distancia_m":477.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"119":{"instalacion_candidata":"EST_C","distancia_m":377.1,"segunda_candidata":"PIA","segunda_distancia_m":817.4,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"120":{"instalacion_candidata":"EST_C","distancia_m":54.7,"segunda_candidata":"PIA","segunda_distancia_m":452.4,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"121":{"instalacion_candidata":"BSC","distancia_m":80.6,"segunda_candidata":"PIA","segunda_distancia_m":484.5,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"122":{"instalacion_candidata":"BSC","distancia_m":321.0,"segunda_candidata":"PIA","segunda_distancia_m":446.1,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"123":{"instalacion_candidata":"EST_B","distancia_m":266.0,"segunda_candidata":"BSC","segunda_distancia_m":748.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"124":{"instalacion_candidata":"ECO","distancia_m":591.2,"segunda_candidata":"BSC","segunda_distancia_m":1066.8,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"125":{"instalacion_candidata":"ECO","distancia_m":79.7,"segunda_candidata":"BSC","segunda_distancia_m":1571.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"126":{"instalacion_candidata":"ECO","distancia_m":8.2,"segunda_candidata":"BSC","segunda_distancia_m":1214.7,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"127":{"instalacion_candidata":"ECO","distancia_m":119.9,"segunda_candidata":"BSC","segunda_distancia_m":1214.7,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"128":{"instalacion_candidata":"ECO","distancia_m":118.5,"segunda_candidata":"BSC","segunda_distancia_m":1214.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"129":{"instalacion_candidata":"EST_B","distancia_m":1814.6,"segunda_candidata":"ECO","segunda_distancia_m":2334.9,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"130":{"instalacion_candidata":"PIA","distancia_m":67.8,"segunda_candidata":"BSC","segunda_distancia_m":198.4,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"131":{"instalacion_candidata":"ECO","distancia_m":112.4,"segunda_candidata":"BSC","segunda_distancia_m":1499.7,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"132":{"instalacion_candidata":"ECO","distancia_m":22.4,"segunda_candidata":"BSC","segunda_distancia_m":1584.0,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"133":{"instalacion_candidata":"ECO","distancia_m":125.9,"segunda_candidata":"BSC","segunda_distancia_m":1518.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"134":{"instalacion_candidata":"ECO","distancia_m":127.8,"segunda_candidata":"BSC","segunda_distancia_m":1479.2,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"135":{"instalacion_candidata":"ECO","distancia_m":86.8,"segunda_candidata":"BSC","segunda_distancia_m":1549.2,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"136":{"instalacion_candidata":"ECO","distancia_m":87.9,"segunda_candidata":"BSC","segunda_distancia_m":1584.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"137":{"instalacion_candidata":"EST_B","distancia_m":1309.8,"segunda_candidata":"ECO","segunda_distancia_m":1319.5,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"138":{"instalacion_candidata":"BSC","distancia_m":93.0,"segunda_candidata":"PIA","segunda_distancia_m":502.8,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"139":{"instalacion_candidata":"BSC","distancia_m":286.5,"segunda_candidata":"PIA","segunda_distancia_m":639.3,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"140":{"instalacion_candidata":"EST_C","distancia_m":2239.7,"segunda_candidata":"BSC","segunda_distancia_m":2576.4,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"141":{"instalacion_candidata":"EST_C","distancia_m":2243.8,"segunda_candidata":"BSC","segunda_distancia_m":2578.5,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"142":{"instalacion_candidata":"BSC","distancia_m":55.6,"segunda_candidata":"PIA","segunda_distancia_m":436.9,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"143":{"instalacion_candidata":"BSC","distancia_m":56.0,"segunda_candidata":"PIA","segunda_distancia_m":438.3,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"144":{"instalacion_candidata":"BSC","distancia_m":495.7,"segunda_candidata":"PIA","segunda_distancia_m":807.0,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"145":{"instalacion_candidata":"BSC","distancia_m":56.0,"segunda_candidata":"PIA","segunda_distancia_m":440.3,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"146":{"instalacion_candidata":"BSC","distancia_m":39.9,"segunda_candidata":"PIA","segunda_distancia_m":484.2,"estado":"CANDIDATA","metodo":"proximidad_geometrica","conexion_verificada":false},"147":{"instalacion_candidata":"BSC","distancia_m":397.6,"segunda_candidata":"ECO","segunda_distancia_m":710.3,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"148":{"instalacion_candidata":"ECO","distancia_m":890.0,"segunda_candidata":"EST_B","segunda_distancia_m":2109.5,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"149":{"instalacion_candidata":"ECO","distancia_m":733.6,"segunda_candidata":"BSC","segunda_distancia_m":763.4,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false},"150":{"instalacion_candidata":"ECO","distancia_m":895.4,"segunda_candidata":"BSC","segunda_distancia_m":1089.2,"estado":"REVISAR","metodo":"proximidad_geometrica","conexion_verificada":false}};

    KMZ_LINES.forEach((linea, indice) => {
      if (!Array.isArray(linea.c) || linea.c.length < 2)
        return;


      /* CROQUIS_INSTALACIONES_ESTILO_V1 */

      // Identificación visual preliminar.
      // Las líneas sin nombre requieren confirmación en campo.
      // No modificar estilos asignados a estaciones B y C.

      const instalacionesEspeciales = {
        ECO: {
          indices: [126, 132],
          color: '#00E58A',
          clase: 'eco',
          verificada: false
        },
        PIA: {
          indices: [85, 109, 113, 130],
          color: '#00D9FF',
          clase: 'pia',
          verificada: false
        },
        BSC: {
          indices: [4, 14, 16, 21, 32, 40],
          color: '#FFB000',
          clase: 'bsc',
          verificada: true
        }
      };

      const especial = Object.entries(instalacionesEspeciales)
        .find(([nombre, cfg]) =>
          cfg.indices.includes(indice)
        );

      if (especial && !lineasCandidatasBC[indice]) {
        const [instalacion, cfg] = especial;

        const etiquetaOriginal = String(
          linea.n || 'Tubería sin identificar'
        );

        const etiqueta = instalacion +
          ' — ' + etiquetaOriginal +
          (cfg.verificada
            ? ' — Identificación según nombre del KMZ'
            : ' — Candidata por proximidad; conexión por verificar');

        // Base oscura para separar visualmente los trazados.
        L.polyline(linea.c, {
          color: '#09252B',
          weight: 11,
          opacity: 0.85,
          interactive: false
        }).addTo(capas.tuberias);

        // Línea principal diferenciada.
        L.polyline(linea.c, {
          color: cfg.color,
          weight: 5,
          opacity: 1,
          className: 'croquis-instalacion-' + cfg.clase
        })
          .bindPopup(etiqueta)
          .addTo(capas.tuberias);

        // Patrón propio de cada instalación.
        if (instalacion === 'ECO') {
          L.polyline(linea.c, {
            color: '#FFFFFF',
            weight: 2.5,
            opacity: 0.95,
            dashArray: '2 16',
            interactive: false,
            className: 'croquis-eco-pulsos'
          }).addTo(capas.tuberias);
        }

        if (instalacion === 'PIA') {
          L.polyline(linea.c, {
            color: '#E4FCFF',
            weight: 2,
            opacity: 0.95,
            dashArray: '14 11',
            interactive: false,
            className: 'croquis-pia-flujo'
          }).addTo(capas.tuberias);
        }

        if (instalacion === 'BSC') {
          L.polyline(linea.c, {
            color: '#FFFFFF',
            weight: 2,
            opacity: 0.9,
            dashArray: '3 25',
            interactive: false,
            className: 'croquis-bsc-marcas'
          }).addTo(capas.tuberias);
        }

        return;
      }



      /* Clasificación compartida por todas las líneas. */

      const coloresInstalacion = {
        BSC: '#FFB000',
        PIA: '#00D9FF',
        ECO: '#00E58A',
        EST_B: '#2563EB',
        EST_C: '#EC4899'
      };

      const nombreOriginal = String(linea.n || '').trim();
      const candidatoBC = lineasCandidatasBC[indice];
      const ficha = clasificacionProvisional[String(indice)];

      let color;
      let descripcion;
      let patron = null;

      if (nombreOriginal) {
        color = candidatoBC
          || colorNeonTuberia(linea)
          || linea.col
          || '#64748b';

        descripcion = nombreOriginal;

      } else if (ficha) {
        color = coloresInstalacion[
          ficha.instalacion_candidata
        ] || '#64748b';

        patron = ficha.estado === 'REVISAR'
          ? '7 7'
          : null;

        descripcion =
          'Tubería KMZ ' +
          String(indice).padStart(3, '0') +
          ' — Instalación candidata: ' +
          ficha.instalacion_candidata +
          ' — Estado: ' + ficha.estado +
          ' — Clasificación por proximidad, ' +
          'conexión física no verificada';

      } else {
        color = linea.col || '#64748b';
        descripcion =
          'Tubería KMZ ' + indice +
          ' — Sin clasificación';
        patron = '7 7';
      }

      L.polyline(linea.c, {
        color: color,
        weight: 3.5,
        opacity: 0.95,
        dashArray: patron,
        smoothFactor: 1.5
      })
        .bindPopup(descripcion)
        .addTo(capas.tuberias);

    });
  }

  function actualizarTamano() {
    if (mapa) setTimeout(() => mapa.invalidateSize(), 100);
  }

  function configurarFiltros() {
    document.querySelectorAll('[data-croquis-capa]').forEach(input => {
      input.addEventListener('change', () => {
        const capa = capas[input.dataset.croquisCapa];
        if (!mapa || !capa) return;

        if (input.checked) {
          capa.addTo(mapa);
        } else {
          mapa.removeLayer(capa);
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', configurarFiltros);


  /* CROQUIS_SAP_LAYER_FILTER_V2 */
  function filtrarPozosPorSap(filtro) {
    if (!mapa || !capas.pozos) return null;

    const catalogo = window.CatalogoPozos;

    if (!catalogo ||
        typeof catalogo.obtener !== 'function') {
      return null;
    }

    const sistema = String(filtro || 'TODOS')
      .trim()
      .toUpperCase();

    const permitidos = [
      'TODOS', 'BN', 'FY', 'BM', 'OTROS'
    ];

    if (!permitidos.includes(sistema)) return null;

    let visibles = 0;
    let ocultos = 0;

    for (const [nombre, dato] of marcadoresPozos) {
      const registro = catalogo.obtener(nombre);

      const sap = String(registro?.sap || '')
        .toUpperCase()
        .trim();

      const sistemas = sap.split('/')
        .map(x => x.trim())
        .filter(Boolean);

      let mostrar = sistema === 'TODOS';

      if (sistema === 'OTROS') {
        mostrar = !sistemas.some(x =>
          ['BN', 'FY', 'BM'].includes(x)
        );
      } else if (sistema !== 'TODOS') {
        mostrar = sistemas.includes(sistema);
      }

      const punto = dato.marcador;

      if (mostrar) {
        if (!capas.pozos.hasLayer(punto)) {
          capas.pozos.addLayer(punto);
        }
        visibles++;
      } else {
        if (capas.pozos.hasLayer(punto)) {
          capas.pozos.removeLayer(punto);
        }
        ocultos++;
      }
    }

    return {
      filtro: sistema,
      visibles,
      ocultos,
      total: marcadoresPozos.size
    };
  }

  /* CROQUIS_DIAGNOSTICO_262 — SOLO LECTURA */
  function diagnosticarMarcadores() {
    const resultados = [];

    for (const [nombre, dato] of marcadoresPozos) {
      const marcador = dato.marcador;
      const popup = marcador.getPopup();
      const contenido = popup?.getContent();

      const texto = typeof contenido === 'string'
        ? contenido
        : contenido?.textContent || '';

      const estadoMatch = texto.match(
        /Estado operativo:\s*(ABIERTO|CERRADO|SIN INFORMACION)/i
      );

      const estadoPopup = estadoMatch
        ? estadoMatch[1].toUpperCase().replace(/\s+/g, '_')
        : 'NO_DETECTADO';

      const icono = marcador.getElement();
      const span = icono?.querySelector('span');

      const color = span
        ? getComputedStyle(span).backgroundColor
        : 'NO_DISPONIBLE';

      resultados.push({
        pozo: normalizarPozoCroquis(nombre),
        estadoPopup,
        color,
        marcadorCreado: !!icono
      });
    }

    return resultados;
  }

  window.CroquisCampo = {
    iniciar,
    actualizarEstados: actualizarEstadosCroquis,
    actualizarTamano,
    filtrarPozosPorSap,
    diagnosticarMarcadores
  };
})();



/* CROQUIS_FULLSCREEN_CONTROL_V1 */
(function () {
  'use strict';

  const MAP_ID = 'croquisMapa';
  const BUTTON_ID = 'croquisFullscreenBtn';

  function instalarControl() {
    const mapa = document.getElementById(MAP_ID);
    if (!mapa || document.getElementById(BUTTON_ID)) return;

    if (getComputedStyle(mapa).position === 'static') {
      mapa.style.position = 'relative';
    }

    const estilo = document.createElement('style');
    estilo.id = 'croquisFullscreenStyle';
    estilo.textContent = `
      #croquisMapa:fullscreen {
        width: 100vw !important;
        height: 100vh !important;
        min-height: 100vh !important;
        background: #f8fafc;
      }

      #croquisFullscreenBtn {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 9px 13px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #fff;
        color: #0f172a;
        font: 600 12px system-ui, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,.15);
        cursor: pointer;
      }

      #croquisFullscreenBtn:hover {
        background: #f1f5f9;
      }

      #croquisFullscreenBtn:focus-visible {
        outline: 3px solid #2563eb;
        outline-offset: 2px;
      }

      #croquisFullscreenBtn svg {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `;

    document.head.appendChild(estilo);

    const boton = document.createElement('button');
    boton.id = BUTTON_ID;
    boton.type = 'button';

    mapa.appendChild(boton);

    function actualizarBoton() {
      const activo = document.fullscreenElement === mapa;

      boton.innerHTML = activo
        ? `<svg viewBox="0 0 24 24" aria-hidden="true">
             <path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5"/>
           </svg><span>Salir de pantalla completa</span>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true">
             <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>
           </svg><span>Pantalla completa</span>`;

      boton.setAttribute(
        'aria-label',
        activo ? 'Salir de pantalla completa' : 'Ampliar croquis'
      );
    }

    function ajustarMapa() {
      requestAnimationFrame(() => {
        window.CroquisCampo?.actualizarTamano?.();

        setTimeout(() => {
          window.CroquisCampo?.actualizarTamano?.();
        }, 180);
      });
    }

    boton.addEventListener('click', async function (evento) {
      evento.preventDefault();
      evento.stopPropagation();

      try {
        if (document.fullscreenElement === mapa) {
          await document.exitFullscreen();
        } else {
          if (!mapa.requestFullscreen) {
            alert('Este navegador no admite pantalla completa.');
            return;
          }

          await mapa.requestFullscreen();
        }
      } catch (error) {
        console.error('Error al cambiar pantalla completa:', error);
        alert('No fue posible cambiar a pantalla completa.');
      }
    });

    document.addEventListener('fullscreenchange', () => {
      actualizarBoton();
      ajustarMapa();
    });

    actualizarBoton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', instalarControl, {
      once: true
    });
  } else {
    instalarControl();
  }
})();


/* CROQUIS_SAP_FILTER_V2 */
(function () {
  'use strict';

  const CONTROL_ID = 'croquisSapControl';

  function instalar() {
    const contenedor = document.getElementById('croquisMapa');

    if (!contenedor ||
        document.getElementById(CONTROL_ID)) {
      return;
    }

    const estilo = document.createElement('style');
    estilo.id = 'croquisSapStyleV2';

    estilo.textContent = `
      #croquisSapControl {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding: 9px;
        margin-bottom: 10px;
        border: 1px solid #dbe3ec;
        border-radius: 10px;
        background: #fff;
      }

      #croquisSapControl button {
        padding: 7px 13px;
        border: 1px solid #cbd5e1;
        border-radius: 7px;
        background: #fff;
        color: #334155;
        font: 600 12px system-ui, sans-serif;
        cursor: pointer;
      }

      #croquisSapControl button.activo {
        background: #0f172a;
        border-color: #0f172a;
        color: #fff;
      }

      #croquisSapControl button:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }

      #croquisSapControl .titulo {
        margin-right: 8px;
        font: 600 12px system-ui, sans-serif;
        color: #475569;
      }
    `;

    document.head.appendChild(estilo);

    const control = document.createElement('div');
    control.id = CONTROL_ID;

    control.innerHTML = `
      <span class="titulo">Sistema de producción:</span>
      <button type="button" data-sap="TODOS" class="activo">Todos</button>
      <button type="button" data-sap="BN">BN</button>
      <button type="button" data-sap="FY">FY</button>
      <button type="button" data-sap="BM">BM</button>
      <button type="button" data-sap="OTROS">Otros</button>
    `;

    contenedor.parentElement.insertBefore(
      control,
      contenedor
    );

    function seleccionar(filtro) {
      const resultado =
        window.CroquisCampo?.filtrarPozosPorSap?.(filtro);

      if (!resultado) return;

      control.querySelectorAll('button[data-sap]')
        .forEach(boton => {
          const activo = boton.dataset.sap === filtro;

          boton.classList.toggle('activo', activo);
          boton.setAttribute(
            'aria-pressed',
            String(activo)
          );
        });

      console.log('[Croquis SAP V2]', resultado);
    }

    control.addEventListener('click', evento => {
      const boton = evento.target.closest(
        'button[data-sap]'
      );

      if (!boton) return;

      seleccionar(boton.dataset.sap);
    });

    seleccionar('TODOS');
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      instalar,
      { once: true }
    );
  } else {
    instalar();
  }
})();

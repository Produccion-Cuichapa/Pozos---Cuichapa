window.AdminDashboard = {
  EXPECTED_WELLS: 246,
  lastDashboardUpdate: 0,
  clockTimer: null,
  relativeTimer: null,
  previousKpis: {},

  render(){
    this.initOperationsClock();
    this.setLoadingState(true);

    const r = window.AdminFirebase.reportes || [];
    const a = window.AdminFirebase.alarmas || [];
    const u = AdminUtils;

    const reportesHoy = r.filter(x => u.sameToday(x));
    const alarmasHoy = a.filter(x => u.sameToday(x));

    // Pendientes WhatsApp:
    // contar únicamente envíos recientes que todavía no tienen confirmación.
    // Esto evita mostrar como pendientes reportes antiguos que sí llegaron
    // al grupo, pero conservaron un estado local desactualizado.
    const ahora = Date.now();
    const limitePendienteMs = 15 * 60 * 1000;

    const pendientes = reportesHoy.filter(x => {
      const st = String(x.whatsappStatus || '').toLowerCase().trim();

      const esEstadoPendiente =
        st === 'pending' ||
        st === 'pendiente' ||
        st === 'queued' ||
        st === 'retry';

      if(!esEstadoPendiente) return false;

      const fechaReporte = u.dateObj(x);
      const timestamp = fechaReporte instanceof Date
        ? fechaReporte.getTime()
        : NaN;

      if(!Number.isFinite(timestamp)) return false;

      const antiguedad = ahora - timestamp;

      return antiguedad >= 0 &&
             antiguedad <= limitePendienteMs;
    });

    const sinGps = reportesHoy.filter(x => !u.hasGps(x));

    const fotosHoy = reportesHoy.reduce((sum, x) => {
      return sum + Number(x.nFotos || x.fotos?.length || x.fotoUrls?.length || 0);
    }, 0);

    this.setText('kpiReportesHoy', reportesHoy.length);
    this.setText('kpiAlarmasHoy', alarmasHoy.length);
    this.setText('kpiPendientes', pendientes.length);
    this.setText('kpiTotal', r.length + a.length);

    this.applyKpiHealth({
      reportesHoy: reportesHoy.length,
      alarmasHoy: alarmasHoy.length,
      pendientes: pendientes.length,
      sinGps: sinGps.length
    });

    this.injectExtraDashboard({
      sinGps: sinGps.length,
      fotosHoy
    });

    this.renderExecutiveSummary(reportesHoy);
    this.renderHourlyChart(reportesHoy);
    this.renderDailyInsights(reportesHoy);
    this.renderRecorredores(reportesHoy);
    this.renderList('ultimosReportes', r.slice(0, 5), 'reporte');
    this.renderCondicionPera(r);

    this.renderIncidentBanner({
      reportesHoy,
      alarmasHoy,
      pendientes,
      sinGps
    });

    this.lastDashboardUpdate = Date.now();
    this.updateSynchronizationStatus();
    this.animateKpiChanges();
    this.setLoadingState(false);
  },

  initOperationsClock(){
    if(this.clockTimer) return;

    const updateClock = () => {
      const now = new Date();

      const weekday = now.toLocaleDateString('es-MX', {
        weekday: 'long'
      });

      const date = now.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const time = now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const weekdayEl = document.getElementById('operationsWeekday');
      const dateEl = document.getElementById('operationsDate');
      const timeEl = document.getElementById('operationsTime');

      if(weekdayEl){
        weekdayEl.textContent =
          weekday.charAt(0).toUpperCase() + weekday.slice(1);
      }

      if(dateEl) dateEl.textContent = date;
      if(timeEl) timeEl.textContent = time;
    };

    updateClock();
    this.clockTimer = setInterval(updateClock, 1000);

    this.relativeTimer = setInterval(() => {
      this.updateSynchronizationStatus();
    }, 1000);
  },

  setLoadingState(isLoading){
    const loader = document.getElementById('dashboardLoading');
    const dashboard = document.getElementById('dashboardView');

    if(loader){
      loader.classList.toggle('is-visible', Boolean(isLoading));
    }

    if(dashboard){
      dashboard.classList.toggle(
        'dashboard-is-loading',
        Boolean(isLoading)
      );
    }
  },

  updateSynchronizationStatus(){
    const label = document.getElementById('operationsSyncLabel');
    const ago = document.getElementById('operationsSyncAgo');
    const dot = document.getElementById('operationsSyncDot');

    if(!label || !ago || !dot) return;

    if(!this.lastDashboardUpdate){
      label.textContent = 'Sincronizando';
      ago.textContent = 'Esperando datos...';
      dot.className = 'sync-waiting';
      return;
    }

    const seconds = Math.max(
      0,
      Math.floor((Date.now() - this.lastDashboardUpdate) / 1000)
    );

    label.textContent = 'Sistema actualizado';

    if(seconds < 2){
      ago.textContent = 'Ahora mismo';
    }else if(seconds < 60){
      ago.textContent = `Hace ${seconds} segundos`;
    }else{
      const minutes = Math.floor(seconds / 60);
      ago.textContent =
        minutes === 1
          ? 'Hace 1 minuto'
          : `Hace ${minutes} minutos`;
    }

    dot.className =
      seconds <= 30
        ? 'sync-ok'
        : seconds <= 90
          ? 'sync-warning'
          : 'sync-error';
  },

  renderIncidentBanner(stats){
    const banner = document.getElementById(
      'operationsIncidentBanner'
    );

    if(!banner) return;

    const incidents = [];

    if(stats.alarmasHoy.length > 0){
      incidents.push({
        priority: 3,
        type: 'danger',
        icon: '!',
        title:
          stats.alarmasHoy.length === 1
            ? '1 alarma registrada hoy'
            : `${stats.alarmasHoy.length} alarmas registradas hoy`,
        detail: 'Revisar el módulo de Alarmas.'
      });
    }

    if(stats.pendientes.length > 0){
      incidents.push({
        priority: 2,
        type: 'warning',
        icon: 'WA',
        title:
          stats.pendientes.length === 1
            ? '1 envío de WhatsApp pendiente'
            : `${stats.pendientes.length} envíos de WhatsApp pendientes`,
        detail: 'Solo se consideran reportes del día actual.'
      });
    }

    if(stats.sinGps.length > 0){
      incidents.push({
        priority: 1,
        type: 'warning',
        icon: 'GPS',
        title:
          stats.sinGps.length === 1
            ? '1 reporte sin ubicación GPS'
            : `${stats.sinGps.length} reportes sin ubicación GPS`,
        detail: 'Conviene verificar la captura de ubicación.'
      });
    }

    incidents.sort((a, b) => b.priority - a.priority);

    if(!incidents.length){
      banner.className =
        'operations-incident-banner operations-all-clear';

      banner.innerHTML = `
        <div class="incident-icon">✓</div>

        <div class="incident-main">
          <b>Operación sin incidencias críticas</b>
          <span>
            No hay alarmas, pendientes de WhatsApp ni reportes sin GPS.
          </span>
        </div>

        <span class="incident-status">NORMAL</span>
      `;

      return;
    }

    const main = incidents[0];

    banner.className =
      `operations-incident-banner incident-${main.type}`;

    banner.innerHTML = `
      <div class="incident-icon">
        ${AdminUtils.escapeHtml(main.icon)}
      </div>

      <div class="incident-main">
        <b>${AdminUtils.escapeHtml(main.title)}</b>
        <span>${AdminUtils.escapeHtml(main.detail)}</span>
      </div>

      <div class="incident-extra">
        ${
          incidents.length > 1
            ? `+${incidents.length - 1} incidencia${incidents.length === 2 ? '' : 's'}`
            : 'REVISAR'
        }
      </div>
    `;
  },

  animateKpiChanges(){
    const ids = [
      'kpiReportesHoy',
      'kpiAlarmasHoy',
      'kpiPendientes',
      'kpiTotal',
      'kpiSinGps',
      'kpiFotosHoy'
    ];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;

      const value = el.textContent.trim();
      const previous = this.previousKpis[id];

      if(previous !== undefined && previous !== value){
        el.classList.remove('kpi-value-updated');

        void el.offsetWidth;

        el.classList.add('kpi-value-updated');

        setTimeout(() => {
          el.classList.remove('kpi-value-updated');
        }, 650);
      }

      this.previousKpis[id] = value;
    });
  },

  setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = value;
  },

  applyKpiHealth(stats){
    const map = [
      ['kpiReportesHoy', stats.reportesHoy >= 50 ? 'ok' : stats.reportesHoy >= 20 ? 'warn' : 'danger'],
      ['kpiAlarmasHoy', stats.alarmasHoy === 0 ? 'ok' : stats.alarmasHoy <= 2 ? 'warn' : 'danger'],
      ['kpiTotal', 'ok']
    ];

    map.forEach(([id, state]) => {
      const card = document.getElementById(id)?.closest('.kpi-card');
      if(!card) return;
      card.classList.remove('kpi-ok','kpi-warn','kpi-danger');
      card.classList.add('kpi-' + state);
    });
  },

  injectExtraDashboard(){

    // Desactivado en el diseño aprobado.

    // Los KPI secundarios no forman parte del Inicio final.

  },

  wellKey(row){
    const raw = String(AdminUtils.placeText(row) || '')
      .trim()
      .toUpperCase();

    if(!raw) return '';

    // El avance de 246 corresponde únicamente a pozos.
    // Excluye registros operativos como NOTA, CABEZAL o ESTACIÓN.
    const match = raw.match(/(?:C[-\s]*)?(\d+[A-Z]?)/i);
    if(!match) return '';

    return match[1].toUpperCase();
  },

  uniqueWells(rows){
    return new Set(
      rows.map(row => this.wellKey(row)).filter(Boolean)
    );
  },

  renderExecutiveSummary(){

    // Desactivado en el diseño aprobado.

    // El resumen ejecutivo no forma parte de la referencia visual.

  },

  renderHourlyChart(rows){
    const u = AdminUtils;
    const counts = Array.from({length:24}, () => 0);

    rows.forEach(row => {
      const d = u.dateObj(row);
      if(d && !isNaN(d)) counts[d.getHours()]++;
    });

    const max = Math.max(...counts, 1);
    const el = document.getElementById('hourChart');
    if(!el) return;

    el.innerHTML = counts.map((value, hour) => {
      const h = Math.max(6, Math.round((value / max) * 100));
      return `
        <div class="bar-wrap" title="${hour}:00 - ${value} reportes">
          <div class="bar-value">${value || ''}</div>
          <div class="bar" style="height:${h}px"></div>
          <div class="bar-label">${String(hour).padStart(2,'0')}</div>
        </div>
      `;
    }).join('');
  },

  renderCondicionPera(rows){

    const u = AdminUtils;
    const el = document.getElementById('condicionPeraDashboard');

    if(!el) return;

    /*
     * ESTADO VIGENTE:
     * tomar únicamente el último reporte disponible de
     * COND. DE PERA de cada pozo.
     *
     * NO acumular por mes.
     * NO sumar reportes históricos.
     */
    const ultimoPorPozo = new Map();

    (rows || []).forEach(row => {

      const msg = String(
        row.msg ||
        row.mensaje ||
        row.observaciones ||
        row.obs ||
        ''
      );

      if(!/COND\.?\s*DE\s*PERA/i.test(msg)) return;

      let pozo = String(
        u.placeText(row) || ''
      ).trim();

      /*
       * Si Firebase no trae el pozo como campo,
       * obtenerlo del encabezado del reporte.
       */
      if(!pozo){
        const mPozo = msg.match(
          /(?:^|\n)[^\n]*?C[-\s]?(\d{2,4})[^\n]*/i
        );

        if(mPozo){
          pozo = 'C-' + mPozo[1];
        }
      }

      if(!pozo) return;

      const numero = pozo.match(/\d+/);

      if(numero){
        pozo = 'C-' + numero[0];
      }

      const key = pozo.toUpperCase();
      const fecha = u.dateObj(row);
      const tiempo =
        fecha && !isNaN(fecha.getTime())
          ? fecha.getTime()
          : u.getTime(row);

      const anterior = ultimoPorPozo.get(key);

      /*
       * Conservamos exclusivamente el reporte más reciente
       * de condición de pera para cada pozo.
       */
      if(
        anterior &&
        Number(anterior.tiempo || 0) >= Number(tiempo || 0)
      ){
        return;
      }

      /*
       * Extraer solamente el bloque COND. DE PERA.
       * El siguiente separador marca el final del bloque.
       */
      const inicioPera = msg.search(/COND\.?\s*DE\s*PERA/i);

      let bloque = inicioPera >= 0
        ? msg.slice(inicioPera)
        : '';

      const despuesTitulo = bloque.indexOf('\n');

      if(despuesTitulo >= 0){
        const resto = bloque.slice(despuesTitulo + 1);

        const separador = resto.search(
          /\n\s*(?:={3,}|_{3,}|-{3,})\s*(?:\n|$)/
        );

        if(separador >= 0){
          bloque =
            bloque.slice(0, despuesTitulo + 1) +
            resto.slice(0, separador);
        }
      }

      /*
       * Contar las X del último reporte.
       * Cada ❌ dentro del bloque representa una incidencia
       * vigente reportada para la condición de la pera.
       */
      const cantidadX =
        (bloque.match(/❌/g) || []).length;

      /*
       * Estado individual de los cuatro componentes.
       * El reporte solamente incluye los componentes BAD,
       * por ejemplo: ❌ Área de pozo
       */
      const estadoPera = {
        areaPozo:
          /❌\s*Área\s+de\s+pozo/i.test(bloque),

        contrapozo:
          /❌\s*Contrapozo/i.test(bloque),

        cerco:
          /❌\s*Cerco\s+perimetral/i.test(bloque),

        bayoneta:
          /❌\s*Bayoneta/i.test(bloque)
      };

      /*
       * Obtener observación del mismo último reporte.
       */
      const lineas = bloque
        .split(/\r?\n/)
        .map(x => x.replace(/\*/g, '').trim())
        .filter(Boolean);

      let observacion = '';

      const lineaObs = lineas.find(
        x => /^📝/.test(x)
      );

      if(lineaObs){
        observacion = lineaObs
          .replace(/^📝\s*/, '')
          .trim();
      }

      /*
       * Respaldo para mensajes donde la observación
       * no venga precedida por 📝.
       */
      if(!observacion){
        const idxContra = lineas.findIndex(
          x => /Contrapozo/i.test(x)
        );

        if(idxContra >= 0 && lineas[idxContra + 1]){
          observacion = lineas[idxContra + 1]
            .replace(/^📝\s*/, '')
            .trim();
        }
      }

      if(!observacion){
        observacion = 'Sin observación registrada';
      }

      ultimoPorPozo.set(key, {
        pozo,
        cantidad: cantidadX,
        requiereAtencion: cantidadX > 0,
        estadoPera,
        observacion,
        fecha,
        tiempo
      });
    });


    /*
     * Mostrar solamente pozos cuyo último reporte
     * todavía tenga una o más ❌.
     *
     * Si el último reporte ya no tiene ❌,
     * la condición se considera atendida y desaparece.
     */
    const lista = Array
      .from(ultimoPorPozo.values())
      .sort((a, b) => {

        /*
         * Primero los que requieren atención.
         * Después los que están OK.
         */
        const atencionA = a.cantidad > 0 ? 1 : 0;
        const atencionB = b.cantidad > 0 ? 1 : 0;

        if(atencionB !== atencionA){
          return atencionB - atencionA;
        }

        /*
         * Entre los que requieren atención:
         * mayor cantidad de incidencias primero.
         */
        if(
          atencionA &&
          atencionB &&
          b.cantidad !== a.cantidad
        ){
          return b.cantidad - a.cantidad;
        }

        /*
         * En empate, el reporte más reciente primero.
         */
        return Number(b.tiempo || 0) -
               Number(a.tiempo || 0);
      });


    if(!lista.length){

      el.innerHTML = `
        <div class="dashboard-empty"
             style="color:#64748b;">
          No hay reportes de condición de pera.
        </div>
      `;

      return;
    }


    el.innerHTML = lista.map(item => {

      const fechaTexto =
        item.fecha && !isNaN(item.fecha.getTime())
          ? item.fecha.toLocaleDateString('es-MX')
          : '';

      return `
        <div class="dashboard-cond-pera-item"
             style="
               display:grid;
               grid-template-columns:140px minmax(0,1fr);
               gap:22px;
               align-items:center;
               padding:18px 10px;
               border-bottom:1px solid #dbe3ee;
             ">

          <div>

            <div style="
              font-size:20px;
              line-height:1.15;
              font-weight:800;
              color:#c62828;
              letter-spacing:-0.2px;
            ">
              <div class="cond-pera-semaforo"
               aria-label="Condición de la pera">
            <span class="cond-pera-dot cond-pera-dot-area ${item.estadoPera?.areaPozo ? 'activo' : ''}"
                  title="Área de pozo"></span>
            <span class="cond-pera-dot cond-pera-dot-contra ${item.estadoPera?.contrapozo ? 'activo' : ''}"
                  title="Contrapozo"></span>
            <span class="cond-pera-dot cond-pera-dot-cerco ${item.estadoPera?.cerco ? 'activo' : ''}"
                  title="Cerco perimetral"></span>
            <span class="cond-pera-dot cond-pera-dot-bayoneta ${item.estadoPera?.bayoneta ? 'activo' : ''}"
                  title="Bayoneta"></span>
          </div>

          ${u.escapeHtml(item.pozo)}
            </div>

          </div>

          <div>

            <div style="
              display:inline-block;
              margin-bottom:7px;
              font-size:12px;
              line-height:1;
              font-weight:800;
              letter-spacing:.3px;
              color:${item.requiereAtencion ? '#c62828' : '#16803a'};
            ">
              ${item.requiereAtencion ? 'REQUIERE ATENCIÓN' : 'OK'}
            </div>

            <div style="
              font-size:15px;
              line-height:1.45;
              font-weight:650;
              color:#172033;
            ">
              ${u.escapeHtml(item.observacion)}
            </div>

            ${
              fechaTexto
                ? `
                  <div style="
                    margin-top:6px;
                    font-size:12px;
                    font-weight:600;
                    color:#64748b;
                  ">
                    Último reporte: ${u.escapeHtml(fechaTexto)}
                  </div>
                `
                : ''
            }

          </div>

        </div>
      `;
    }).join('');
  },


  renderList(id, rows, type){

    const u = AdminUtils;

    const el = document.getElementById(id);


    if(!el) return;


    if(!rows.length){

      el.innerHTML = `

        <div class="dashboard-empty">

          ${

            type === 'alarma'

              ? 'No hay alertas recientes.'

              : 'No hay reportes recientes.'

          }

        </div>

      `;

      return;

    }


    el.innerHTML = rows.map(row => {

      const lugar =

        u.placeText(row) ||

        (type === 'alarma' ? 'Alerta operativa' : 'Sin pozo o lugar');


      const persona =

        u.personText(row) ||

        'Sin usuario';


      const modo =

        u.modeText(row) ||

        row.tipo ||

        (type === 'alarma' ? 'Alerta' : 'Reporte');


      const status = String(

        row.whatsappStatus ||

        row.estado ||

        ''

      ).toLowerCase();


      const enviado =

        status.includes('sent') ||

        status.includes('enviado') ||

        row.whatsappSent === true;


      const pendiente =

        status.includes('pending') ||

        status.includes('pendiente');


      const nivelAlarma = String(

        row.prioridad ||

        row.nivel ||

        row.severidad ||

        'Alta'

      );


      if(type === 'alarma'){

        return `

          <div class="dashboard-row dashboard-row-alarm">

            <div class="dashboard-row-icon">!</div>


            <div class="dashboard-row-main">

              <b>${u.escapeHtml(lugar)}</b>

              <span>${u.escapeHtml(persona)}</span>

            </div>


            <time>${u.escapeHtml(u.fmtTime(row))}</time>


            <span class="dashboard-status status-danger">

              ${u.escapeHtml(nivelAlarma)}

            </span>

          </div>

        `;

      }


      return `

        <div class="dashboard-row dashboard-row-report">

          <div class="dashboard-row-icon">▣</div>


          <div class="dashboard-row-main">

            <b>

              ${u.escapeHtml(modo)} ·

              ${u.escapeHtml(lugar)}

            </b>


            <span>${u.escapeHtml(persona)}</span>

          </div>


          <time>${u.escapeHtml(u.fmtTime(row))}</time>


          <span class="dashboard-status ${

            enviado

              ? 'status-success'

              : pendiente

                ? 'status-warning'

                : 'status-neutral'

          }">

            ${

              enviado

                ? 'Enviado'

                : pendiente

                  ? 'Pendiente'

                  : 'Registrado'

            }

          </span>

        </div>

      `;

    }).join('');

  },

  renderDailyInsights(){

    // Desactivado en el diseño aprobado.

    // Pozos con mayor actividad permanece fuera del Inicio.

  },

  renderRecorredores(rows){

    const u = AdminUtils;

    const map = {};


    rows.forEach(row => {

      const name =

        u.personText(row) ||

        'Sin usuario';


      if(!map[name]){

        map[name] = {

          total: 0,

          gps: 0,

          fotos: 0,

          pozos: new Set(),

          ultimo: null

        };

      }


      map[name].total++;


      if(u.hasGps(row)){

        map[name].gps++;

      }


      map[name].fotos += Number(

        row.nFotos ||

        row.fotos?.length ||

        row.fotoUrls?.length ||

        0

      );


      const lugar =

        String(u.placeText(row) || '').trim();


      if(lugar){

        map[name].pozos.add(lugar);

      }


      if(

        !map[name].ultimo ||

        u.getTime(row) > u.getTime(map[name].ultimo)

      ){

        map[name].ultimo = row;

      }

    });


    const list = Object.entries(map).sort(

      (a, b) =>

        u.getTime(b[1].ultimo) -

        u.getTime(a[1].ultimo)

    );


    const el = document.getElementById('recList');


    if(!el) return;


    if(!list.length){

      el.innerHTML =

        '<div class="dashboard-empty">Sin actividad de recorredores hoy.</div>';


      return;

    }


    const maxReportes = Math.max(

      ...list.map(([, data]) => data.total),

      1

    );


    el.innerHTML = list.map(([name, data]) => {

      const nivel = this.activityLevel(data.ultimo);


      const porcentaje = Math.max(

        5,

        Math.round(

          (data.total / maxReportes) * 100

        )

      );


      return `

        <div class="dashboard-recorredor-card">

          <div class="dashboard-recorredor-top">

            <div class="dashboard-recorredor-person">

              <div class="dashboard-recorredor-name">

                <i></i>


                <b>${u.escapeHtml(name)}</b>


                <span>${u.escapeHtml(nivel.label)}</span>

              </div>


              <p>

                ${data.total} reportes ·

                ${data.pozos.size} pozos ·

                ${data.gps} con GPS ·

                ${data.fotos} fotos

              </p>

            </div>


            <div class="dashboard-recorredor-last">

              <b>

                ${u.escapeHtml(

                  u.placeText(data.ultimo) ||

                  'Sin pozo'

                )}

              </b>


              <span>

                ${u.escapeHtml(

                  u.fmtTime(data.ultimo)

                )}

              </span>


              <small>

                ${u.escapeHtml(nivel.text)}

              </small>

            </div>

          </div>


          <div class="dashboard-recorredor-progress">

            <i style="width:${porcentaje}%"></i>

          </div>

        </div>

      `;

    }).join('');

  },

  relativeTime(row){
    const mins = this.minutesAgo(row);

    if(mins < 1) return 'Ahora';
    if(mins === 1) return 'Hace 1 min';
    if(mins < 60) return `Hace ${mins} min`;

    const horas = Math.floor(mins / 60);
    const resto = mins % 60;

    if(horas < 24){
      if(resto === 0){
        return horas === 1 ? 'Hace 1 h' : `Hace ${horas} h`;
      }

      return horas === 1
        ? `Hace 1 h ${resto} min`
        : `Hace ${horas} h ${resto} min`;
    }

    const dias = Math.floor(horas / 24);
    return dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`;
  },

  activityLevel(row){
    const mins = this.minutesAgo(row);

    if(mins <= 30){
      return {
        className: 'active',
        text: this.relativeTime(row),
        label: 'Activo'
      };
    }

    if(mins <= 60){
      return {
        className: 'warning',
        text: this.relativeTime(row),
        label: 'Sin actividad reciente'
      };
    }

    return {
      className: 'inactive',
      text: this.relativeTime(row),
      label: 'Inactivo'
    };
  },

  minutesAgo(row){
    const t = AdminUtils.getTime(row);
    if(!t) return 999;
    return Math.max(0, Math.round((Date.now() - t) / 60000));
  }
};

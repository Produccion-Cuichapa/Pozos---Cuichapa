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

    // Pendientes WhatsApp: contar SOLO los de hoy.
    // Los pendientes históricos fueron pruebas y no deben ensuciar el dashboard.
    const pendientes = reportesHoy.filter(x => {
      const st = String(x.whatsappStatus || x.estado || '').toLowerCase();
      return st.includes('pending') || st.includes('pendiente');
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
    this.renderList('ultimasAlarmas', a.slice(0, 3), 'alarma');

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
      ['kpiPendientes', stats.pendientes <= 5 ? 'ok' : stats.pendientes <= 25 ? 'warn' : 'danger'],
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

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
    this.renderList('ultimosReportes', r.slice(0, 10), 'reporte');
    this.renderList('ultimasAlarmas', a.slice(0, 10), 'alarma');

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

  injectExtraDashboard(stats){
    if(!document.getElementById('kpiExtraGrid')){
      const mainGrid = document.querySelector('.kpi-grid');

      if(!mainGrid) return;

      mainGrid.insertAdjacentHTML('afterend', `
        <div id="kpiExtraGrid" class="kpi-grid extra-kpis dashboard-extra-clean">
          <article class="kpi-card">
            <span>Reportes sin GPS hoy</span>
            <strong id="kpiSinGps">0</strong>
            <small>Validación de ubicación</small>
          </article>

          <article class="kpi-card kpi-ok">
            <span>Fotos recibidas hoy</span>
            <strong id="kpiFotosHoy">0</strong>
            <small>Evidencia fotográfica</small>
          </article>

          <article class="kpi-card kpi-ok">
            <span>Estado operativo</span>
            <strong id="kpiEstado">OK</strong>
            <small id="kpiSyncTime">Sincronizando...</small>
          </article>
        </div>

        <article class="panel chart-panel">
          <div class="panel-head">
            <h2>Reportes por hora de hoy</h2>
            <span class="muted">Distribución operativa</span>
          </div>

          <div id="hourChart" class="hour-chart"></div>
        </article>
      `);
    }

    this.setText('kpiSinGps', stats.sinGps);
    this.setText('kpiFotosHoy', stats.fotosHoy);
    this.setText(
      'kpiEstado',
      stats.sinGps > 0 ? 'REVISAR' : 'OK'
    );

    this.setText(
      'kpiSyncTime',
      'Actualizado ' +
      new Date().toLocaleTimeString('es-MX', {
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit'
      })
    );

    const sinGpsCard =
      document.getElementById('kpiSinGps')
        ?.closest('.kpi-card');

    if(sinGpsCard){
      sinGpsCard.classList.remove(
        'kpi-ok',
        'kpi-warn',
        'kpi-danger'
      );

      sinGpsCard.classList.add(
        stats.sinGps === 0
          ? 'kpi-ok'
          : stats.sinGps <= 3
            ? 'kpi-warn'
            : 'kpi-danger'
      );
    }

    const estadoCard =
      document.getElementById('kpiEstado')
        ?.closest('.kpi-card');

    if(estadoCard){
      estadoCard.classList.remove(
        'kpi-ok',
        'kpi-warn',
        'kpi-danger'
      );

      estadoCard.classList.add(
        stats.sinGps === 0
          ? 'kpi-ok'
          : 'kpi-warn'
      );
    }
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

  renderExecutiveSummary(rows){
    const u = AdminUtils;
    const totalPozos = Number(this.EXPECTED_WELLS || 246);

    const visitados = this.uniqueWells(rows).size;
    const pendientes = Math.max(0, totalPozos - visitados);
    const porcentaje = totalPozos
      ? Math.min(100, Math.round((visitados / totalPozos) * 100))
      : 0;

    const ultimo = rows.reduce((actual, row) => {
      if(!actual) return row;
      return u.getTime(row) > u.getTime(actual) ? row : actual;
    }, null);

    if(!document.getElementById('executiveSummary')){
      const anchor =
        document.getElementById('kpiExtraGrid') ||
        document.querySelector('.kpi-grid');

      if(!anchor) return;

      anchor.insertAdjacentHTML('afterend', `
        <section id="executiveSummary" class="executive-summary">
          <article class="panel executive-progress-card">
            <div class="executive-card-head">
              <div>
                <span class="executive-eyebrow">OPERACIÓN DEL DÍA</span>
                <h2>Avance del recorrido</h2>
              </div>

              <strong id="executivePercent" class="executive-percent">0%</strong>
            </div>

            <div class="executive-progress-track">
              <i id="executiveProgressBar"></i>
            </div>

            <div class="executive-progress-stats">
              <div>
                <span>Visitados</span>
                <b id="executiveVisited">0</b>
              </div>

              <div>
                <span>Pendientes</span>
                <b id="executivePending">0</b>
              </div>

              <div>
                <span>Total monitoreado</span>
                <b id="executiveTotal">246</b>
              </div>
            </div>
          </article>

          <article class="panel latest-report-card">
            <div class="executive-card-head">
              <div>
                <span class="executive-eyebrow">ACTIVIDAD MÁS RECIENTE</span>
                <h2>Último reporte recibido</h2>
              </div>

              <span id="latestReportTime" class="latest-time">--:--</span>
            </div>

            <div id="latestReportBody" class="latest-report-body">
              <div class="empty">Sin reportes recibidos hoy.</div>
            </div>
          </article>
        </section>
      `);
    }

    this.setText('executivePercent', porcentaje + '%');
    this.setText('executiveVisited', visitados);
    this.setText('executivePending', pendientes);
    this.setText('executiveTotal', totalPozos);

    const progressBar = document.getElementById('executiveProgressBar');
    const progressCard = document.querySelector('.executive-progress-card');

    if(progressBar){
      progressBar.style.width = porcentaje + '%';
    }

    if(progressCard){
      progressCard.classList.remove(
        'progress-low',
        'progress-medium',
        'progress-high'
      );

      progressCard.classList.add(
        porcentaje >= 80
          ? 'progress-high'
          : porcentaje >= 40
            ? 'progress-medium'
            : 'progress-low'
      );
    }

    const body = document.getElementById('latestReportBody');
    if(!body) return;

    if(!ultimo){
      this.setText('latestReportTime', '--:--');
      body.innerHTML =
        '<div class="empty">Sin reportes recibidos hoy.</div>';
      return;
    }

    const persona = u.personText(ultimo) || 'Sin recorredor';
    const lugar = u.placeText(ultimo) || 'Sin pozo o lugar';
    const tipo = u.modeText(ultimo) || ultimo.tipo || 'Reporte';
    const tieneGps = u.hasGps(ultimo);

    const estadoWhatsApp = String(
      ultimo.whatsappStatus || ultimo.estado || ''
    ).toLowerCase();

    const whatsappEnviado =
      estadoWhatsApp.includes('sent') ||
      estadoWhatsApp.includes('enviado') ||
      ultimo.whatsappSent === true;

    const estatusPozo =
      ultimo.co?.estatus ||
      ultimo.estatus ||
      ultimo.estadoPozo ||
      '';

    const sap =
      ultimo.co?.sap ||
      ultimo.sap ||
      '';

    this.setText('latestReportTime', u.fmtTime(ultimo));

    body.innerHTML = `
      <div class="latest-report-main">
        <div>
          <span>Recorredor</span>
          <b>${u.escapeHtml(persona)}</b>
        </div>

        <div>
          <span>Pozo / lugar</span>
          <b>${u.escapeHtml(lugar)}</b>
        </div>

        <div>
          <span>Tipo de reporte</span>
          <b>${u.escapeHtml(tipo)}</b>
        </div>
      </div>

      <div class="latest-report-tags">
        ${
          estatusPozo
            ? `<span class="latest-badge neutral">${u.escapeHtml(estatusPozo)}</span>`
            : ''
        }

        ${
          sap
            ? `<span class="latest-badge neutral">SAP ${u.escapeHtml(sap)}</span>`
            : ''
        }

        <span class="latest-badge ${tieneGps ? 'success' : 'warning'}">
          ${tieneGps ? 'GPS disponible' : 'Sin GPS'}
        </span>

        <span class="latest-badge ${whatsappEnviado ? 'success' : 'warning'}">
          ${whatsappEnviado ? 'WhatsApp enviado' : 'WhatsApp pendiente'}
        </span>
      </div>
    `;
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
      el.innerHTML = `<div class="empty">Sin datos cargados.</div>`;
      return;
    }

    el.innerHTML = rows.map(row => {
      const status = row.whatsappStatus || row.estado || '';
      const gps = u.hasGps(row) ? 'GPS' : 'Sin GPS';
      return `
        <div class="list-item">
          <b>${u.escapeHtml(u.placeText(row) || 'Sin pozo/lugar')}</b>
          <span>
            ${u.escapeHtml(u.fmtDate(row))} ${u.escapeHtml(u.fmtTime(row))}
            · ${u.escapeHtml(u.personText(row) || 'Sin usuario')}
            · ${u.escapeHtml(type)}
            · ${u.escapeHtml(status || '-')}
            · ${u.escapeHtml(gps)}
          </span>
        </div>
      `;
    }).join('');
  },

  renderDailyInsights(rows){
    const u = AdminUtils;

    if(!document.getElementById('dailyInsights')){
      const hourPanel =
        document.getElementById('hourChart')
          ?.closest('.panel');

      if(!hourPanel) return;

      hourPanel.insertAdjacentHTML('afterend', `
        <section id="dailyInsights"
                 class="daily-insights daily-insights-clean">
          <article class="panel daily-insight-panel">
            <div class="panel-head">
              <h2>Pozos con mayor actividad hoy</h2>
              <span class="muted">Cantidad de reportes</span>
            </div>

            <div id="topWellsToday"
                 class="ranking-list">
            </div>
          </article>
        </section>
      `);
    }

    const wellCounts = {};

    rows.forEach(row => {
      const key = this.wellKey(row);

      if(!key) return;

      if(!wellCounts[key]){
        wellCounts[key] = {
          total: 0,
          last: null
        };
      }

      wellCounts[key].total++;

      if(
        !wellCounts[key].last ||
        u.getTime(row) >
        u.getTime(wellCounts[key].last)
      ){
        wellCounts[key].last = row;
      }
    });

    const topWells = Object.entries(wellCounts)
      .sort((a, b) => {
        if(b[1].total !== a[1].total){
          return b[1].total - a[1].total;
        }

        return (
          u.getTime(b[1].last) -
          u.getTime(a[1].last)
        );
      })
      .slice(0, 5);

    const rankingEl =
      document.getElementById('topWellsToday');

    if(!rankingEl) return;

    if(!topWells.length){
      rankingEl.innerHTML =
        '<div class="empty">Sin pozos reportados hoy.</div>';

      return;
    }

    const max = Math.max(
      ...topWells.map(([, data]) => data.total),
      1
    );

    rankingEl.innerHTML = topWells
      .map(([well, data], index) => {
        const width = Math.max(
          8,
          Math.round(
            (data.total / max) * 100
          )
        );

        return `
          <div class="ranking-item">
            <div class="ranking-position">
              ${index + 1}
            </div>

            <div class="ranking-main">
              <div class="ranking-head">
                <b>
                  Pozo ${u.escapeHtml(well)}
                </b>

                <span>
                  ${data.total}
                  ${
                    data.total === 1
                      ? 'reporte'
                      : 'reportes'
                  }
                </span>
              </div>

              <div class="ranking-progress">
                <i style="width:${width}%"></i>
              </div>

              <small>
                Última actividad:
                ${u.escapeHtml(
                  u.fmtTime(data.last)
                )}
              </small>
            </div>
          </div>
        `;
      })
      .join('');
  },

  renderRecorredores(rows){
    const u = AdminUtils;

    if(!document.getElementById('recPanel')){
      const insights =
        document.getElementById('dailyInsights');

      const hourPanel =
        document.getElementById('hourChart')
          ?.closest('.panel');

      const anchor = insights || hourPanel;

      if(anchor){
        anchor.insertAdjacentHTML('afterend', `
          <article id="recPanel"
                   class="panel chart-panel compact-recorredores-panel">
            <div class="panel-head">
              <h2>Recorredores activos hoy</h2>
              <span class="muted">Avance por persona</span>
            </div>

            <div id="recList"
                 class="rec-list">
            </div>
          </article>
        `);
      }
    }

    const map = {};

    rows.forEach(r => {
      const name = u.personText(r) || 'Sin usuario';

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

      if(u.hasGps(r)){
        map[name].gps++;
      }

      map[name].fotos += Number(
        r.nFotos ||
        r.fotos?.length ||
        r.fotoUrls?.length ||
        0
      );

      const lugar = String(u.placeText(r) || '').trim();
      if(lugar){
        map[name].pozos.add(lugar);
      }

      if(
        !map[name].ultimo ||
        u.getTime(r) > u.getTime(map[name].ultimo)
      ){
        map[name].ultimo = r;
      }
    });

    const list = Object.entries(map).sort(
      (a, b) => u.getTime(b[1].ultimo) - u.getTime(a[1].ultimo)
    );

    const el = document.getElementById('recList');
    if(!el) return;

    if(!list.length){
      el.innerHTML =
        '<div class="empty">Sin actividad de recorredores hoy.</div>';
      return;
    }

    const maxReportes = Math.max(
      ...list.map(([, data]) => data.total),
      1
    );

    el.innerHTML = list.map(([name, data]) => {
      const nivel = this.activityLevel(data.ultimo);
      const porcentaje = Math.max(
        4,
        Math.round((data.total / maxReportes) * 100)
      );

      return `
        <div class="rec-card rec-card-industrial rec-status-${nivel.className}">
          <div class="rec-top">
            <div class="rec-person-block">
              <div class="rec-name-row">
                <span class="rec-status-dot"></span>
                <b>${u.escapeHtml(name)}</b>
                <span class="rec-state-label">${nivel.label}</span>
              </div>

              <span class="rec-detail-line">
                ${data.total} reportes ·
                ${data.pozos.size} pozos ·
                ${data.gps} con GPS ·
                ${data.fotos} fotos
              </span>
            </div>

            <div class="rec-last">
              <b>${u.escapeHtml(u.placeText(data.ultimo) || 'Sin pozo')}</b>
              <span>${u.escapeHtml(u.fmtTime(data.ultimo))}</span>
              <small>${u.escapeHtml(nivel.text)}</small>
            </div>
          </div>

          <div class="rec-progress">
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

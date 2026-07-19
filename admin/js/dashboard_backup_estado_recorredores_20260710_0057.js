window.AdminDashboard = {
  EXPECTED_WELLS: 246,

  render(){
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

    const activos = new Set(reportesHoy.map(x => u.personText(x)).filter(Boolean));
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
      activos: activos.size,
      sinGps: sinGps.length,
      fotosHoy
    });

    this.renderExecutiveSummary(reportesHoy);
    this.renderHourlyChart(reportesHoy);
    this.renderWhatsappStatus(reportesHoy);
    this.renderRecorredores(reportesHoy);
    this.renderCentroControl(reportesHoy, alarmasHoy, r, a);
    this.renderList('ultimosReportes', r.slice(0, 10), 'reporte');
    this.renderList('ultimasAlarmas', a.slice(0, 10), 'alarma');
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
      mainGrid.insertAdjacentHTML('afterend', `
        <div id="kpiExtraGrid" class="kpi-grid extra-kpis">
          <article class="kpi-card kpi-ok">
            <span>Recorredores activos hoy</span>
            <strong id="kpiActivos">0</strong>
            <small>Personal en campo</small>
          </article>
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

    this.setText('kpiActivos', stats.activos);
    this.setText('kpiSinGps', stats.sinGps);
    this.setText('kpiFotosHoy', stats.fotosHoy);
    this.setText('kpiEstado', stats.sinGps > 0 ? 'REVISAR' : 'OK');
    this.setText('kpiSyncTime', 'Actualizado ' + new Date().toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit', second:'2-digit'}));

    const sinGpsCard = document.getElementById('kpiSinGps')?.closest('.kpi-card');
    if(sinGpsCard){
      sinGpsCard.classList.remove('kpi-ok','kpi-warn','kpi-danger');
      sinGpsCard.classList.add(stats.sinGps === 0 ? 'kpi-ok' : stats.sinGps <= 3 ? 'kpi-warn' : 'kpi-danger');
    }

    const estadoCard = document.getElementById('kpiEstado')?.closest('.kpi-card');
    if(estadoCard){
      estadoCard.classList.remove('kpi-ok','kpi-warn','kpi-danger');
      estadoCard.classList.add(stats.sinGps === 0 ? 'kpi-ok' : 'kpi-warn');
    }
  },

  renderExecutiveSummary(rows){
    const u = AdminUtils;
    const totalPozos = Number(this.EXPECTED_WELLS || 246);

    const nombresPozos = rows
      .map(row => String(u.placeText(row) || '').trim())
      .filter(nombre => nombre && /\d/.test(nombre));

    const visitados = new Set(nombresPozos).size;
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

  renderWhatsappStatus(rows){
    if(!document.getElementById('waPanel')){
      document.querySelector('.chart-panel').insertAdjacentHTML('afterend', `
        <article id="waPanel" class="panel chart-panel">
          <div class="panel-head">
            <h2>Estado WhatsApp</h2>
            <span class="muted">Solo reportes de hoy</span>
          </div>
          <div class="wa-grid">
            <div><b id="waSent">0</b><span>Enviados</span></div>
            <div><b id="waPending">0</b><span>Pendientes</span></div>
            <div><b id="waError">0</b><span>Error</span></div>
            <div><b id="waOther">0</b><span>Otros</span></div>
          </div>
        </article>

        <article id="recPanel" class="panel chart-panel">
          <div class="panel-head">
            <h2>Recorredores activos hoy</h2>
            <span class="muted">Avance por persona</span>
          </div>
          <div id="recList" class="rec-list"></div>
        </article>
      `);
    }

    const wa = { sent:0, pending:0, error:0, other:0 };

    rows.forEach(r => {
      const st = String(r.whatsappStatus || r.estado || '').toLowerCase();
      if(st.includes('sent') || st.includes('enviado')) wa.sent++;
      else if(st.includes('pending') || st.includes('pendiente')) wa.pending++;
      else if(st.includes('error') || st.includes('fail')) wa.error++;
      else wa.other++;
    });

    this.setText('waSent', wa.sent);
    this.setText('waPending', wa.pending);
    this.setText('waError', wa.error);
    this.setText('waOther', wa.other);
  },

  renderRecorredores(rows){
    const u = AdminUtils;
    const map = {};

    rows.forEach(r => {
      const name = u.personText(r) || 'Sin usuario';
      if(!map[name]) map[name] = { total:0, gps:0, fotos:0, ultimo:null };
      map[name].total++;
      if(u.hasGps(r)) map[name].gps++;
      map[name].fotos += Number(r.nFotos || r.fotos?.length || r.fotoUrls?.length || 0);
      if(!map[name].ultimo || u.getTime(r) > u.getTime(map[name].ultimo)) map[name].ultimo = r;
    });

    const list = Object.entries(map).sort((a,b) => b[1].total - a[1].total);
    const el = document.getElementById('recList');
    if(!el) return;

    if(!list.length){
      el.innerHTML = '<div class="empty">Sin actividad de recorredores hoy.</div>';
      return;
    }

    const max = Math.max(...list.map(x => x[1].total), 1);

    el.innerHTML = list.map(([name, data]) => {
      const pct = Math.max(4, Math.round((data.total / max) * 100));
      return `
        <div class="rec-card rec-card-industrial">
          <div class="rec-top">
            <div>
              <b>${u.escapeHtml(name)}</b>
              <span>${data.total} reportes · ${data.gps} GPS · ${data.fotos} fotos</span>
            </div>
            <div class="rec-last">
              ${u.escapeHtml(u.placeText(data.ultimo) || 'Sin pozo')}<br>
              <small>${u.escapeHtml(u.fmtTime(data.ultimo))}</small>
            </div>
          </div>
          <div class="rec-progress">
            <i style="width:${pct}%"></i>
          </div>
        </div>
      `;
    }).join('');
  },

  renderCentroControl(reportesHoy, alarmasHoy, reportesTodos, alarmasTodas){
    const u = AdminUtils;

    if(!document.getElementById('controlPanel')){
      document.querySelector('.dashboard-grid').insertAdjacentHTML('beforebegin', `
        <article id="controlPanel" class="panel control-panel industrial-control">
          <div class="panel-head">
            <h2>Centro de Control Operativo</h2>
            <span class="muted">Última actividad en campo</span>
          </div>

          <div class="ops-summary">
            <div>
              <span>Avance de recorrido</span>
              <b id="opsProgressText">0 / 246</b>
              <div class="ops-progress"><i id="opsProgressBar"></i></div>
            </div>
            <div><span>Pozos monitoreados</span><b id="opsTotalPozos">246</b></div>
            <div><span>Visitados hoy</span><b id="opsVisitados">0</b></div>
            <div><span>Pendientes estimados</span><b id="opsPendientes">0</b></div>
          </div>

          <div class="health-row">
            <span class="health-chip ok">Firebase conectado</span>
            <span id="healthWa" class="health-chip ok">WhatsApp OK</span>
            <span id="healthGps" class="health-chip ok">GPS OK</span>
            <span class="health-chip ok">Exportaciones OK</span>
          </div>

          <div class="control-grid">
            <div>
              <h3>Recorredores en campo</h3>
              <div id="controlRecorredores" class="control-list"></div>
            </div>

            <div>
              <h3>Actividad en vivo</h3>
              <div id="actividadViva" class="activity-feed"></div>
            </div>
          </div>
        </article>
      `);
    }

    const visitados = new Set(reportesHoy.map(r => String(u.placeText(r) || '').trim()).filter(Boolean)).size;
    const pendientesCampo = Math.max(0, this.EXPECTED_WELLS - visitados);
    const pct = Math.min(100, Math.round((visitados / this.EXPECTED_WELLS) * 100));

    this.setText('opsProgressText', `${visitados} / ${this.EXPECTED_WELLS} pozos`);
    this.setText('opsTotalPozos', this.EXPECTED_WELLS);
    this.setText('opsVisitados', visitados);
    this.setText('opsPendientes', pendientesCampo);

    const bar = document.getElementById('opsProgressBar');
    if(bar) bar.style.width = pct + '%';

    // Salud WhatsApp: solo pendientes de hoy.
    const pendientesWa = reportesHoy.filter(x => {
      const st = String(x.whatsappStatus || x.estado || '').toLowerCase();
      return st.includes('pending') || st.includes('pendiente');
    }).length;

    const sinGpsHoy = reportesHoy.filter(x => !u.hasGps(x)).length;

    const waChip = document.getElementById('healthWa');
    if(waChip){
      waChip.className = 'health-chip ' + (pendientesWa <= 5 ? 'ok' : pendientesWa <= 25 ? 'warn' : 'danger');
      waChip.textContent = pendientesWa <= 5 ? 'WhatsApp OK' : `WhatsApp ${pendientesWa} pendientes`;
    }

    const gpsChip = document.getElementById('healthGps');
    if(gpsChip){
      gpsChip.className = 'health-chip ' + (sinGpsHoy === 0 ? 'ok' : sinGpsHoy <= 3 ? 'warn' : 'danger');
      gpsChip.textContent = sinGpsHoy === 0 ? 'GPS OK' : `GPS ${sinGpsHoy} sin ubicación`;
    }

    const porPersona = {};
    reportesHoy.forEach(r => {
      const name = u.personText(r) || 'Sin usuario';
      if(!porPersona[name] || u.getTime(r) > u.getTime(porPersona[name])){
        porPersona[name] = r;
      }
    });

    const recRows = Object.entries(porPersona)
      .sort((a,b) => u.getTime(b[1]) - u.getTime(a[1]))
      .slice(0, 8);

    document.getElementById('controlRecorredores').innerHTML = recRows.map(([name, r]) => {
      const mins = this.minutesAgo(r);
      const ok = mins <= 30;
      const gps = u.hasGps(r);
      const place = u.placeText(r) || 'Sin pozo';
      return `
        <div class="control-person ${ok ? 'online' : 'idle'}">
          <div class="status-dot"></div>
          <div class="control-main">
            <b>${u.escapeHtml(name)}</b>
            <span>${u.escapeHtml(place)} · ${mins} min</span>
          </div>
          <div class="control-tags">
            <span class="badge ${gps ? 'ok' : 'warn'}">${gps ? 'GPS' : 'Sin GPS'}</span>
          </div>
        </div>
      `;
    }).join('') || '<div class="empty">Sin actividad de recorredores.</div>';

    const eventos = [
      ...reportesTodos.slice(0,20).map(x => ({ kind:'reporte', row:x })),
      ...alarmasTodas.slice(0,10).map(x => ({ kind:'alarma', row:x }))
    ].sort((a,b) => u.getTime(b.row) - u.getTime(a.row)).slice(0,15);

    document.getElementById('actividadViva').innerHTML = eventos.map(ev => {
      const r = ev.row;
      const isAlarm = ev.kind === 'alarma';
      return `
        <div class="activity-item ${isAlarm ? 'alarm' : ''}">
          <div class="activity-time">${u.escapeHtml(u.fmtTime(r))}</div>
          <div class="activity-icon">${isAlarm ? '🚨' : '●'}</div>
          <div>
            <b>${u.escapeHtml(u.personText(r) || 'Sin usuario')}</b>
            <span>
              ${isAlarm ? 'Alarma' : (u.modeText(r) || 'Reporte')} ·
              ${u.escapeHtml(u.placeText(r) || 'Sin pozo/lugar')}
            </span>
          </div>
        </div>
      `;
    }).join('') || '<div class="empty">Sin actividad reciente.</div>';
  },

  minutesAgo(row){
    const t = AdminUtils.getTime(row);
    if(!t) return 999;
    return Math.max(0, Math.round((Date.now() - t) / 60000));
  }
};

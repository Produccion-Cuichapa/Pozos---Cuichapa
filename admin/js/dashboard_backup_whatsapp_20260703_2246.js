window.AdminDashboard = {
  render(){
    const r = window.AdminFirebase.reportes || [];
    const a = window.AdminFirebase.alarmas || [];
    const u = AdminUtils;

    const reportesHoy = r.filter(x => u.sameToday(x));
    const alarmasHoy = a.filter(x => u.sameToday(x));

    const pendientes = r.filter(x => {
      const st = String(x.whatsappStatus || x.estado || '').toLowerCase();
      return st.includes('pending') || st.includes('pendiente');
    });

    const activos = new Set(
      reportesHoy.map(x => u.personText(x)).filter(Boolean)
    );

    const sinGps = reportesHoy.filter(x => !u.hasGps(x));

    const fotosHoy = reportesHoy.reduce((sum, x) => {
      return sum + Number(x.nFotos || x.fotos?.length || x.fotoUrls?.length || 0);
    }, 0);

    document.getElementById('kpiReportesHoy').textContent = reportesHoy.length;
    document.getElementById('kpiAlarmasHoy').textContent = alarmasHoy.length;
    document.getElementById('kpiPendientes').textContent = pendientes.length;
    document.getElementById('kpiTotal').textContent = r.length + a.length;

    this.injectExtraDashboard({
      activos: activos.size,
      sinGps: sinGps.length,
      fotosHoy
    });

    this.renderList('ultimosReportes', r.slice(0, 10), 'reporte');
    this.renderList('ultimasAlarmas', a.slice(0, 10), 'alarma');
    this.renderHourlyChart(reportesHoy);
  },

  injectExtraDashboard(stats){
    if(!document.getElementById('kpiExtraGrid')){
      const mainGrid = document.querySelector('.kpi-grid');
      mainGrid.insertAdjacentHTML('afterend', `
        <div id="kpiExtraGrid" class="kpi-grid extra-kpis">
          <article class="kpi-card">
            <span>Recorredores activos hoy</span>
            <strong id="kpiActivos">0</strong>
          </article>
          <article class="kpi-card">
            <span>Reportes sin GPS hoy</span>
            <strong id="kpiSinGps">0</strong>
          </article>
          <article class="kpi-card">
            <span>Fotos recibidas hoy</span>
            <strong id="kpiFotosHoy">0</strong>
          </article>
          <article class="kpi-card">
            <span>Estado operativo</span>
            <strong id="kpiEstado">OK</strong>
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

    document.getElementById('kpiActivos').textContent = stats.activos;
    document.getElementById('kpiSinGps').textContent = stats.sinGps;
    document.getElementById('kpiFotosHoy').textContent = stats.fotosHoy;
    document.getElementById('kpiEstado').textContent = stats.sinGps > 0 ? 'REVISAR' : 'OK';
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
  }
};

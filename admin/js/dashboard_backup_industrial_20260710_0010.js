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

    this.renderWhatsappStatus(r);
    this.renderRecorredores(reportesHoy);
    this.renderCentroControl(r, a);

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
  },

  renderWhatsappStatus(rows){
    if(!document.getElementById('waPanel')){
      document.querySelector('.chart-panel').insertAdjacentHTML('afterend', `
        <article id="waPanel" class="panel chart-panel">
          <div class="panel-head">
            <h2>Estado WhatsApp</h2>
            <span class="muted">Todos los reportes cargados</span>
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
            <span class="muted">Actividad por persona</span>
          </div>
          <div id="recList" class="rec-list"></div>
        </article>
      `);
    }

    let sent = 0, pending = 0, error = 0, other = 0;

    rows.forEach(r => {
      const st = String(r.whatsappStatus || r.estado || '').toLowerCase();
      if(st.includes('sent') || st.includes('enviado')) sent++;
      else if(st.includes('pending') || st.includes('pendiente')) pending++;
      else if(st.includes('error') || st.includes('fail')) error++;
      else other++;
    });

    document.getElementById('waSent').textContent = sent;
    document.getElementById('waPending').textContent = pending;
    document.getElementById('waError').textContent = error;
    document.getElementById('waOther').textContent = other;
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

    const list = Object.entries(map)
      .sort((a,b) => b[1].total - a[1].total);

    const el = document.getElementById('recList');
    if(!el) return;

    if(!list.length){
      el.innerHTML = '<div class="empty">Sin actividad de recorredores hoy.</div>';
      return;
    }

    el.innerHTML = list.map(([name, data]) => `
      <div class="rec-card">
        <div>
          <b>${u.escapeHtml(name)}</b>
          <span>${data.total} reportes · ${data.gps} con GPS · ${data.fotos} fotos</span>
        </div>
        <div class="rec-last">
          ${u.escapeHtml(u.placeText(data.ultimo) || 'Sin pozo')}<br>
          <small>${u.escapeHtml(u.fmtTime(data.ultimo))}</small>
        </div>
      </div>
    `).join('');
  }
,

  renderCentroControl(reportes, alarmas){
    const u = AdminUtils;

    if(!document.getElementById('controlPanel')){
      document.querySelector('.dashboard-grid').insertAdjacentHTML('beforebegin', `
        <article id="controlPanel" class="panel control-panel">
          <div class="panel-head">
            <h2>Centro de Control Operativo</h2>
            <span class="muted">Última actividad en campo</span>
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

    const porPersona = {};
    reportes.forEach(r => {
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
      ...reportes.slice(0,20).map(x => ({ kind:'reporte', row:x })),
      ...alarmas.slice(0,10).map(x => ({ kind:'alarma', row:x }))
    ].sort((a,b) => u.getTime(b.row) - u.getTime(a.row)).slice(0,15);

    document.getElementById('actividadViva').innerHTML = eventos.map(ev => {
      const r = ev.row;
      const isAlarm = ev.kind === 'alarma';
      return `
        <div class="activity-item ${isAlarm ? 'alarm' : ''}">
          <div class="activity-icon">${isAlarm ? '🚨' : '📋'}</div>
          <div>
            <b>${u.escapeHtml(u.personText(r) || 'Sin usuario')}</b>
            <span>
              ${isAlarm ? 'Alarma' : 'Reporte'} ·
              ${u.escapeHtml(u.placeText(r) || 'Sin pozo/lugar')} ·
              ${u.escapeHtml(u.fmtTime(r))}
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

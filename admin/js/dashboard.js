window.AdminDashboard = {
  render(){
    const r = window.AdminFirebase.reportes;
    const a = window.AdminFirebase.alarmas;
    const u = AdminUtils;

    document.getElementById('kpiReportesHoy').textContent = r.filter(x => u.sameToday(x)).length;
    document.getElementById('kpiAlarmasHoy').textContent = a.filter(x => u.sameToday(x)).length;
    document.getElementById('kpiPendientes').textContent = r.filter(x => {
      const st = String(x.whatsappStatus || x.estado || '').toLowerCase();
      return st.includes('pending') || st.includes('pendiente');
    }).length;
    document.getElementById('kpiTotal').textContent = r.length + a.length;

    this.renderList('ultimosReportes', r.slice(0, 8), 'reporte');
    this.renderList('ultimasAlarmas', a.slice(0, 8), 'alarma');
  },

  renderList(id, rows, type){
    const u = AdminUtils;
    const el = document.getElementById(id);

    if(!rows.length){
      el.innerHTML = `<div class="empty">Sin datos cargados.</div>`;
      return;
    }

    el.innerHTML = rows.map(row => `
      <div class="list-item">
        <b>${u.escapeHtml(u.placeText(row) || 'Sin pozo/lugar')}</b>
        <span>${u.escapeHtml(u.fmtDate(row))} ${u.escapeHtml(u.fmtTime(row))} · ${u.escapeHtml(u.personText(row) || 'Sin usuario')} · ${u.escapeHtml(type)}</span>
      </div>
    `).join('');
  }
};

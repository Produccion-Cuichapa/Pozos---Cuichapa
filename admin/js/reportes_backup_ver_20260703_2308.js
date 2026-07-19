window.AdminReportes = {
  init(){
    ['repDesde','repHasta','repBuscar','repModo'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.render());
    });

    document.getElementById('repLimpiar').addEventListener('click', () => {
      ['repDesde','repHasta','repBuscar','repModo'].forEach(id => document.getElementById(id).value = '');
      this.render();
    });

    document.getElementById('repExportar').addEventListener('click', () => {
      AdminExport.csv('reportes_pozos_cuichapa.csv', this.filtered());
    });
  },

  filtered(){
    const u = AdminUtils;
    const desde = document.getElementById('repDesde').value;
    const hasta = document.getElementById('repHasta').value;
    const buscar = document.getElementById('repBuscar').value.trim().toLowerCase();
    const modo = document.getElementById('repModo').value.toLowerCase();

    return window.AdminFirebase.reportes.filter(row => {
      const d = u.dateObj(row);
      const date = d ? u.ymd(d) : (row.fecha || '');
      const all = JSON.stringify(row).toLowerCase();

      if(desde && date < desde) return false;
      if(hasta && date > hasta) return false;
      if(modo && String(u.modeText(row)).toLowerCase() !== modo) return false;
      if(buscar && !all.includes(buscar)) return false;
      return true;
    });
  },

  render(){
    const rows = this.filtered();
    const u = AdminUtils;
    const body = document.getElementById('reportesTable');

    if(!rows.length){
      body.innerHTML = `<tr><td colspan="10">Sin reportes con esos filtros.</td></tr>`;
      return;
    }

    body.innerHTML = rows.map(row => {
      const st = row.whatsappStatus || row.estado || '';
      return `
        <tr>
          <td>${u.escapeHtml(u.fmtDate(row))}</td>
          <td>${u.escapeHtml(u.fmtTime(row))}</td>
          <td>${u.escapeHtml(u.personText(row))}</td>
          <td><span class="badge">${u.escapeHtml(u.modeText(row))}</span></td>
          <td>${u.escapeHtml(u.placeText(row))}</td>
          <td>${u.escapeHtml(row.co?.estatus || row.estatus || '')}</td>
          <td>${u.statusBadge(st)}</td>
          <td>${u.hasGps(row) ? '<span class="badge ok">GPS</span>' : '<span class="badge warn">Sin GPS</span>'}</td>
          <td>${u.escapeHtml(u.cut(u.obsText(row), 85))}</td>
          <td><button class="row-action" data-report-id="${u.escapeHtml(row.id)}">Ver</button></td>
        </tr>
      `;
    }).join('');

    body.querySelectorAll('[data-report-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = rows.find(x => x.id === btn.dataset.reportId);
        AdminUI.openDetail('reporte', item);
      });
    });
  }
};

window.AdminAlarmas = {
  init(){
    ['almDesde','almHasta','almBuscar'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.render());
    });

    document.getElementById('almLimpiar').addEventListener('click', () => {
      ['almDesde','almHasta','almBuscar'].forEach(id => document.getElementById(id).value = '');
      this.render();
    });

    document.getElementById('almExportar').addEventListener('click', () => {
      AdminExport.csv('alarmas_pozos_cuichapa.csv', this.filtered());
    });
  },

  filtered(){
    const u = AdminUtils;
    const desde = document.getElementById('almDesde').value;
    const hasta = document.getElementById('almHasta').value;
    const buscar = document.getElementById('almBuscar').value.trim().toLowerCase();

    return window.AdminFirebase.alarmas.filter(row => {
      const d = u.dateObj(row);
      const date = d ? u.ymd(d) : (row.fecha || '');
      const all = JSON.stringify(row).toLowerCase();

      if(desde && date < desde) return false;
      if(hasta && date > hasta) return false;
      if(buscar && !all.includes(buscar)) return false;
      return true;
    });
  },

  render(){
    const rows = this.filtered();
    const u = AdminUtils;
    const body = document.getElementById('alarmasTable');

    if(!rows.length){
      body.innerHTML = `<tr><td colspan="8">Sin alarmas con esos filtros.</td></tr>`;
      return;
    }

    body.innerHTML = rows.map(row => {
      const st = row.whatsappStatus || row.estado || '';
      return `
        <tr>
          <td>${u.escapeHtml(u.fmtDate(row))}</td>
          <td>${u.escapeHtml(u.fmtTime(row))}</td>
          <td>${u.escapeHtml(u.personText(row))}</td>
          <td>${u.escapeHtml(u.placeText(row))}</td>
          <td><span class="badge danger">${u.escapeHtml(row.tipo || u.modeText(row) || 'alarma')}</span></td>
          <td>${u.statusBadge(st)}</td>
          <td>${u.escapeHtml(u.cut(u.obsText(row), 110))}</td>
          <td><button class="row-action" data-alarm-id="${u.escapeHtml(row.id)}">Ver</button></td>
        </tr>
      `;
    }).join('');

    body.querySelectorAll('[data-alarm-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = rows.find(x => x.id === btn.datasetAlarmId);
        AdminUI.openDetail('alarma', item);
      });
    });
  }
};

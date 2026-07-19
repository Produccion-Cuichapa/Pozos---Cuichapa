window.AdminExportaciones = {
  init(){
    document.getElementById('btnDiarioPreview')?.addEventListener('click', () => this.generarDiario());
    document.getElementById('btnSoportePreview')?.addEventListener('click', () => this.generarSoporte());
    document.getElementById('btnHistorialPreview')?.addEventListener('click', () => this.generarHistorial());
  },

  descargarCSV(nombre, rows){
    if(!rows.length){ alert('No hay datos para descargar.'); return; }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  },

  generarDiario(){
    const rec = document.getElementById('expRecorredor').value;
    const desde = document.getElementById('expDesde').value;
    const hasta = document.getElementById('expHasta').value;
    const box = document.getElementById('diarioStatus');

    if(!rec || !desde || !hasta){
      box.textContent = 'Selecciona recorredor, fecha desde y fecha hasta.';
      return;
    }

    const rows = (AdminFirebase.reportes || []).filter(r => {
      const d = AdminUtils.dateObj(r);
      const ymd = d ? AdminUtils.ymd(d) : '';
      return AdminUtils.personText(r) === rec && ymd >= desde && ymd <= hasta;
    }).map(r => {
      const p = AdminUtils.parseMsg ? AdminUtils.parseMsg(r) : {};
      return {
        Fecha: AdminUtils.fmtDate(r),
        Hora: AdminUtils.fmtTime(r),
        Recorredor: AdminUtils.personText(r),
        Pozo: AdminUtils.placeText(r),
        Modo: AdminUtils.modeText(r),
        Estatus: r.co?.estatus || p.estatus || '',
        Fluye: r.co?.fluye || p.fluye || '',
        SAP: r.co?.sap || p.sap || '',
        PTP: r.co?.ptp || p.ptp || '',
        LDD: r.co?.ldd || p.ldd || '',
        PTR: r.co?.ptr || p.ptr || '',
        LBN: r.co?.lbn || p.lbn || '',
        Observaciones: AdminUtils.obsText(r),
        GPS: AdminUtils.hasGps(r) ? 'Sí' : 'No',
        WhatsApp: r.whatsappStatus || r.estado || ''
      };
    });

    box.innerHTML = `<b>${rows.length}</b> reportes listos. <button class="primary-btn" id="downDiario">Descargar CSV</button>`;
    document.getElementById('downDiario').onclick = () => this.descargarCSV(`Diario_${rec}_${desde}_a_${hasta}.csv`, rows);
  },

  generarSoporte(){
    const desde = document.getElementById('supDesde').value;
    const hasta = document.getElementById('supHasta').value;
    const box = document.getElementById('soporteStatus');

    if(!desde || !hasta){
      box.textContent = 'Selecciona fecha desde y fecha hasta.';
      return;
    }

    const acc = {};

    (AdminFirebase.reportes || []).forEach(r => {
      const d = AdminUtils.dateObj(r);
      const ymd = d ? AdminUtils.ymd(d) : '';
      if(ymd < desde || ymd > hasta) return;

      const pozo = AdminUtils.placeText(r) || 'Sin pozo';
      const msg = String(r.msg || '').toLowerCase();

      if(!acc[pozo]){
        acc[pozo] = { Pozo: pozo, Supervision:0, Nivel:0, Trabajo:0, Drenar:0, Aforo:0, Intermitente:0 };
      }

      acc[pozo].Supervision++;

      if(msg.includes('nivel') || r.nivel?.ctm || r.ctm) acc[pozo].Nivel++;
      if(msg.includes('trabajo') || r.checks?.trabajo) acc[pozo].Trabajo++;
      if(msg.includes('drenar') || msg.includes('barrido') || r.checks?.drenar) acc[pozo].Drenar++;
      if(msg.includes('aforo') || r.checks?.aforo) acc[pozo].Aforo++;
      if(msg.includes('intermitente') || r.checks?.intermitente) acc[pozo].Intermitente++;
    });

    const rows = Object.values(acc).sort((a,b) => String(a.Pozo).localeCompare(String(b.Pozo)));

    box.innerHTML = `<b>${rows.length}</b> pozos/lugares listos. <button class="primary-btn" id="downSoporte">Descargar CSV</button>`;
    document.getElementById('downSoporte').onclick = () => this.descargarCSV(`Soporte_${desde}_a_${hasta}.csv`, rows);
  },

  generarHistorial(){
    const pozo = document.getElementById('histPozo').value.trim().toLowerCase();
    const box = document.getElementById('historialStatus');

    if(!pozo){
      box.textContent = 'Escribe un pozo.';
      return;
    }

    const rows = (AdminFirebase.reportes || []).filter(r => {
      return AdminUtils.placeText(r).toLowerCase().includes(pozo);
    }).map(r => {
      const p = AdminUtils.parseMsg ? AdminUtils.parseMsg(r) : {};
      return {
        Fecha: AdminUtils.fmtDate(r),
        Hora: AdminUtils.fmtTime(r),
        Recorredor: AdminUtils.personText(r),
        Pozo: AdminUtils.placeText(r),
        Estatus: r.co?.estatus || p.estatus || '',
        Fluye: r.co?.fluye || p.fluye || '',
        SAP: r.co?.sap || p.sap || '',
        PTP: r.co?.ptp || p.ptp || '',
        LDD: r.co?.ldd || p.ldd || '',
        PTR: r.co?.ptr || p.ptr || '',
        LBN: r.co?.lbn || p.lbn || '',
        Observaciones: AdminUtils.obsText(r),
        GPS: AdminUtils.hasGps(r) ? 'Sí' : 'No'
      };
    });

    box.innerHTML = `<b>${rows.length}</b> reportes encontrados. <button class="primary-btn" id="downHistorial">Descargar CSV</button>`;
    document.getElementById('downHistorial').onclick = () => this.descargarCSV(`Historial_${pozo}.csv`, rows);
  }
};

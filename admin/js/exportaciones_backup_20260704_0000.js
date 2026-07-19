window.AdminExportaciones = {
  init(){
    const btnD = document.getElementById('btnDiarioPreview');
    const btnS = document.getElementById('btnSoportePreview');
    const btnH = document.getElementById('btnHistorialPreview');

    if(btnD) btnD.addEventListener('click', () => this.previewDiario());
    if(btnS) btnS.addEventListener('click', () => this.previewSoporte());
    if(btnH) btnH.addEventListener('click', () => this.previewHistorial());
  },

  previewDiario(){
    const rec = document.getElementById('expRecorredor').value;
    const desde = document.getElementById('expDesde').value;
    const hasta = document.getElementById('expHasta').value;
    const box = document.getElementById('diarioStatus');

    if(!rec || !desde || !hasta){
      box.textContent = 'Selecciona recorredor, fecha desde y fecha hasta.';
      return;
    }

    const rows = (window.AdminFirebase.reportes || []).filter(r => {
      const name = AdminUtils.personText(r);
      const d = AdminUtils.dateObj(r);
      const ymd = d ? AdminUtils.ymd(d) : '';
      return name === rec && ymd >= desde && ymd <= hasta;
    });

    box.innerHTML = `
      <b>${rows.length}</b> reportes encontrados para ${rec}.<br>
      Plantilla base: <code>templates/Book.xlsx</code><br>
      Siguiente paso: generar descarga Excel.
    `;
  },

  previewSoporte(){
    const desde = document.getElementById('supDesde').value;
    const hasta = document.getElementById('supHasta').value;
    const box = document.getElementById('soporteStatus');

    if(!desde || !hasta){
      box.textContent = 'Selecciona fecha desde y fecha hasta.';
      return;
    }

    const rows = (window.AdminFirebase.reportes || []).filter(r => {
      const d = AdminUtils.dateObj(r);
      const ymd = d ? AdminUtils.ymd(d) : '';
      return ymd >= desde && ymd <= hasta;
    });

    const pozos = new Set(rows.map(r => AdminUtils.placeText(r)).filter(Boolean));

    box.innerHTML = `
      <b>${rows.length}</b> reportes encontrados.<br>
      <b>${pozos.size}</b> pozos/lugares detectados.<br>
      Plantilla base: <code>templates/Soporte_JUNIO_Actualizado_2.xlsx</code><br>
      Siguiente paso: generar soporte Excel.
    `;
  },

  previewHistorial(){
    const pozo = document.getElementById('histPozo').value.trim().toLowerCase();
    const box = document.getElementById('historialStatus');

    if(!pozo){
      box.textContent = 'Escribe un pozo.';
      return;
    }

    const rows = (window.AdminFirebase.reportes || []).filter(r => {
      return AdminUtils.placeText(r).toLowerCase().includes(pozo);
    });

    box.innerHTML = `
      <b>${rows.length}</b> reportes encontrados para ${pozo}.<br>
      Reporte adicional propuesto: historial técnico por pozo.
    `;
  }
};

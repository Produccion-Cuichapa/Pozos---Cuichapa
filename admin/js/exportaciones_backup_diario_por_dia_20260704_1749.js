window.AdminExportaciones = {
  init(){
    document.getElementById('btnDiarioPreview')?.addEventListener('click', () => this.generarDiario());
    document.getElementById('btnSoportePreview')?.addEventListener('click', () => this.generarSoporte());
    document.getElementById('btnHistorialPreview')?.addEventListener('click', () => this.generarHistorial());
  },

  async loadTemplate(path){
    if(typeof ExcelJS === 'undefined'){
      alert('La librería ExcelJS aún está cargando. Intenta otra vez en unos segundos.');
      throw new Error('ExcelJS no cargado');
    }

    const res = await fetch(path);
    if(!res.ok) throw new Error('No se pudo cargar plantilla: ' + path);

    const buf = await res.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return wb;
  },

  downloadWorkbook(wb, filename){
    return wb.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], {
        type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  },

  ymdFromRow(r){
    const d = AdminUtils.dateObj(r);
    return d ? AdminUtils.ymd(d) : '';
  },

  timeFromRow(r){
    return AdminUtils.fmtTime(r);
  },

  parsed(r){
    return AdminUtils.parseMsg ? AdminUtils.parseMsg(r) : {};
  },

  cleanObs(r){
    const raw = String(r.observaciones || r.obs || r.observacion || '');
    if(raw && !raw.includes('*REPORTE') && !raw.includes('*NIVELES')) return raw;

    const msg = String(r.msg || r.mensaje || '');
    const lines = msg.split(/\r?\n/).map(x => x.trim()).filter(Boolean);

    const basura = [
      'REPORTE DE VISITA','REPORTE CABEZAL','NOTA DE CAMPO','NIVELES DE GUARDIA',
      'CONTROL OPERATIVO','Pozo:','Recorredor:','GPS:','maps.google',
      'WhatsApp','SAP:','PTP:','LDD:','PTR:','LBN:','EPM:','Carrera:',
      'Barriles:','Centímetros:','CTM:','BLS:'
    ];

    const buenas = lines.filter(l => {
      const clean = l.replace(/[📋🔧📝👷📅═🛠️🌙🛢️📐⏱️✅☑️*]/g,'').trim();
      if(!clean) return false;
      return !basura.some(b => clean.toLowerCase().includes(b.toLowerCase()));
    }).map(l => l.replace(/[📋🔧📝👷📅═🛠️🌙🛢️📐⏱️✅☑️*]/g,'').trim());

    return buenas.join(' ').slice(0,180);
  },

  isNivel(r){
    const msg = String(r.msg || '').toLowerCase();
    return Boolean(r.nivel?.ctm || r.ctm || msg.includes('nivel') || msg.includes('ctm'));
  },

  isPozoReal(r){
    const p = AdminUtils.placeText(r);
    return p && !String(p).toLowerCase().includes('nota') && !String(p).toLowerCase().includes('cab');
  },

  set(ws, cell, value){
    const c = ws.getCell(cell);
    c.value = value ?? '';
  },

  safeSheetName(name){
    return String(name || 'Hoja').replace(/[\\/*?:[\]]/g,' ').slice(0,31);
  },

  copyCellStyle(from, to){
    if(from.style) to.style = JSON.parse(JSON.stringify(from.style));
    if(from.numFmt) to.numFmt = from.numFmt;
    if(from.alignment) to.alignment = JSON.parse(JSON.stringify(from.alignment));
    if(from.border) to.border = JSON.parse(JSON.stringify(from.border));
    if(from.fill) to.fill = JSON.parse(JSON.stringify(from.fill));
    if(from.font) to.font = JSON.parse(JSON.stringify(from.font));
    if(from.protection) to.protection = JSON.parse(JSON.stringify(from.protection));
  },

  copyRowStyle(ws, fromRow, toRow){
    const src = ws.getRow(fromRow);
    const dst = ws.getRow(toRow);
    dst.height = src.height;
    src.eachCell({includeEmpty:true}, (cell, col) => {
      this.copyCellStyle(cell, dst.getCell(col));
    });
  },

  async generarDiario(){
    const rec = document.getElementById('expRecorredor').value;
    const desde = document.getElementById('expDesde').value;
    const hasta = document.getElementById('expHasta').value;
    const box = document.getElementById('diarioStatus');

    if(!rec || !desde || !hasta){
      box.textContent = 'Selecciona recorredor, fecha desde y fecha hasta.';
      return;
    }

    box.textContent = 'Generando Excel desde plantilla oficial...';

    const rows = (AdminFirebase.reportes || []).filter(r => {
      const ymd = this.ymdFromRow(r);
      return AdminUtils.personText(r) === rec && ymd >= desde && ymd <= hasta;
    }).sort((a,b) => new Date(a.fecha || a.timestamp || 0) - new Date(b.fecha || b.timestamp || 0));

    if(!rows.length){
      box.textContent = 'No hay reportes para ese rango.';
      return;
    }

    const wb = await this.loadTemplate('../templates/Book.xlsx');
    const ws = wb.worksheets[0];

    this.set(ws, 'D3', rec);
    this.set(ws, 'P3', desde === hasta ? desde : `${desde} a ${hasta}`);

    const coRows = rows.filter(r => !this.isNivel(r));
    const nivelRows = rows.filter(r => this.isNivel(r));

    coRows.slice(0,21).forEach((r, i) => {
      const row = 7 + i;
      const p = this.parsed(r);
      ws.getCell(`B${row}`).value = i + 1;
      ws.getCell(`C${row}`).value = AdminUtils.placeText(r);
      ws.getCell(`D${row}`).value = this.timeFromRow(r);
      ws.getCell(`E${row}`).value = r.co?.estatus || p.estatus || '';
      ws.getCell(`F${row}`).value = r.co?.fluye || p.fluye || '';
      ws.getCell(`G${row}`).value = r.co?.sap || p.sap || '';
      ws.getCell(`H${row}`).value = r.co?.estrangulador || p.estrangulador || '';
      ws.getCell(`I${row}`).value = r.co?.ptp || p.ptp || '';
      ws.getCell(`J${row}`).value = r.co?.ldd || p.ldd || '';
      ws.getCell(`K${row}`).value = r.co?.ptr || p.ptr || '';
      ws.getCell(`L${row}`).value = r.co?.epm || p.epm || '';
      ws.getCell(`M${row}`).value = r.co?.carrera || p.carrera || '';
      ws.getCell(`N${row}`).value = this.cleanObs(r);
      ws.getCell(`N${row}`).alignment = { wrapText:true, vertical:'middle', horizontal:'left' };
      ws.getCell(`O${row}`).alignment = { wrapText:true, vertical:'middle', horizontal:'left' };
    });

    nivelRows.slice(0,21).forEach((r, i) => {
      const row = 33 + i;
      ws.getCell(`B${row}`).value = i + 1;
      ws.getCell(`C${row}`).value = AdminUtils.placeText(r);
      ws.getCell(`D${row}`).value = this.timeFromRow(r);
      ws.getCell(`E${row}`).value = r.nivel?.ctm || r.ctm || '';
      ws.getCell(`E${row}`).value = r.nivel?.bls || r.bls || '';
      ws.getCell(`N${row}`).value = this.cleanObs(r);
      ws.getCell(`N${row}`).alignment = { wrapText:true, vertical:'middle', horizontal:'left' };
      ws.getCell(`O${row}`).alignment = { wrapText:true, vertical:'middle', horizontal:'left' };
    });

    const file = `Diario_${rec.replace(/\s+/g,'_')}_${desde}_a_${hasta}.xlsx`;
    await this.downloadWorkbook(wb, file);
    box.innerHTML = `<b>${rows.length}</b> reportes exportados en plantilla oficial.`;
  },

  async generarSoporte(){
    const desde = document.getElementById('supDesde').value;
    const hasta = document.getElementById('supHasta').value;
    const box = document.getElementById('soporteStatus');

    if(!desde || !hasta){
      box.textContent = 'Selecciona fecha desde y fecha hasta.';
      return;
    }

    box.textContent = 'Generando soporte desde plantilla oficial...';

    const acc = {};

    (AdminFirebase.reportes || []).forEach(r => {
      const ymd = this.ymdFromRow(r);
      if(ymd < desde || ymd > hasta) return;

      const pozo = AdminUtils.placeText(r);
      if(!pozo) return;

      const msg = String(r.msg || '').toLowerCase();

      if(!acc[pozo]){
        acc[pozo] = {
          pozo,
          supervision:0,
          nivel:0,
          trabajo:0,
          drenar:0,
          aforo:0,
          intermitente:0
        };
      }

      acc[pozo].supervision++;

      if(this.isNivel(r)) acc[pozo].nivel++;
      if(msg.includes('trabajo') || r.checks?.trabajo) acc[pozo].trabajo++;
      if(msg.includes('drenar') || msg.includes('barrido') || r.checks?.drenar) acc[pozo].drenar++;
      if(msg.includes('aforo') || r.checks?.aforo) acc[pozo].aforo++;
      if(msg.includes('intermitente') || r.checks?.intermitente) acc[pozo].intermitente++;
    });

    const rows = Object.values(acc).sort((a,b) => String(a.pozo).localeCompare(String(b.pozo), 'es', {numeric:true}));

    if(!rows.length){
      box.textContent = 'No hay datos para soporte en ese rango.';
      return;
    }

    const wb = await this.loadTemplate('../templates/Soporte_JUNIO_Actualizado_2.xlsx');
    const ws = wb.worksheets[0];

    rows.forEach((r, i) => {
      const row = 2 + i;
      ws.getCell(`A${row}`).value = r.pozo;
      ws.getCell(`B${row}`).value = r.supervision;
      ws.getCell(`C${row}`).value = r.nivel;
      ws.getCell(`D${row}`).value = r.trabajo;
      ws.getCell(`E${row}`).value = r.drenar;
      ws.getCell(`F${row}`).value = r.aforo;
      ws.getCell(`G${row}`).value = r.intermitente;
    });

    const file = `Soporte_${desde}_a_${hasta}.xlsx`;
    await this.downloadWorkbook(wb, file);
    box.innerHTML = `<b>${rows.length}</b> pozos exportados en plantilla oficial.`;
  },

  generarHistorial(){
    const box = document.getElementById('historialStatus');
    box.textContent = 'Historial técnico queda pendiente para plantilla propia. No se generará CSV.';
  }
};

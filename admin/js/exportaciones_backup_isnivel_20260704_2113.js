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

  soloPulg(v){
    v = String(v || '');
    const m = v.match(/(\d+(?:\.\d+)?)\s*pulg/i);
    if(m) return m[1] + ' pulg';
    if(/franco/i.test(v)) return 'Franco';
    if(/—|-/g.test(v) && /pulg/i.test(v)) return '— pulg';
    return v.replace(/-?\s*TP\s*#?Vueltas?.*/i,'').trim();
  },

  obsReal(r){
    const direct = String(
      r.observaciones ??
      r.observacion ??
      r.obs ??
      r.co?.observaciones ??
      r.co?.observacion ??
      r.co?.obs ??
      ''
    ).trim();

    if(
      direct &&
      !direct.includes('*REPORTE') &&
      !direct.includes('GPS:') &&
      !direct.includes('Estatus:') &&
      !direct.includes('Fluye:')
    ){
      return direct;
    }

    const msg = String(r.msg || r.mensaje || '');

    const patterns = [
      /Observaciones?\s*:\s*([^\n]+)/i,
      /Obs\s*:\s*([^\n]+)/i,
      /Comentario\s*:\s*([^\n]+)/i,
      /Comentarios\s*:\s*([^\n]+)/i,
      /Nota\s*:\s*([^\n]+)/i
    ];

    for(const re of patterns){
      const m = msg.match(re);
      if(m && m[1]){
        let out = m[1]
          .replace(/[📋🔧📝👷📅═🛠️🌙🛢️📐⏱️✅☑️*]/g,'')
          .replace(/GPS:.*/i,'')
          .replace(/https?:\/\/\S+/i,'')
          .trim();

        if(out && !/^(sin observ|sin observaciones|ninguna|n\/a|na)$/i.test(out)){
          return out;
        }
      }
    }

    return '';
  },

  async generarDiario(){
    try{
    const rec = document.getElementById('expRecorredor').value;
    const desde = document.getElementById('expDesde').value;
    const hasta = document.getElementById('expHasta').value;
    const box = document.getElementById('diarioStatus');

    if(!rec || !desde || !hasta){
      box.textContent = 'Selecciona recorredor, fecha desde y fecha hasta.';
      return;
    }

    box.textContent = 'Generando Excel por día desde plantilla oficial...';

    const allRows = (AdminFirebase.reportes || []).filter(r => {
      const ymd = this.ymdFromRow(r);
      return AdminUtils.personText(r) === rec && ymd >= desde && ymd <= hasta;
    }).sort((a,b) => new Date(a.fecha || a.timestamp || 0) - new Date(b.fecha || b.timestamp || 0));

    if(!allRows.length){
      box.textContent = 'No hay reportes para ese rango.';
      return;
    }

    const porDia = {};
    allRows.forEach(r => {
      const ymd = this.ymdFromRow(r);
      if(!porDia[ymd]) porDia[ymd] = [];
      porDia[ymd].push(r);
    });

    const dias = Object.keys(porDia).sort();

    const wb = await this.loadTemplate('../templates/Book.xlsx');

    for(const dia of dias.slice(0,1)){
      const ws = wb.worksheets[0];

      ws.name = this.safeSheetName(dia);
      ws.getCell('D3').value = rec;
      ws.getCell('P3').value = dia;

      const rows = porDia[dia];
      ws.getCell('D3').value = (
        rows[0]?.recorredorNombre ||
        rows[0]?.recorredorCompleto ||
        rows[0]?.nombreRecorredor ||
        rows[0]?.recorredor ||
        rec
      );

      const coRows = rows.filter(r => !this.isNivel(r));
      const nivelRows = rows.filter(r => this.isNivel(r));

      coRows.slice(0,21).forEach((r, i) => {
        const row = 7 + i;
        const p = this.parsed(r);

        ws.getCell(`B${row}`).value = i + 1;
        ws.getCell(`C${row}`).value = AdminUtils.placeText(r);
        ws.getCell(`C${row}`).alignment = { horizontal:'center', vertical:'middle' };
        ws.getCell(`D${row}`).value = this.timeFromRow(r);
        ws.getCell(`E${row}`).value = r.co?.estatus || p.estatus || '';
        ws.getCell(`F${row}`).value = r.co?.fluye || p.fluye || '';
        ws.getCell(`G${row}`).value = r.co?.sap || p.sap || '';
        ws.getCell(`H${row}`).value = this.soloPulg(r.co?.estrangulador || p.estrangulador || '');
        ws.getCell(`I${row}`).value = r.co?.ptp || p.ptp || '';
        ws.getCell(`J${row}`).value = r.co?.ldd || p.ldd || '';
        ws.getCell(`K${row}`).value = r.co?.ptr || p.ptr || '';
        ws.getCell(`L${row}`).value = r.co?.epm || p.epm || '';
        ws.getCell(`M${row}`).value = r.co?.carrera || p.carrera || '';
        ws.getCell(`O${row}`).value = this.obsReal(r);
        ws.getCell(`O${row}`).alignment = { wrapText:true, vertical:'middle', horizontal:'center' };
      });

      // Turno 1: B-E, filas 32-46
      // Turno 2: G-J, filas 32-46
      // Turno 3: L-O, filas 32-46
      const grupos = {1:[],2:[],3:[]};

      nivelRows.forEach(r => {
        const d = AdminUtils.dateObj(r);
        const h = d ? d.getHours() : 0;

        let turno = 1;
        if(h >= 14 && h < 22) turno = 2;
        if(h >= 22 || h < 6) turno = 3;

        grupos[turno].push(r);
      });

      const map = {
        1: {no:'B', pozo:'C', hora:'D', nivel:'E'},
        2: {no:'G', pozo:'H', hora:'I', nivel:'J'},
        3: {no:'L', pozo:'M', hora:'N', nivel:'O'}
      };

      [1,2,3].forEach(turno => {
        grupos[turno].slice(0,15).forEach((r, i) => {
          const row = 32 + i;
          const c = map[turno];

          ws.getCell(`${c.no}${row}`).value = i + 1;
          ws.getCell(`${c.pozo}${row}`).value = AdminUtils.placeText(r);
          ws.getCell(`${c.pozo}${row}`).alignment = { horizontal:'center', vertical:'middle' };
          ws.getCell(`${c.hora}${row}`).value = this.timeFromRow(r);
          ws.getCell(`${c.nivel}${row}`).value = r.nivel?.ctm || r.ctm || '';
        });
      });

      
    }

    const file = `Diario_${rec.replace(/\s+/g,'_')}_${desde}_a_${hasta}.xlsx`;
    await this.downloadWorkbook(wb, file);
    box.innerHTML = `<b>${allRows.length}</b> reportes exportados.`;
    }catch(err){
      console.error(err);
      const box = document.getElementById('diarioStatus');
      if(box) box.textContent = 'ERROR: ' + (err && err.message ? err.message : err);
    }
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

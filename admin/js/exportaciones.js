window.AdminExportaciones = {
  init(){
    document.getElementById('btnDiarioPreview')?.addEventListener('click', () => this.generarDiario());
    document.getElementById('btnDiarioPDF')?.addEventListener('click', () => this.generarDiarioPDF());
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

  async downloadWorkbook(wb, filename){
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
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

  tipoReporte(r){
    const msg = String(r.msg || r.mensaje || '').toUpperCase();
    const lugar = String(AdminUtils.placeText(r) || '').toUpperCase();

    if(msg.includes('NIVELES DE GUARDIA')) return 'NIVEL_GUARDIA';
    if(msg.includes('REPORTE DE VISITA')) return 'VISITA';
    if(msg.includes('NOTA DE CAMPO') || lugar.includes('NOTA')) return 'NOTA';
    if(msg.includes('REPORTE CABEZAL') || lugar.includes('CAB')) return 'CABEZAL';
    if(msg.includes('ESTACION') || msg.includes('ESTACIÓN') || lugar.includes('EST')) return 'ESTACION';

    if(r.nivel?.ctm || r.ctm || r.nivelCtm) return 'NIVEL_GUARDIA';
    return 'VISITA';
  },

  isNivel(r){
    return this.tipoReporte(r) === 'NIVEL_GUARDIA';
  },

  nivelCm(r){
    const direct = r.nivel?.ctm || r.nivel?.nivel || r.ctm || r.nivelCtm || '';
    if(direct) return this.cortarTxt(direct, 55);

    const msg = String(r.msg || r.mensaje || '');
    let m =
      msg.match(/CTM\s*:\s*([0-9]+(?:\.[0-9]+)?)/i) ||
      msg.match(/Cent[ií]metros?\s*:\s*([0-9]+(?:\.[0-9]+)?)/i) ||
      msg.match(/cm\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);

    return m ? m[1] : '';
  },

  isFT(r){
    const p = this.parsed(r);
    const fluye = String(r.co?.fluye || p.fluye || '').toUpperCase();
    return fluye.includes('FT') || fluye.includes('FRAC');
  },

  isPozoReal(r){
    const p = AdminUtils.placeText(r);
    return p && !String(p).toLowerCase().includes('nota') && !String(p).toLowerCase().includes('cab');
  },

  set(ws, cell, value){
    const c = ws.getCell(cell);
    c.value = value ?? '';
  },

  clonarHojaFormato(src, wb, name){
    const ws = wb.addWorksheet(name);

    // propiedades generales
    ws.properties = JSON.parse(JSON.stringify(src.properties || {}));
    ws.pageSetup = JSON.parse(JSON.stringify(src.pageSetup || {}));
    ws.views = JSON.parse(JSON.stringify(src.views || []));
    ws.headerFooter = JSON.parse(JSON.stringify(src.headerFooter || {}));

    // columnas
    src.columns.forEach((col, i) => {
      const n = i + 1;
      ws.getColumn(n).width = col.width;
      ws.getColumn(n).hidden = col.hidden;
      ws.getColumn(n).outlineLevel = col.outlineLevel;
      ws.getColumn(n).style = JSON.parse(JSON.stringify(col.style || {}));
    });

    // filas y celdas
    src.eachRow({ includeEmpty:true }, (row, rowNumber) => {
      const newRow = ws.getRow(rowNumber);
      newRow.height = row.height;
      newRow.hidden = row.hidden;
      newRow.outlineLevel = row.outlineLevel;

      row.eachCell({ includeEmpty:true }, (cell, colNumber) => {
        const nc = newRow.getCell(colNumber);
        nc.value = cell.value;
        nc.style = JSON.parse(JSON.stringify(cell.style || {}));
        if(cell.numFmt) nc.numFmt = cell.numFmt;
        if(cell.alignment) nc.alignment = JSON.parse(JSON.stringify(cell.alignment));
        if(cell.border) nc.border = JSON.parse(JSON.stringify(cell.border));
        if(cell.fill) nc.fill = JSON.parse(JSON.stringify(cell.fill));
        if(cell.font) nc.font = JSON.parse(JSON.stringify(cell.font));
        if(cell.protection) nc.protection = JSON.parse(JSON.stringify(cell.protection));
      });

      newRow.commit && newRow.commit();
    });

    // merges
    const merges = (src.model && src.model.merges) ? src.model.merges : [];
    merges.forEach(m => {
      try { ws.mergeCells(m); } catch(e) {}
    });

    // imágenes/logo del encabezado
    try{
      if(typeof src.getImages === 'function'){
        src.getImages().forEach(img => {
          try{
            ws.addImage(img.imageId, img.range);
          }catch(e){}
        });
      }
    }catch(e){}

    return ws;
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

  limpiaPresion(v){
    return String(v || '')
      .replace(/kg\/cm²/gi,'')
      .replace(/kg\/cm2/gi,'')
      .replace(/kg\/cm\^2/gi,'')
      .trim();
  },

  soloPulg(v){
    v = String(v || '').trim();

    if(!v) return '';
    if(/franco/i.test(v)) return 'Franco';

    const m = v.match(/(\d+(?:\.\d+)?)\s*pulg/i);
    if(m) return m[1] + ' pulg';

    return '';
  },

  limpiarGpsTexto(v){
    return String(v || '')
      .replace(/(?:✅|☑️|⚠️|⚠|Dentro del rango[^\n]*|Fuera del rango[^\n]*|GPS:[^\n]*|maps\.google\S*)/gi,'')
      .replace(/\([^)]*km\)/gi,'')
      .replace(/\s+/g,' ')
      .trim();
  },

  cortarTxt(v, max){
    v = String(v || '').replace(/\s+/g,' ').trim();
    return v.length > max ? v.slice(0, max).trim() : v;
  },

  textoNota(r){
    const msg = String(r.msg || r.mensaje || '');
    const direct = String(r.observaciones || r.observacion || r.obs || '').trim();

    if(direct && !direct.includes('*REPORTE') && !direct.includes('GPS:')){
      return this.cortarTxt(direct, 55);
    }

    let txt = msg
      .replace(/📄|📋|🔧|📝|👷|📅|═|🛠️|🌙|🛢️|📐|⏱️|✅|☑️|🗺️|🌎|📍/g,'')
      .replace(/\*NOTA DE CAMPO\*/ig,'')
      .replace(/\*REPORTE CABEZAL\*/ig,'')
      .replace(/\*ESTACI[ÓO]N\*/ig,'')
      .replace(/Recorredor\s*:\s*[^\n]+/ig,'')
      .replace(/Juan Carlos|Manrique|Cirilo/ig,'')
      .replace(/\d{2}\/\d{2}\/\d{4}\s+[^\n]+/ig,'')
      .replace(/GPS\s*:[^\n]+/ig,'')
      .replace(/https?:\/\/\S+/ig,'')
      .replace(/maps\.google\S+/ig,'')
      .replace(/[=]{3,}/g,'')
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean)
      .join(' ')
      .trim();

    return this.cortarTxt(this.limpiarGpsTexto(txt.replace(/[🌎🗺️]/g,'').trim()), 90);
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
      return this.cortarTxt(direct, 55);
    }

    const msg = String(r.msg || r.mensaje || '');

    // Observación real del reporte: línea marcada con hoja/lápiz.
    const lines = msg.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    for(const line of lines){
      if(line.includes('📝') || line.includes('🗒️') || line.includes('✏️')){
        const out = line
          .replace(/[📝🗒️✏️📄📋*]/g,'')
          .trim();

        if(out && !/^(sin observ|sin observaciones|ninguna|n\/a|na)$/i.test(out)){
          return this.cortarTxt(out, 55);
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
      const persona = String(AdminUtils.personText(r) || '').trim().toLowerCase();
      const elegido = String(rec || '').trim().toLowerCase();

      const matchRec =
        persona === elegido ||
        persona.includes(elegido) ||
        elegido.includes(persona) ||
        (elegido.includes('luis') && persona.includes('luis')) ||
        (elegido.includes('juan') && persona.includes('juan')) ||
        (elegido.includes('manrique') && persona.includes('manrique')) ||
        (elegido.includes('cirilo') && persona.includes('cirilo'));

      return matchRec && ymd >= desde && ymd <= hasta;
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
    const templateWs = wb.worksheets[0];

    const partes = [];

    dias.forEach(dia => {
      const rows = porDia[dia] || [];

      const coRows = rows.filter(r => {
        const tipo = this.tipoReporte(r);
        return tipo === 'VISITA' || tipo === 'NOTA' || tipo === 'CABEZAL' || tipo === 'ESTACION';
      });

      const nivelRows = rows.filter(r => {
        const tipo = this.tipoReporte(r);
        return tipo === 'NIVEL_GUARDIA' || (tipo === 'VISITA' && this.isFT(r));
      });

      const grupos = {1:[],2:[],3:[]};

      nivelRows.forEach(r => {
        const tipo = this.tipoReporte(r);
        let turno = 1;
        if(tipo === 'NIVEL_GUARDIA') turno = 2;
        grupos[turno].push(r);
      });

      const totalPartes = Math.max(
        1,
        Math.ceil(coRows.length / 21),
        Math.ceil(grupos[1].length / 15),
        Math.ceil(grupos[2].length / 15),
        Math.ceil(grupos[3].length / 15)
      );

      for(let parte = 0; parte < totalPartes; parte++){
        partes.push({
          dia,
          parte,
          rows,
          coRows: coRows.slice(parte * 21, parte * 21 + 21),
          grupos: {
            1: grupos[1].slice(parte * 15, parte * 15 + 15),
            2: grupos[2].slice(parte * 15, parte * 15 + 15),
            3: grupos[3].slice(parte * 15, parte * 15 + 15)
          }
        });
      }
    });

    const hojas = partes.map((item, idx) => {
      const nombre = item.parte === 0
        ? this.safeSheetName(item.dia)
        : this.safeSheetName(`${item.dia} parte ${item.parte + 1}`);

      if(idx === 0){
        templateWs.name = nombre;
        return { ...item, ws: templateWs };
      }

      return { ...item, ws: this.clonarHojaFormato(templateWs, wb, nombre) };
    });

    for(const item of hojas){
      const dia = item.dia;
      const ws = item.ws;
      const rows = item.rows;

      let nombreRec = (
        rows[0]?.recorredorNombre ||
        rows[0]?.recorredorCompleto ||
        rows[0]?.nombreRecorredor ||
        rows[0]?.recorredor ||
        rec ||
        ''
      );

      const mapaRecorredores = {
        'cirilo': 'Cirilo Cancino Gómez',
        'cirilo cancino': 'Cirilo Cancino Gómez',
        'manrique': 'Manrique Jiménez',
        'juan': 'Juan Carlos Flores',
        'juan carlos': 'Juan Carlos Flores',
        'flores': 'Juan Carlos Flores',
        'luis': 'Luis Carlos Flores',
        'luis carlos': 'Luis Carlos Flores'
      };

      const clave = String(nombreRec).trim().toLowerCase();

      for(const k in mapaRecorredores){
        if(clave.includes(k)){
          nombreRec = mapaRecorredores[k];
          break;
        }
      }

      ws.getCell('D3').value = nombreRec;
      ws.getCell('D3').font = Object.assign({}, ws.getCell('D3').font || {}, { size: 13, bold: true });
      ws.getCell('D3').alignment = { horizontal:'center', vertical:'middle' };
      ws.getCell('P3').value = dia;

      item.coRows.forEach((r, i) => {
        const row = 7 + i;
        const p = this.parsed(r);
        const tipo = this.tipoReporte(r);

        ws.getCell(`B${row}`).value = item.parte * 21 + i + 1;
        ws.getCell(`C${row}`).value = AdminUtils.placeText(r);
        ws.getCell(`C${row}`).alignment = { horizontal:'center', vertical:'middle' };
        ws.getCell(`D${row}`).value = this.timeFromRow(r);

        if(tipo === 'NOTA' || tipo === 'CABEZAL' || tipo === 'ESTACION'){
          ['E','F','G','H','I','J','K','L','M'].forEach(col => {
            try{ ws.getCell(`${col}${row}`).value = ''; }catch(e){}
          });

          try{ ws.unMergeCells(`E${row}:M${row}`); }catch(e){}
          try{ ws.unMergeCells(`N${row}:P${row}`); }catch(e){}

          ws.mergeCells(`E${row}:M${row}`);
          const notaCell = ws.getCell(`E${row}`);
          notaCell.value = this.cortarTxt(this.textoNota(r), 90);
          notaCell.alignment = { horizontal:'left', vertical:'middle', wrapText:false, shrinkToFit:true };

          ws.mergeCells(`N${row}:P${row}`);
          const obs = ws.getCell(`N${row}`);
          obs.value = '';
          obs.alignment = { horizontal:'left', vertical:'middle', wrapText:false, shrinkToFit:false };

          return;
        }

        ws.getCell(`E${row}`).value = r.co?.estatus || p.estatus || '';
        ws.getCell(`F${row}`).value = r.co?.fluye || p.fluye || '';
        ws.getCell(`G${row}`).value = r.co?.sap || p.sap || '';
        ws.getCell(`H${row}`).value = this.soloPulg(r.co?.estrangulador || p.estrangulador || '');
        ws.getCell(`I${row}`).value = this.limpiaPresion(r.co?.ptp || p.ptp || '');
        ws.getCell(`J${row}`).value = this.limpiaPresion(r.co?.ldd || p.ldd || '');
        ws.getCell(`K${row}`).value = this.limpiaPresion(r.co?.ptr || p.ptr || '');
        ws.getCell(`L${row}`).value = r.co?.epm || p.epm || '';
        ws.getCell(`M${row}`).value = r.co?.carrera || p.carrera || '';
        ws.getCell(`N${row}`).value = this.cortarTxt(this.obsReal(r), 55);
        ws.getCell(`N${row}`).alignment = { horizontal:'left', vertical:'middle', wrapText:false, shrinkToFit:false };
      });

      const map = {
        1: {no:'B', pozo:'C', hora:'D', nivel:'E'},
        2: {no:'G', pozo:'H', hora:'I', nivel:'J'},
        3: {no:'L', pozo:'M', hora:'N', nivel:'O'}
      };

      [1,2,3].forEach(turno => {
        item.grupos[turno].forEach((r, i) => {
          const row = 32 + i;
          const c = map[turno];

          ws.getCell(`${c.no}${row}`).value = item.parte * 15 + i + 1;
          ws.getCell(`${c.pozo}${row}`).value = AdminUtils.placeText(r);
          ws.getCell(`${c.hora}${row}`).value = this.timeFromRow(r);
          ws.getCell(`${c.nivel}${row}`).value = this.nivelCm(r);

          ['no','pozo','hora','nivel'].forEach(k => {
            ws.getCell(`${c[k]}${row}`).alignment = {
              horizontal:'center',
              vertical:'middle'
            };
          });
        });
      });

      ws.pageSetup = {
        paperSize: 1,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins:{ left:0.10, right:0.10, top:0.10, bottom:0.10, header:0.10, footer:0.10 },
        horizontalCentered:true,
        verticalCentered:false,
        printArea:'A1:P46'
      };

      // Forzar impresión en UNA sola hoja carta horizontal
      ws.pageSetup.paperSize = 1;          // Letter / Carta
      ws.pageSetup.orientation = 'landscape';
      ws.pageSetup.fitToPage = true;
      ws.pageSetup.fitToWidth = 1;
      ws.pageSetup.fitToHeight = 1;
      ws.pageSetup.printArea = 'A1:P46';
      delete ws.pageSetup.scale;

      ws.views = [{ showGridLines:false, zoomScale:85 }];
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


  async generarDiarioPDF(){
    const box = document.getElementById('diarioStatus');
    if(box) box.textContent = 'PDF directo pendiente: por ahora este botón ya no descarga Excel. Para PDF automático hay que convertir el XLSX con backend/Cloud Function.';
  },

  async generarSoporte(){
    const box = document.getElementById('soporteStatus');
    if(box) box.textContent = 'Generando soporte mensual: SUPER...';

    try{
      const supMes = document.getElementById('supMes')?.value || '';
      if(!supMes) throw new Error('Selecciona el mes del soporte.');

      const [year, month] = supMes.split('-').map(Number);
      const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      const mes = meses[month - 1];

      if(typeof JSZip === 'undefined') throw new Error('JSZip no está cargado.');

      const res = await fetch('../templates/tpl_soporte.xlsx?v=' + Date.now());
      if(!res.ok) throw new Error('No se pudo cargar la plantilla.');

      const zip = await JSZip.loadAsync(await res.blob());
      const sheetName = 'xl/worksheets/sheet1.xml';
      const sheetXml = await zip.file(sheetName).async('string');

      const parser = new DOMParser();
      const doc = parser.parseFromString(sheetXml, 'application/xml');
      const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

      function colName(n){
        let s = '';
        while(n > 0){
          const m = (n - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          n = Math.floor((n - 1) / 26);
        }
        return s;
      }

      function getRow(r){
        return Array.from(doc.getElementsByTagNameNS(ns,'row')).find(x => x.getAttribute('r') == r);
      }

      function getCell(addr){
        const r = Number(addr.match(/\d+/)[0]);
        const row = getRow(r);
        if(!row) return null;
        return Array.from(row.getElementsByTagNameNS(ns,'c')).find(c => c.getAttribute('r') === addr) || null;
      }

      function clearCell(addr){
        const c = getCell(addr);
        if(!c) return;
        Array.from(c.childNodes).forEach(n => c.removeChild(n));
        c.removeAttribute('t');
      }

      function setNum(addr, value){
        const c = getCell(addr);
        if(!c) return;
        Array.from(c.childNodes).forEach(n => c.removeChild(n));
        c.removeAttribute('t');
        const v = doc.createElementNS(ns,'v');
        v.textContent = String(value);
        c.appendChild(v);
      }

      function normPozo(v){
        const x = String(v || '').toUpperCase();
        const m =
          x.match(/POZO\s*:\s*\*?\s*C\s*[-_]?\s*([0-9]+[A-Z]?)/i) ||
          x.match(/C\s*[-_]?\s*([0-9]+[A-Z]?)/i) ||
          x.match(/CUICHAPA\s*([0-9]+[A-Z]?)/i) ||
          x.match(/\b([0-9]{2,4}[A-Z]?)\b/i);

        return m ? String(m[1]).toUpperCase() : '';
      }

      function ymdSoporte(r){
        if(r.fecha){
          const d = new Date(r.fecha);
          if(!isNaN(d)) return d.toISOString().slice(0,10);
        }

        const txt = [
          r.fecha, r.date, r.createdAt, r.timestamp,
          r.msg, r.mensaje, JSON.stringify(r)
        ].filter(Boolean).join(' ');

        let m = String(txt).match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
        if(m) return `${m[3]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;

        m = String(txt).match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
        if(m) return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;

        return this.ymdFromRow(r);
      }

      const pozosPlantilla = [
        '106D','107','119','124D','128','131','137','138','139','167',
        '169','172','176','179','180','187','19','191','201','207',
        '213','306','324','326','327','328','331','342','343','346',
        '350','352','356','359','363','364','367','373','376','377',
        '385','401','500','502','504','505','507','513','601','602','603'
      ];

      const pozoRow = {};
      pozosPlantilla.forEach((pz, i) => pozoRow[pz] = 3 + i);

      const startCol = 5; // E fecha
      const block = 8;    // fecha + SUPER + NIVEL + demás

      // Limpiar SOLO SUPER en tabla principal.
      for(let dia = 1; dia <= 31; dia++){
        const colSuper = startCol + ((dia - 1) * block) + 1;

        for(let row = 3; row <= 53; row++){
          clearCell(colName(colSuper) + row);
        }
      }


      (AdminFirebase.reportes || []).forEach(r => {
        const texto = [
          r.msg, r.mensaje, r.message, r.texto,
          r.whatsappText, r.raw, JSON.stringify(r)
        ].filter(Boolean).join('\n');

        const msg = String(texto).toUpperCase();

        // SOLO reporte de visita cuenta para SUPER.
        if(!msg.includes('REPORTE DE VISITA')) return;

        const ymd = ymdSoporte.call(this, r);
        if(!ymd) return;

        const [yy, mm, dd] = ymd.split('-').map(Number);
        if(yy !== year || mm !== month || dd < 1 || dd > 31) return;

        const pozoKey = normPozo(msg);
        const row = pozoRow[pozoKey];
        if(!row) return;

        const colSuper = startCol + ((dd - 1) * block) + 1;
        const addr = colName(colSuper) + row;

        setNum(addr, 1);
      });

      zip.file(sheetName, new XMLSerializer().serializeToString(doc));

      const blobFinal = await zip.generateAsync({
        type:'blob',
        mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const url = URL.createObjectURL(blobFinal);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Soporte_Mensual_${mes}_${year}.xlsx`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);

      if(box) box.textContent = 'Soporte mensual descargado. SUPER generado.';
    }catch(err){
      console.error('ERROR SOPORTE:', err);
      if(box) box.textContent = 'Error al generar soporte: ' + err.message;
      alert('Error al generar soporte: ' + err.message);
    }
  },

  generarHistorial(){
    const box = document.getElementById('historialStatus');
    box.textContent = 'Historial técnico queda pendiente para plantilla propia. No se generará CSV.';
  }
};

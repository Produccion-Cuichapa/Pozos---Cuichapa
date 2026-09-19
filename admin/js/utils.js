const __parseMsgCache = new WeakMap();

window.AdminUtils = {
  escapeHtml(value){
    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  },

  cut(value, size=90){
    const s = String(value ?? '');
    return s.length > size ? s.slice(0, size - 1) + '…' : s;
  },

  getTime(row){
    if(!row) return 0;
    const raw = row.timestamp || row.createdAt || row.fechaHora || row.fechaCreacion || row.sentAt || row.fecha || 0;
    if(typeof raw === 'number') return raw;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  },

  dateObj(row){
    row = row || {};

    // 1) Preferir fecha explícita local dentro del mensaje: dd/mm/yyyy
    const txt = String(row.msg || row.mensaje || row.observaciones || '');
    const m = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m){
      const dd = Number(m[1]);
      const mm = Number(m[2]) - 1;
      const yy = Number(m[3]);

      const hm = txt.match(/(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.|am|pm)?/i);
      let h = hm ? Number(hm[1]) : 0;
      const min = hm ? Number(hm[2]) : 0;
      const ap = hm && hm[3] ? hm[3].toLowerCase() : '';

      if(ap.includes('p') && h < 12) h += 12;
      if(ap.includes('a') && h === 12) h = 0;

      return new Date(yy, mm, dd, h, min, 0);
    }

    // 2) Fecha local guardada como texto
    const f = String(row.fecha || row.date || '').trim();

    let ymd = f.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(ymd){
      return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 0, 0, 0);
    }

    let dmy = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(dmy){
      return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 0, 0, 0);
    }

    // 3) Último recurso: timestamps
    const raw =
      row.timestamp ||
      row.createdAt ||
      row.fechaMs ||
      row.fechaISO ||
      row.ts ||
      row.horaEnvio ||
      '';

    if(!raw) return null;

    if(typeof raw === 'number'){
      return new Date(raw);
    }

    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  },

  ymd(date){
    const d = date instanceof Date ? date : new Date(date);
    if(isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  todayYMD(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  fmtDate(row){
    const d = this.dateObj(row);
    if(d && !isNaN(d)) return d.toLocaleDateString('es-MX');
    return row?.fecha || '';
  },

  fmtTime(row){
    const d = this.dateObj(row);
    if(d && !isNaN(d)) return d.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'});
    return row?.hora || row?.horaNivel || '';
  },

  sameToday(row){
    const d = this.dateObj(row);
    return d && this.ymd(d) === this.todayYMD();
  },

  statusBadge(status){
    const s = String(status || '').toLowerCase();
    const text = status || '-';
    if(s.includes('sent') || s.includes('enviado')) return `<span class="badge ok">${this.escapeHtml(text)}</span>`;
    if(s.includes('pending') || s.includes('pendiente')) return `<span class="badge warn">${this.escapeHtml(text)}</span>`;
    if(s.includes('error') || s.includes('fail')) return `<span class="badge danger">${this.escapeHtml(text)}</span>`;
    return `<span class="badge">${this.escapeHtml(text)}</span>`;
  },

  modeText(row){
    return row?.modo || row?.tipoReporte || '';
  },

  personText(row){
    return row?.recorredor || row?.usuario || row?.user || row?.nombre || '';
  },

  placeText(row){
    return row?.pozo || row?.nombrePozo || row?.lugar || row?.ubicacion || '';
  },

  obsText(row){
    return row?.observaciones || row?.obs || row?.mensaje || row?.msg || row?.descripcion || '';
  },

  hasGps(row){
    const gps = row?.gps || row?.ubicacion || row?.location || row?.coords || {};
    const msg = String(row?.msg || row?.mensaje || row?.observaciones || '');

    return Boolean(
      gps.lat || gps.latitude || gps.latitud ||
      gps.lon || gps.lng || gps.longitude || gps.longitud ||
      row?.lat || row?.latitude || row?.latitud ||
      row?.lon || row?.lng || row?.longitude || row?.longitud ||
      row?.gpsLat || row?.gpsLon ||
      row?.distancia || row?.distanciaGps || row?.distanciaPozo ||
      msg.includes('GPS') ||
      msg.includes('maps.google') ||
      msg.includes('Ubicación') ||
      msg.includes('ubicación')
    );
  },


  parseMsg(row){
    const msg = String(row?.msg || row?.mensaje || '');

    /*
     * Caché por objeto con validación del contenido.
     * Si una corrección cambia msg/mensaje en el mismo
     * objeto, el reporte se vuelve a analizar.
     */
    if(
      row &&
      typeof row === 'object'
    ){
      const cached = __parseMsgCache.get(row);

      if(cached && cached.msg === msg){
        return cached.parsed;
      }
    }

    const clean = (v) => String(v || '').replace(/\*/g,'').trim();

    const getLine = (label) => {
      const re = new RegExp(label + "\\s*:\\s*([^\\n]+)", "i");
      const m = msg.match(re);
      return m ? clean(m[1]) : '';
    };

    const getBetween = (startLabel, stopLabels) => {
      const idx = msg.toLowerCase().indexOf(startLabel.toLowerCase());
      if(idx < 0) return '';
      let cut = msg.slice(idx + startLabel.length);
      let stop = cut.length;
      stopLabels.forEach(label => {
        const pos = cut.toLowerCase().indexOf(label.toLowerCase());
        if(pos >= 0 && pos < stop) stop = pos;
      });
      return clean(cut.slice(0, stop));
    };

    const presLine = msg.match(/PTP:[^\n]+/i)?.[0] || '';

    const getPressure = (label) => {
      const re = new RegExp(label + "\\s*:\\s*([^·\\n]+)", "i");
      const m = presLine.match(re) || msg.match(re);
      return m ? clean(m[1]) : '';
    };

    const gpsLine = msg.match(/GPS:\s*([^\n]+)/i);
    const gps = gpsLine ? clean(gpsLine[1]) : '';

    const maps = (msg.match(/https?:\/\/maps\.google\.com\/\?q=[^\s\n]+/i) || msg.match(/maps\.google\.com\/\?q=[^\s\n]+/i) || [''])[0];

    const evidenceMatch = msg.match(/Evidencia:\s*(\d+)/i);
    const evidenceCount = evidenceMatch ? Number(evidenceMatch[1]) : 0;

    const parsed = {
      estatus: getLine("Estatus"),
      fluye: getLine("Fluye"),
      sap: getLine("SAP"),
      estrangulador: getBetween(
        "Estrangulador:",
        [
          "TP #Vueltas:",
          "TP #VUELTAS:",
          "TP#Vueltas:",
          "TP#VUELTAS:",
          "TP Vueltas:",
          "TP VUELTAS:",
          "SAP:",
          "PTP:",
          "TR#VUELTA:",
          "Pozo aportando"
        ]
      ),
      ptp: getPressure("PTP"),
      ldd: getPressure("LDD"),
      ptr: getPressure("PTR"),
      lbn: getPressure("LBN"),
      epm: getLine("EPM"),
      carrera: getLine("Carrera"),
      /*
       * Compatibilidad:
       * - formato actual: TP #Vueltas: 5
       * - formato antiguo: TR#VUELTA: 5
       */
      tpVueltas:
        getLine("TP #Vueltas") ||
        getLine("TP#Vueltas") ||
        getLine("TP VUELTAS") ||
        getLine("TP#VUELTAS") ||
        getLine("TR#VUELTA"),

      trVuelta:
        getLine("TR#VUELTA") ||
        getLine("TP #Vueltas") ||
        getLine("TP#Vueltas"),
      gps,
      maps,
      evidenceCount
    };

    if(
      row &&
      typeof row === 'object'
    ){
      __parseMsgCache.set(row, {
        msg,
        parsed
      });
    }

    return parsed;
  },

  flatten(obj, prefix='', out={}){
    Object.entries(obj || {}).forEach(([key, value]) => {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if(value && typeof value === 'object' && !Array.isArray(value)){
        this.flatten(value, newKey, out);
      }else{
        out[newKey] = Array.isArray(value) ? JSON.stringify(value) : value;
      }
    });
    return out;
  }
};

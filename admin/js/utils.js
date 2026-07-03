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
    const t = this.getTime(row);
    if(t) return new Date(t);
    if(row?.fecha && row?.hora) return new Date(`${row.fecha}T${row.hora}`);
    if(row?.fecha) return new Date(row.fecha);
    return null;
  },

  ymd(date){
    const d = date instanceof Date ? date : new Date(date);
    if(isNaN(d)) return '';
    return d.toISOString().slice(0,10);
  },

  todayYMD(){
    return new Date().toISOString().slice(0,10);
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
    const gps = row?.gps || {};
    return Boolean(gps.lat || gps.latitude || gps.lon || gps.lng || gps.longitude || row?.lat || row?.lon);
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

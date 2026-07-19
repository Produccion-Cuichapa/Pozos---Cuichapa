window.AdminUI = {
  currentView: 'dashboard',

  init(){
    this.bindNav();
    this.bindDetail();
    this.bindJumpButtons();
    this.updateSession();
  },

  bindNav(){
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.show(btn.dataset.view));
    });
  },

  bindJumpButtons(){
    document.querySelectorAll('[data-jump]').forEach(btn => {
      btn.addEventListener('click', () => this.show(btn.dataset.jump));
    });
  },

  updateSession(){
    const el = document.getElementById('sessionUser');
    const user = window.AdminAuth.current;
    if(el && user){
      el.textContent = `${user.name} · ${user.role}`;
    }
  },

  show(view){
    this.currentView = view;

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    document.querySelectorAll('.view').forEach(section => section.classList.add('hidden'));
    document.getElementById(`${view}View`)?.classList.remove('hidden');

    const titles = {
      dashboard: ['Dashboard', 'Resumen operativo en tiempo real.'],
      reportes: ['Reportes', 'Consulta, filtros y exportación de reportes de campo.'],
      alarmas: ['Alarmas', 'Control y revisión de eventos de alarma.'],
      exportaciones: ['Exportaciones', 'Generación automática de formatos Excel y reportes.']
    };

    document.getElementById('viewTitle').textContent = titles[view]?.[0] || view;
    document.getElementById('viewSubtitle').textContent = titles[view]?.[1] || '';
  },

  bindDetail(){
    document.getElementById('detailClose').addEventListener('click', () => {
      document.getElementById('detailDialog').close();
    });
  },

  openDetail(type, item){
    const u = AdminUtils;
    const isAlarm = type === 'alarma';

    const gps = item.gps || item.ubicacion || item.location || item.coords || {};
    const lat = gps.lat || gps.latitude || gps.latitud || item.lat || item.latitude || item.latitud || '';
    const lon = gps.lon || gps.lng || gps.longitude || gps.longitud || item.lon || item.lng || item.longitude || item.longitud || '';

    const fotos = []
      .concat(item.fotos || [])
      .concat(item.fotoUrls || [])
      .concat(item.photos || [])
      .concat(item.photoUrls || [])
      .concat(item.evidencias || [])
      .filter(Boolean);

    const parsed = u.parseMsg ? u.parseMsg(item) : {};
    const co = item.co || {};
    const nivel = item.nivel || {};
    const checks = item.checks || {};

    document.getElementById('detailTitle').textContent = isAlarm ? 'Detalle de alarma' : 'Detalle de reporte';
    document.getElementById('detailSubtitle').textContent =
      `${u.fmtDate(item)} ${u.fmtTime(item)} · ${u.placeText(item) || 'Sin pozo/lugar'}`;

    document.getElementById('detailBody').innerHTML = `
      <div class="detail-hero ${isAlarm ? 'alarm-hero' : ''}">
        <div>
          <span>${isAlarm ? '🚨 ALARMA' : '📋 REPORTE'}</span>
          <h2>${u.escapeHtml(u.placeText(item) || 'Sin pozo/lugar')}</h2>
          <p>${u.escapeHtml(u.personText(item) || 'Sin usuario')} · ${u.escapeHtml(u.fmtDate(item))} ${u.escapeHtml(u.fmtTime(item))}</p>
        </div>
        <div>
          ${u.statusBadge(item.whatsappStatus || item.estado || '')}
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-box"><span>Recorredor / Usuario</span><b>${u.escapeHtml(u.personText(item) || '-')}</b></div>
        <div class="detail-box"><span>Modo / Tipo</span><b>${u.escapeHtml(u.modeText(item) || item.tipo || '-')}</b></div>
        <div class="detail-box"><span>Fecha</span><b>${u.escapeHtml(u.fmtDate(item))}</b></div>
        <div class="detail-box"><span>Hora</span><b>${u.escapeHtml(u.fmtTime(item))}</b></div>
        <div class="detail-box"><span>GPS</span><b>${(lat && lon) || parsed.gps ? 'Disponible' : 'Sin GPS'}</b></div>
        <div class="detail-box"><span>Fotos</span><b>${fotos.length || item.nFotos || parsed.evidenceCount || 0}</b></div>
      </div>

      <div class="detail-section">
        <h3>Control operativo</h3>
        <div class="detail-grid">
          <div class="detail-box"><span>Estatus</span><b>${u.escapeHtml(co.estatus || item.estatus || parsed.estatus || '-')}</b></div>
          <div class="detail-box"><span>Fluye</span><b>${u.escapeHtml(co.fluye || item.fluye || parsed.fluye || '-')}</b></div>
          <div class="detail-box"><span>SAP</span><b>${u.escapeHtml(co.sap || item.sap || parsed.sap || '-')}</b></div>
          <div class="detail-box"><span>Estrangulador</span><b>${u.escapeHtml(co.estrangulador || item.estrangulador || parsed.estrangulador || '-')}</b></div>
          <div class="detail-box"><span>PTP</span><b>${u.escapeHtml(co.ptp || item.ptp || parsed.ptp || '-')}</b></div>
          <div class="detail-box"><span>LDD</span><b>${u.escapeHtml(co.ldd || item.ldd || parsed.ldd || '-')}</b></div>
          <div class="detail-box"><span>PTR</span><b>${u.escapeHtml(co.ptr || item.ptr || parsed.ptr || '-')}</b></div>
          <div class="detail-box"><span>EPM</span><b>${u.escapeHtml(co.epm || item.epm || parsed.epm || '-')}</b></div>
          <div class="detail-box"><span>Carrera</span><b>${u.escapeHtml(co.carrera || item.carrera || parsed.carrera || '-')}</b></div>
          <div class="detail-box"><span>LBN</span><b>${u.escapeHtml(co.lbn || item.lbn || parsed.lbn || '-')}</b></div>
          <div class="detail-box"><span>TR#VUELTA</span><b>${u.escapeHtml(item.trVuelta || parsed.trVuelta || '-')}</b></div>
        </div>
      </div>

      <div class="detail-section">
        <h3>Nivel / Actividades</h3>
        <div class="detail-grid">
          <div class="detail-box"><span>CTM</span><b>${u.escapeHtml(nivel.ctm || item.ctm || '-')}</b></div>
          <div class="detail-box"><span>BLS</span><b>${u.escapeHtml(nivel.bls || item.bls || '-')}</b></div>
          <div class="detail-box"><span>Hora nivel</span><b>${u.escapeHtml(nivel.horaNivel || item.horaNivel || '-')}</b></div>
          <div class="detail-box"><span>Trabajo</span><b>${checks.trabajo ? 'Sí' : '-'}</b></div>
          <div class="detail-box"><span>Drenar</span><b>${checks.drenar ? 'Sí' : '-'}</b></div>
          <div class="detail-box"><span>Aforo</span><b>${checks.aforo ? 'Sí' : '-'}</b></div>
        </div>
      </div>

      <div class="detail-section">
        <h3>GPS</h3>
        <div class="gps-card">
          <div>
            <b>${lat && lon ? `${u.escapeHtml(lat)}, ${u.escapeHtml(lon)}` : (parsed.gps ? u.escapeHtml(parsed.gps) : 'Sin coordenadas disponibles')}</b>
            <span>${u.escapeHtml(gps.acc || gps.accuracy || gps.precision || item.ac || '')}</span>
          </div>
          ${lat && lon ? `<a class="map-btn" target="_blank" href="https://maps.google.com/?q=${encodeURIComponent(lat)},${encodeURIComponent(lon)}">Abrir mapa</a>` : ''}
        </div>
      </div>

      <div class="detail-section">
        <h3>Observaciones / Mensaje</h3>
        <div class="obs-box">${u.escapeHtml(u.obsText(item) || '-')}</div>
      </div>

      <div class="detail-section">
        <h3>Fotos</h3>
        <div class="photo-grid">
          ${
            fotos.length
              ? fotos.map(src => `<a href="${u.escapeHtml(src)}" target="_blank"><img src="${u.escapeHtml(src)}" loading="lazy"></a>`).join('')
              : (parsed.evidenceCount ? `<div class="empty">El reporte indica ${parsed.evidenceCount} evidencia(s), pero no hay URL de foto guardada en Firebase.</div>` : '<div class="empty">Sin fotografías registradas.</div>')
          }
        </div>
      </div>

      <details class="raw-json">
        <summary>Ver JSON completo</summary>
        <pre>${u.escapeHtml(JSON.stringify(item, null, 2))}</pre>
      </details>
    `;

    document.getElementById('detailDialog').showModal();
  }
};

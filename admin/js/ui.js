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
      alarmas: ['Alarmas', 'Control y revisión de eventos de alarma.']
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
    document.getElementById('detailTitle').textContent = type === 'alarma' ? 'Detalle de alarma' : 'Detalle de reporte';
    document.getElementById('detailSubtitle').textContent =
      `${u.fmtDate(item)} ${u.fmtTime(item)} · ${u.placeText(item) || 'Sin pozo/lugar'}`;

    const gps = item.gps || {};
    const lat = gps.lat || gps.latitude || item.lat || '';
    const lon = gps.lon || gps.lng || gps.longitude || item.lon || '';

    document.getElementById('detailBody').innerHTML = `
      <div class="detail-grid">
        <div class="detail-box"><span>Fecha</span><b>${u.escapeHtml(u.fmtDate(item))}</b></div>
        <div class="detail-box"><span>Hora</span><b>${u.escapeHtml(u.fmtTime(item))}</b></div>
        <div class="detail-box"><span>Usuario</span><b>${u.escapeHtml(u.personText(item))}</b></div>
        <div class="detail-box"><span>Pozo/Lugar</span><b>${u.escapeHtml(u.placeText(item))}</b></div>
        <div class="detail-box"><span>Modo/Tipo</span><b>${u.escapeHtml(u.modeText(item) || item.tipo || '')}</b></div>
        <div class="detail-box"><span>WhatsApp</span><b>${u.escapeHtml(item.whatsappStatus || item.estado || '-')}</b></div>
        <div class="detail-box"><span>GPS</span><b>${lat && lon ? `${u.escapeHtml(lat)}, ${u.escapeHtml(lon)}` : 'Sin GPS'}</b></div>
        <div class="detail-box"><span>Fotos</span><b>${u.escapeHtml(item.nFotos || item.fotos?.length || item.fotoUrls?.length || 0)}</b></div>
        <div class="detail-box"><span>ID</span><b>${u.escapeHtml(item.id || '')}</b></div>
      </div>
      <pre>${u.escapeHtml(JSON.stringify(item, null, 2))}</pre>
    `;

    document.getElementById('detailDialog').showModal();
  }
};

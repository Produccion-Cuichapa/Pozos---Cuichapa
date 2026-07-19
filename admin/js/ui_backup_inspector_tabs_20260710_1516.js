window.AdminUI = {
  currentView: 'dashboard',
  reportInspectorRows: [],
  reportInspectorIndex: -1,
  currentReportItem: null,

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
    const detailClose = document.getElementById('detailClose');
    const detailDialog = document.getElementById('detailDialog');
    const inspectorClose = document.getElementById('reportInspectorClose');
    const inspectorRail = document.getElementById('reportInspectorRail');

    detailClose?.addEventListener('click', () => {
      detailDialog?.close();
    });

    inspectorClose?.addEventListener('click', () => {
      this.closeReportInspector();
    });

    inspectorRail?.addEventListener('click', () => {
      this.closeReportInspector();
    });

    document.getElementById('reportInspectorPrev')
      ?.addEventListener('click', () => {
        this.navigateReportInspector(-1);
      });

    document.getElementById('reportInspectorNext')
      ?.addEventListener('click', () => {
        this.navigateReportInspector(1);
      });

    document.addEventListener('keydown', event => {
      const inspectorOpen =
        document.getElementById('reportInspector')
          ?.classList.contains('is-open');

      if(event.key === 'Escape'){
        this.closeReportInspector();
        return;
      }

      if(!inspectorOpen) return;

      if(event.key === 'ArrowLeft'){
        this.navigateReportInspector(-1);
      }

      if(event.key === 'ArrowRight'){
        this.navigateReportInspector(1);
      }
    });
  },

  setReportInspectorContext(rows, item){
    this.reportInspectorRows = Array.isArray(rows)
      ? rows.slice()
      : [];

    this.currentReportItem = item || null;

    this.reportInspectorIndex = this.reportInspectorRows.findIndex(row =>
      String(row.id) === String(item?.id)
    );

    this.updateReportInspectorNavigation();
  },

  updateReportInspectorNavigation(){
    const prev = document.getElementById('reportInspectorPrev');
    const next = document.getElementById('reportInspectorNext');
    const position = document.getElementById(
      'reportInspectorPosition'
    );

    const total = this.reportInspectorRows.length;
    const index = this.reportInspectorIndex;

    if(position){
      position.textContent =
        index >= 0 && total
          ? `Reporte ${index + 1} de ${total}`
          : 'Reporte';
    }

    if(prev){
      prev.disabled = index <= 0;
    }

    if(next){
      next.disabled = index < 0 || index >= total - 1;
    }
  },

  navigateReportInspector(direction){
    const nextIndex =
      this.reportInspectorIndex + Number(direction || 0);

    if(
      nextIndex < 0 ||
      nextIndex >= this.reportInspectorRows.length
    ){
      return;
    }

    const item = this.reportInspectorRows[nextIndex];
    if(!item) return;

    this.reportInspectorIndex = nextIndex;
    this.currentReportItem = item;

    this.openDetail('reporte', item);
    this.updateReportInspectorNavigation();
    this.highlightCurrentReportRow(item.id);
  },

  highlightCurrentReportRow(reportId){
    document.querySelectorAll(
      '#reportesTable .report-row'
    ).forEach(row => {
      row.classList.remove('report-row-selected');
    });

    const button = Array.from(
      document.querySelectorAll(
        '#reportesTable [data-report-id]'
      )
    ).find(btn =>
      String(btn.dataset.reportId) === String(reportId)
    );

    const row = button?.closest('.report-row');

    if(row){
      row.classList.add('report-row-selected');
    }
  },

  sameWellReports(item){
    const currentPlace = String(
      AdminUtils.placeText(item) || ''
    )
      .trim()
      .toUpperCase();

    if(!currentPlace){
      return [];
    }

    return (window.AdminFirebase.reportes || [])
      .filter(row =>
        String(AdminUtils.placeText(row) || '')
          .trim()
          .toUpperCase() === currentPlace
      )
      .sort(
        (a, b) =>
          AdminUtils.getTime(b) - AdminUtils.getTime(a)
      )
      .slice(0, 8);
  },

  renderSameWellHistory(item){
    const u = AdminUtils;
    const rows = this.sameWellReports(item);

    if(!rows.length){
      return `
        <div class="detail-section inspector-history-section">
          <h3>Historial reciente del mismo pozo</h3>
          <div class="empty">
            No hay otros reportes relacionados.
          </div>
        </div>
      `;
    }

    return `
      <div class="detail-section inspector-history-section">
        <div class="inspector-section-heading">
          <h3>Historial reciente del mismo pozo</h3>
          <span>${rows.length} registros</span>
        </div>

        <div class="inspector-history-list">
          ${rows.map(row => {
            const isCurrent =
              String(row.id) === String(item.id);

            const mode =
              u.modeText(row) ||
              row.tipo ||
              'Reporte';

            const status =
              row.co?.estatus ||
              row.estatus ||
              '';

            return `
              <button
                type="button"
                class="inspector-history-item ${isCurrent ? 'is-current' : ''}"
                data-history-report-id="${u.escapeHtml(row.id)}"
              >
                <div class="history-time">
                  <b>${u.escapeHtml(u.fmtTime(row))}</b>
                  <span>${u.escapeHtml(u.fmtDate(row))}</span>
                </div>

                <div class="history-main">
                  <b>${u.escapeHtml(mode)}</b>
                  <span>
                    ${u.escapeHtml(
                      u.personText(row) || 'Sin recorredor'
                    )}
                    ${status ? ` · ${u.escapeHtml(status)}` : ''}
                  </span>
                </div>

                <span class="history-arrow">›</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  bindInspectorHistory(){
    const body = document.getElementById('reportInspectorBody');
    if(!body) return;

    body.querySelectorAll(
      '[data-history-report-id]'
    ).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.historyReportId;

        const item = (window.AdminFirebase.reportes || [])
          .find(row => String(row.id) === String(id));

        if(!item) return;

        const contextIndex =
          this.reportInspectorRows.findIndex(row =>
            String(row.id) === String(item.id)
          );

        if(contextIndex >= 0){
          this.reportInspectorIndex = contextIndex;
        }

        this.currentReportItem = item;
        this.openDetail('reporte', item);
        this.updateReportInspectorNavigation();
        this.highlightCurrentReportRow(item.id);
      });
    });
  },

  openReportInspector(){
    const inspector = document.getElementById('reportInspector');
    const rail = document.getElementById('reportInspectorRail');

    if(!inspector) return;

    inspector.classList.add('is-open');
    inspector.setAttribute('aria-hidden', 'false');

    rail?.classList.add('is-open');
    rail?.setAttribute('aria-hidden', 'false');

    document.body.classList.add('report-inspector-open');
  },

  closeReportInspector(){
    const inspector = document.getElementById('reportInspector');
    const rail = document.getElementById('reportInspectorRail');

    inspector?.classList.remove('is-open');
    inspector?.setAttribute('aria-hidden', 'true');

    rail?.classList.remove('is-open');
    rail?.setAttribute('aria-hidden', 'true');

    document.body.classList.remove('report-inspector-open');
  },

  openDetail(type, item){
    if(!item) return;

    const u = AdminUtils;
    const isAlarm = type === 'alarma';
    const useInspector =
      !isAlarm &&
      Boolean(document.getElementById('reportInspector'));

    const titleEl = document.getElementById(
      useInspector
        ? 'reportInspectorTitle'
        : 'detailTitle'
    );

    const subtitleEl = document.getElementById(
      useInspector
        ? 'reportInspectorSubtitle'
        : 'detailSubtitle'
    );

    const bodyEl = document.getElementById(
      useInspector
        ? 'reportInspectorBody'
        : 'detailBody'
    );

    if(!titleEl || !subtitleEl || !bodyEl) return;

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

    titleEl.textContent =
      isAlarm
        ? 'Detalle de alarma'
        : 'Detalle de reporte';

    subtitleEl.textContent =
      `${u.fmtDate(item)} ${u.fmtTime(item)} · ${u.placeText(item) || 'Sin pozo/lugar'}`;

    bodyEl.innerHTML = `
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

      ${useInspector ? this.renderSameWellHistory(item) : ''}

      <details class="raw-json">
        <summary>Ver JSON completo</summary>
        <pre>${u.escapeHtml(JSON.stringify(item, null, 2))}</pre>
      </details>
    `;

    if(useInspector){
      this.currentReportItem = item;

      if(this.reportInspectorIndex < 0){
        const index = this.reportInspectorRows.findIndex(row =>
          String(row.id) === String(item.id)
        );

        if(index >= 0){
          this.reportInspectorIndex = index;
        }
      }

      this.openReportInspector();
      this.updateReportInspectorNavigation();
      this.highlightCurrentReportRow(item.id);
      this.bindInspectorHistory();

      requestAnimationFrame(() => {
        bodyEl.scrollTop = 0;
      });
    }else{
      document.getElementById('detailDialog')?.showModal();
    }
  }
};

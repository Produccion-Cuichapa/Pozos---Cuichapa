window.AdminUI = {
  currentView: 'dashboard',
  reportInspectorRows: [],
  reportInspectorIndex: -1,
  currentReportItem: null,
  activeInspectorTab: 'summary',
  timelineFilter: 'all',

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

    document.querySelectorAll(
      '[data-inspector-tab]'
    ).forEach(btn => {
      btn.addEventListener('click', () => {
        this.setInspectorTab(
          btn.dataset.inspectorTab || 'summary'
        );
      });
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

  setInspectorTab(tab){
    const allowed = [
      'summary',
      'operation',
      'evidence',
      'history',
      'corrections'
    ];

    const selected = allowed.includes(tab)
      ? tab
      : 'summary';

    this.activeInspectorTab = selected;

    document.querySelectorAll(
      '[data-inspector-tab]'
    ).forEach(btn => {
      const active =
        btn.dataset.inspectorTab === selected;

      btn.classList.toggle('active', active);
      btn.setAttribute(
        'aria-selected',
        active ? 'true' : 'false'
      );
    });

    const body = document.getElementById(
      'reportInspectorBody'
    );

    if(!body) return;

    body.querySelectorAll(
      '[data-inspector-panel]'
    ).forEach(section => {
      section.classList.toggle(
        'is-tab-active',
        section.dataset.inspectorPanel === selected
      );
    });

    body.scrollTop = 0;
  },

  reportCorrections(item){
    const source =
      window.AdminFirebase?.correcciones || [];

    const rows = Array.isArray(source)
      ? source
      : Object.values(source || {});

    const reportIds = [
      item?.id,
      item?.reportId,
      item?.reporteId
    ]
      .filter(Boolean)
      .map(String);

    if(!reportIds.length){
      return [];
    }

    return rows
      .filter(correction => {
        const correctionIds = [
          correction.reportId,
          correction.reporteId,
          correction.idReporte,
          correction.originalReportId,
          correction.reporteOriginalId,
          correction.parentReportId
        ]
          .filter(Boolean)
          .map(String);

        return correctionIds.some(id =>
          reportIds.includes(id)
        );
      })
      .sort(
        (a, b) =>
          AdminUtils.getTime(b) -
          AdminUtils.getTime(a)
      );
  },

  correctionSummary(correction){
    return String(
      correction.motivo ||
      correction.observacion ||
      correction.observaciones ||
      correction.nota ||
      correction.mensaje ||
      correction.msg ||
      'Corrección registrada'
    );
  },

  renderCorrectionChanges(correction){
    const u = AdminUtils;

    const changes =
      correction.cambios ||
      correction.changes ||
      correction.camposModificados ||
      correction.campos ||
      null;

    if(!changes || typeof changes !== 'object'){
      return '';
    }

    const entries = Object.entries(changes)
      .slice(0, 12);

    if(!entries.length){
      return '';
    }

    return `
      <div class="correction-change-list">
        ${entries.map(([field, value]) => {
          let before = '';
          let after = '';

          if(
            value &&
            typeof value === 'object' &&
            !Array.isArray(value)
          ){
            before =
              value.antes ??
              value.before ??
              value.original ??
              '';

            after =
              value.despues ??
              value.after ??
              value.nuevo ??
              value.value ??
              '';
          }else{
            after = value ?? '';
          }

          return `
            <div class="correction-change">
              <b>${u.escapeHtml(field)}</b>

              ${
                before !== ''
                  ? `<span class="correction-before">
                       Antes: ${u.escapeHtml(String(before))}
                     </span>`
                  : ''
              }

              <span class="correction-after">
                Después: ${u.escapeHtml(String(after || '-'))}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderReportCorrections(item){
    const u = AdminUtils;
    const rows = this.reportCorrections(item);

    if(!rows.length){
      return `
        <div class="detail-section inspector-corrections-section"
             data-inspector-panel="corrections">

          <div class="inspector-empty-state">
            <div class="inspector-empty-icon">✓</div>

            <b>Sin correcciones registradas</b>

            <span>
              Este reporte conserva su información original.
            </span>
          </div>
        </div>
      `;
    }

    return `
      <div class="detail-section inspector-corrections-section"
           data-inspector-panel="corrections">

        <div class="inspector-section-heading">
          <h3>Correcciones del reporte</h3>
          <span>
            ${rows.length}
            ${rows.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div class="correction-list">
          ${rows.map((correction, index) => {
            const person =
              correction.corregidoPor ||
              correction.usuario ||
              correction.user ||
              correction.recorredor ||
              correction.quien ||
              'Usuario no identificado';

            return `
              <article class="correction-card">
                <div class="correction-card-head">
                  <div>
                    <span>Corrección ${index + 1}</span>
                    <b>${u.escapeHtml(person)}</b>
                  </div>

                  <time>
                    ${u.escapeHtml(u.fmtDate(correction))}
                    ${u.escapeHtml(u.fmtTime(correction))}
                  </time>
                </div>

                <div class="correction-reason">
                  ${u.escapeHtml(
                    this.correctionSummary(correction)
                  )}
                </div>

                ${this.renderCorrectionChanges(correction)}

                <details class="correction-json">
                  <summary>Ver información técnica</summary>
                  <pre>${u.escapeHtml(
                    JSON.stringify(correction, null, 2)
                  )}</pre>
                </details>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  prepareInspectorTabs(item){
    const body = document.getElementById(
      'reportInspectorBody'
    );

    if(!body) return;

    const directChildren = Array.from(body.children);

    directChildren.forEach(element => {
      element.removeAttribute('data-inspector-panel');
      element.classList.remove('is-tab-active');
    });

    const hero = Array.from(body.children).find(
      element =>
        element.classList.contains('detail-hero')
    );

    if(hero){
      hero.dataset.inspectorPanel = 'summary';
    }

    const firstGrid = Array.from(body.children).find(
      element =>
        element.classList.contains('detail-grid')
    );

    if(firstGrid){
      firstGrid.dataset.inspectorPanel = 'summary';
    }

    body.querySelectorAll(
      ':scope > .detail-section'
    ).forEach(section => {
      const title = String(
        section.querySelector('h3')?.textContent || ''
      ).toLowerCase();

      // El Timeline nuevo usa como título el número del pozo,
      // por eso debe identificarse también por su clase.
      if(
        section.classList.contains('inspector-timeline-section') ||
        section.classList.contains('inspector-history-section')
      ){
        section.dataset.inspectorPanel = 'history';
        return;
      }

      if(
        section.classList.contains('inspector-corrections-section')
      ){
        section.dataset.inspectorPanel = 'corrections';
        return;
      }

      if(
        title.includes('control operativo') ||
        title.includes('nivel') ||
        title.includes('actividades')
      ){
        section.dataset.inspectorPanel = 'operation';
        return;
      }

      if(
        title.includes('gps') ||
        title.includes('foto') ||
        title.includes('evidencia')
      ){
        section.dataset.inspectorPanel = 'evidence';
        return;
      }

      if(title.includes('historial')){
        section.dataset.inspectorPanel = 'history';
        return;
      }

      if(title.includes('correccion')){
        section.dataset.inspectorPanel = 'corrections';
        return;
      }

      section.dataset.inspectorPanel = 'summary';
    });

    const rawJson = body.querySelector(
      ':scope > .raw-json'
    );

    if(rawJson){
      rawJson.dataset.inspectorPanel = 'summary';
    }

    const oldCorrections = body.querySelector(
      '.inspector-corrections-section'
    );

    oldCorrections?.remove();

    const correctionHtml =
      this.renderReportCorrections(item);

    if(rawJson){
      rawJson.insertAdjacentHTML(
        'beforebegin',
        correctionHtml
      );
    }else{
      body.insertAdjacentHTML(
        'beforeend',
        correctionHtml
      );
    }

    const photos = []
      .concat(item.fotos || [])
      .concat(item.fotoUrls || [])
      .concat(item.photos || [])
      .concat(item.photoUrls || [])
      .concat(item.evidencias || [])
      .filter(Boolean);

    const evidenceCount =
      Number(item.nFotos || photos.length || 0) +
      (AdminUtils.hasGps(item) ? 1 : 0);

    const historyCount =
      this.timelineEvents(item).length;

    const correctionsCount =
      this.reportCorrections(item).length;

    const evidenceEl = document.getElementById(
      'inspectorEvidenceCount'
    );

    const historyEl = document.getElementById(
      'inspectorHistoryCount'
    );

    const correctionsEl = document.getElementById(
      'inspectorCorrectionsCount'
    );

    if(evidenceEl){
      evidenceEl.textContent = evidenceCount;
    }

    if(historyEl){
      historyEl.textContent = historyCount;
    }

    if(correctionsEl){
      correctionsEl.textContent = correctionsCount;
      correctionsEl.classList.toggle(
        'has-items',
        correctionsCount > 0
      );
    }

    this.setInspectorTab(
      this.activeInspectorTab || 'summary'
    );
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

  normalizePlace(value){
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/^POZO\s+/i, '')
      .replace(/^C[-\s]*/i, '')
      .replace(/\s+/g, '');
  },

  sameWell(item, other){
    const current = this.normalizePlace(
      AdminUtils.placeText(item)
    );

    const candidate = this.normalizePlace(
      AdminUtils.placeText(other)
    );

    if(!current || !candidate){
      return false;
    }

    return current === candidate;
  },

  timelineCorrections(item){
    return this.reportCorrections
      ? this.reportCorrections(item)
      : [];
  },

  timelineEvents(item){
    const u = AdminUtils;

    const reportes = (window.AdminFirebase.reportes || [])
      .filter(row => this.sameWell(item, row))
      .map(row => ({
        kind: 'report',
        time: u.getTime(row),
        row
      }));

    const alarmas = (window.AdminFirebase.alarmas || [])
      .filter(row => this.sameWell(item, row))
      .map(row => ({
        kind: 'alarm',
        time: u.getTime(row),
        row
      }));

    const corrections = this.timelineCorrections(item)
      .map(row => ({
        kind: 'correction',
        time: u.getTime(row),
        row
      }));

    return [
      ...reportes,
      ...alarmas,
      ...corrections
    ]
      .filter(event => event.time > 0)
      .sort((a, b) => b.time - a.time)
      .slice(0, 80);
  },

  timelineEventType(event){
    const u = AdminUtils;
    const row = event.row || {};

    if(event.kind === 'alarm'){
      return {
        key: 'alarm',
        label: 'Alarma',
        icon: '!'
      };
    }

    if(event.kind === 'correction'){
      return {
        key: 'correction',
        label: 'Corrección',
        icon: '↺'
      };
    }

    const raw = String(
      u.modeText(row) ||
      row.tipo ||
      row.modo ||
      'Reporte'
    ).toLowerCase();

    if(raw.includes('nivel') || raw.includes('guardia')){
      return {
        key: 'level',
        label: 'Nivel de guardia',
        icon: 'N'
      };
    }

    if(raw.includes('nota')){
      return {
        key: 'note',
        label: 'Nota',
        icon: 'N'
      };
    }

    if(raw.includes('cabezal')){
      return {
        key: 'header',
        label: 'Cabezal',
        icon: 'C'
      };
    }

    if(
      raw.includes('estacion') ||
      raw.includes('estación')
    ){
      return {
        key: 'station',
        label: 'Estación',
        icon: 'E'
      };
    }

    return {
      key: 'visit',
      label: 'Reporte de visita',
      icon: 'R'
    };
  },

  timelineRelativeTime(row){
    const time = AdminUtils.getTime(row);

    if(!time){
      return '';
    }

    const minutes = Math.max(
      0,
      Math.floor((Date.now() - time) / 60000)
    );

    if(minutes < 1) return 'Ahora mismo';
    if(minutes === 1) return 'Hace 1 min';
    if(minutes < 60) return `Hace ${minutes} min`;

    const hours = Math.floor(minutes / 60);

    if(hours < 24){
      return hours === 1
        ? 'Hace 1 h'
        : `Hace ${hours} h`;
    }

    const days = Math.floor(hours / 24);

    return days === 1
      ? 'Hace 1 día'
      : `Hace ${days} días`;
  },

  timelineSummary(events){
    const summary = {
      total: events.length,
      reports: 0,
      alarms: 0,
      corrections: 0,
      lastTime: 0
    };

    events.forEach(event => {
      if(event.kind === 'alarm'){
        summary.alarms++;
      }else if(event.kind === 'correction'){
        summary.corrections++;
      }else{
        summary.reports++;
      }

      if(event.time > summary.lastTime){
        summary.lastTime = event.time;
      }
    });

    return summary;
  },

  renderWellTimeline(item){
    const u = AdminUtils;
    const events = this.timelineEvents(item);
    const summary = this.timelineSummary(events);
    const place = u.placeText(item) || 'Sin pozo';

    if(!events.length){
      return `
        <div class="detail-section inspector-timeline-section"
             data-inspector-panel="history">

          <div class="inspector-empty-state">
            <div class="inspector-empty-icon">⌛</div>

            <b>Sin historial operativo</b>

            <span>
              No se encontraron eventos relacionados con
              ${u.escapeHtml(place)}.
            </span>
          </div>
        </div>
      `;
    }

    const filter = this.timelineFilter || 'all';

    const visible = events.filter(event => {
      if(filter === 'all') return true;
      if(filter === 'reports') return event.kind === 'report';
      if(filter === 'alarms') return event.kind === 'alarm';
      if(filter === 'corrections'){
        return event.kind === 'correction';
      }

      return true;
    });

    return `
      <div class="detail-section inspector-timeline-section"
           data-inspector-panel="history">

        <div class="timeline-header">
          <div>
            <span class="timeline-eyebrow">
              HISTORIAL OPERATIVO
            </span>

            <h3>${u.escapeHtml(place)}</h3>
          </div>

          <span class="timeline-total">
            ${summary.total} eventos
          </span>
        </div>

        <div class="timeline-summary-grid">
          <div>
            <span>Reportes</span>
            <b>${summary.reports}</b>
          </div>

          <div>
            <span>Alarmas</span>
            <b>${summary.alarms}</b>
          </div>

          <div>
            <span>Correcciones</span>
            <b>${summary.corrections}</b>
          </div>

          <div>
            <span>Última actividad</span>
            <b>
              ${
                events[0]
                  ? u.escapeHtml(
                      this.timelineRelativeTime(events[0].row)
                    )
                  : '-'
              }
            </b>
          </div>
        </div>

        <div class="timeline-filters">
          <button type="button"
                  class="timeline-filter ${filter === 'all' ? 'active' : ''}"
                  data-timeline-filter="all">
            Todo
          </button>

          <button type="button"
                  class="timeline-filter ${filter === 'reports' ? 'active' : ''}"
                  data-timeline-filter="reports">
            Reportes
          </button>

          <button type="button"
                  class="timeline-filter ${filter === 'alarms' ? 'active' : ''}"
                  data-timeline-filter="alarms">
            Alarmas
          </button>

          <button type="button"
                  class="timeline-filter ${filter === 'corrections' ? 'active' : ''}"
                  data-timeline-filter="corrections">
            Correcciones
          </button>
        </div>

        <div class="well-timeline">
          ${
            visible.length
              ? visible.map((event, index) => {
                  const row = event.row || {};
                  const type = this.timelineEventType(event);
                  const person =
                    u.personText(row) ||
                    row.corregidoPor ||
                    row.usuario ||
                    'Sin usuario';

                  const status =
                    row.co?.estatus ||
                    row.estatus ||
                    '';

                  const observation =
                    event.kind === 'correction'
                      ? this.correctionSummary(row)
                      : u.obsText(row);

                  const clickable =
                    event.kind === 'report' &&
                    row.id;

                  return `
                    <article class="timeline-event timeline-${type.key}">
                      <div class="timeline-line">
                        <span class="timeline-dot">
                          ${u.escapeHtml(type.icon)}
                        </span>

                        ${
                          index < visible.length - 1
                            ? '<i></i>'
                            : ''
                        }
                      </div>

                      <div class="timeline-event-card">
                        <div class="timeline-event-head">
                          <div>
                            <span class="timeline-event-type">
                              ${u.escapeHtml(type.label)}
                            </span>

                            <b>
                              ${u.escapeHtml(
                                u.fmtDate(row)
                              )}
                              ·
                              ${u.escapeHtml(
                                u.fmtTime(row)
                              )}
                            </b>
                          </div>

                          <time>
                            ${u.escapeHtml(
                              this.timelineRelativeTime(row)
                            )}
                          </time>
                        </div>

                        <div class="timeline-event-body">
                          <span>
                            ${u.escapeHtml(person)}
                          </span>

                          ${
                            status
                              ? `<span class="timeline-status">
                                   ${u.escapeHtml(status)}
                                 </span>`
                              : ''
                          }
                        </div>

                        ${
                          observation
                            ? `<p>
                                 ${u.escapeHtml(
                                   u.cut(observation, 180)
                                 )}
                               </p>`
                            : ''
                        }

                        ${
                          clickable
                            ? `<button
                                 type="button"
                                 class="timeline-open-report"
                                 data-timeline-report-id="${u.escapeHtml(row.id)}">
                                 Abrir reporte
                               </button>`
                            : ''
                        }
                      </div>
                    </article>
                  `;
                }).join('')
              : `
                <div class="timeline-empty-filter">
                  No hay eventos para este filtro.
                </div>
              `
          }
        </div>
      </div>
    `;
  },

  bindWellTimeline(){
    const body = document.getElementById(
      'reportInspectorBody'
    );

    if(!body) return;

    body.querySelectorAll(
      '[data-timeline-filter]'
    ).forEach(button => {
      button.addEventListener('click', () => {
        this.timelineFilter =
          button.dataset.timelineFilter || 'all';

        if(!this.currentReportItem) return;

        this.openDetail(
          'reporte',
          this.currentReportItem
        );

        this.setInspectorTab('history');
      });
    });

    body.querySelectorAll(
      '[data-timeline-report-id]'
    ).forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.timelineReportId;

        const report = (
          window.AdminFirebase.reportes || []
        ).find(row =>
          String(row.id) === String(id)
        );

        if(!report) return;

        const contextIndex =
          this.reportInspectorRows.findIndex(row =>
            String(row.id) === String(report.id)
          );

        if(contextIndex >= 0){
          this.reportInspectorIndex = contextIndex;
        }

        this.currentReportItem = report;
        this.openDetail('reporte', report);
        this.updateReportInspectorNavigation();
        this.highlightCurrentReportRow(report.id);
        this.setInspectorTab('history');
      });
    });
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

      ${useInspector ? this.renderWellTimeline(item) : ''}

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
      this.prepareInspectorTabs(item);
      this.bindWellTimeline();

      requestAnimationFrame(() => {
        bodyEl.scrollTop = 0;
      });
    }else{
      document.getElementById('detailDialog')?.showModal();
    }
  }
};

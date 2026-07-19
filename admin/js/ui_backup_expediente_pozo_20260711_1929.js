window.AdminUI = {
  currentView: 'dashboard',
  reportInspectorRows: [],
  reportInspectorIndex: -1,
  currentReportItem: null,
  activeInspectorTab: 'summary',
  timelineFilter: 'all',
  comparisonBaseId: null,

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
      pozos: ['Pozos', 'Estado operativo consolidado del Campo Cuichapa.'],
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
      'compare',
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
        section.classList.contains('inspector-comparison-section')
      ){
        section.dataset.inspectorPanel = 'compare';
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

    const oldComparison = body.querySelector(
      '.inspector-comparison-section'
    );

    const oldCorrections = body.querySelector(
      '.inspector-corrections-section'
    );

    oldComparison?.remove();
    oldCorrections?.remove();

    const comparisonHtml =
      this.renderReportComparison(item);

    const correctionHtml =
      this.renderReportCorrections(item);

    if(rawJson){
      rawJson.insertAdjacentHTML(
        'beforebegin',
        comparisonHtml
      );

      rawJson.insertAdjacentHTML(
        'beforebegin',
        correctionHtml
      );
    }else{
      body.insertAdjacentHTML(
        'beforeend',
        comparisonHtml + correctionHtml
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

  comparableReportFields(item){
    const u = AdminUtils;
    const parsed = u.parseMsg ? u.parseMsg(item) : {};
    const co = item?.co || {};
    const nivel = item?.nivel || {};
    const checks = item?.checks || {};

    const value = (...values) => {
      for(const current of values){
        if(
          current !== undefined &&
          current !== null &&
          String(current).trim() !== ''
        ){
          return String(current).trim();
        }
      }

      return '';
    };

    return {
      modo: {
        label: 'Tipo de reporte',
        value: value(
          u.modeText(item),
          item?.tipo,
          item?.modo
        )
      },

      estatus: {
        label: 'Estatus',
        value: value(
          co.estatus,
          item?.estatus,
          parsed.estatus
        )
      },

      fluye: {
        label: 'Fluye',
        value: value(
          co.fluye,
          item?.fluye,
          parsed.fluye
        )
      },

      sap: {
        label: 'SAP',
        value: value(
          co.sap,
          item?.sap,
          parsed.sap
        )
      },

      estrangulador: {
        label: 'Estrangulador',
        value: value(
          co.estrangulador,
          item?.estrangulador,
          parsed.estrangulador
        )
      },

      ptp: {
        label: 'PTP',
        value: value(
          co.ptp,
          item?.ptp,
          parsed.ptp
        )
      },

      ldd: {
        label: 'LDD',
        value: value(
          co.ldd,
          item?.ldd,
          parsed.ldd
        )
      },

      ptr: {
        label: 'PTR',
        value: value(
          co.ptr,
          item?.ptr,
          parsed.ptr
        )
      },

      epm: {
        label: 'EPM',
        value: value(
          co.epm,
          item?.epm,
          parsed.epm
        )
      },

      carrera: {
        label: 'Carrera',
        value: value(
          co.carrera,
          item?.carrera,
          parsed.carrera
        )
      },

      lbn: {
        label: 'LBN',
        value: value(
          co.lbn,
          item?.lbn,
          parsed.lbn
        )
      },

      ctm: {
        label: 'CTM',
        value: value(
          nivel.ctm,
          item?.ctm
        )
      },

      bls: {
        label: 'BLS',
        value: value(
          nivel.bls,
          item?.bls
        )
      },

      horaNivel: {
        label: 'Hora de nivel',
        value: value(
          nivel.horaNivel,
          item?.horaNivel
        )
      },

      trabajo: {
        label: 'Trabajo',
        value: checks.trabajo ? 'Sí' : 'No'
      },

      drenar: {
        label: 'Drenar',
        value: checks.drenar ? 'Sí' : 'No'
      },

      aforo: {
        label: 'Aforo',
        value: checks.aforo ? 'Sí' : 'No'
      },

      intermitente: {
        label: 'Intermitente',
        value: checks.intermitente ? 'Sí' : 'No'
      },

      observaciones: {
        label: 'Observaciones',
        value: value(u.obsText(item))
      }
    };
  },

  comparisonCandidates(item){
    const currentTime = AdminUtils.getTime(item);

    return (window.AdminFirebase.reportes || [])
      .filter(row =>
        String(row.id) !== String(item?.id) &&
        this.sameWell(item, row)
      )
      .sort(
        (a, b) =>
          AdminUtils.getTime(b) -
          AdminUtils.getTime(a)
      )
      .filter(row =>
        !currentTime ||
        AdminUtils.getTime(row) <= currentTime
      )
      .slice(0, 30);
  },

  selectedComparisonReport(item){
    const candidates = this.comparisonCandidates(item);

    if(!candidates.length){
      return null;
    }

    const selected = candidates.find(row =>
      String(row.id) === String(this.comparisonBaseId)
    );

    if(selected){
      return selected;
    }

    this.comparisonBaseId = candidates[0].id;
    return candidates[0];
  },

  reportComparison(item, base){
    const current = this.comparableReportFields(item);
    const previous = this.comparableReportFields(base);

    return Object.keys(current).map(key => {
      const currentValue = current[key]?.value || '';
      const previousValue = previous[key]?.value || '';

      return {
        key,
        label: current[key]?.label || key,
        before: previousValue,
        after: currentValue,
        changed:
          String(previousValue).trim().toLowerCase() !==
          String(currentValue).trim().toLowerCase()
      };
    });
  },

  renderReportComparison(item){
    const u = AdminUtils;
    const candidates = this.comparisonCandidates(item);
    const base = this.selectedComparisonReport(item);

    if(!base){
      return `
        <section class="detail-section inspector-comparison-section"
                 data-inspector-panel="compare">

          <div class="inspector-empty-state">
            <div class="inspector-empty-icon">⇄</div>

            <b>Sin reporte anterior para comparar</b>

            <span>
              No se encontraron otros registros del mismo pozo.
            </span>
          </div>
        </section>
      `;
    }

    const comparison = this.reportComparison(item, base);
    const changed = comparison.filter(field => field.changed);
    const unchanged = comparison.filter(field => !field.changed);

    return `
      <section class="detail-section inspector-comparison-section"
               data-inspector-panel="compare">

        <div class="comparison-header">
          <div>
            <span class="comparison-eyebrow">
              COMPARACIÓN OPERATIVA
            </span>

            <h3>
              ${u.escapeHtml(
                u.placeText(item) || 'Pozo'
              )}
            </h3>
          </div>

          <span class="comparison-change-count">
            ${changed.length}
            ${changed.length === 1 ? 'cambio' : 'cambios'}
          </span>
        </div>

        <div class="comparison-current-card">
          <div>
            <span>Reporte actual</span>

            <b>
              ${u.escapeHtml(u.fmtDate(item))}
              ·
              ${u.escapeHtml(u.fmtTime(item))}
            </b>

            <small>
              ${u.escapeHtml(
                u.personText(item) || 'Sin recorredor'
              )}
            </small>
          </div>

          <div class="comparison-arrow">← comparado con</div>

          <label>
            <span>Reporte de referencia</span>

            <select id="comparisonBaseSelect">
              ${candidates.map(row => `
                <option
                  value="${u.escapeHtml(row.id)}"
                  ${
                    String(row.id) === String(base.id)
                      ? 'selected'
                      : ''
                  }>
                  ${u.escapeHtml(u.fmtDate(row))}
                  ·
                  ${u.escapeHtml(u.fmtTime(row))}
                  ·
                  ${u.escapeHtml(
                    u.personText(row) || 'Sin recorredor'
                  )}
                </option>
              `).join('')}
            </select>
          </label>
        </div>

        ${
          changed.length
            ? `
              <div class="comparison-section-title">
                <h4>Cambios detectados</h4>
                <span>${changed.length}</span>
              </div>

              <div class="comparison-change-grid">
                ${changed.map(field => `
                  <article class="comparison-field changed">
                    <div class="comparison-field-name">
                      ${u.escapeHtml(field.label)}
                    </div>

                    <div class="comparison-values">
                      <div class="comparison-before-value">
                        <span>Antes</span>
                        <b>
                          ${u.escapeHtml(field.before || 'Sin dato')}
                        </b>
                      </div>

                      <div class="comparison-direction">→</div>

                      <div class="comparison-after-value">
                        <span>Después</span>
                        <b>
                          ${u.escapeHtml(field.after || 'Sin dato')}
                        </b>
                      </div>
                    </div>
                  </article>
                `).join('')}
              </div>
            `
            : `
              <div class="comparison-no-changes">
                <b>Sin cambios operativos detectados</b>

                <span>
                  Los campos comparables conservan los mismos valores.
                </span>
              </div>
            `
        }

        <details class="comparison-unchanged">
          <summary>
            Ver ${unchanged.length} campos sin cambios
          </summary>

          <div class="comparison-stable-grid">
            ${unchanged.map(field => `
              <div>
                <span>${u.escapeHtml(field.label)}</span>
                <b>${u.escapeHtml(field.after || 'Sin dato')}</b>
              </div>
            `).join('')}
          </div>
        </details>

        <div class="comparison-disclaimer">
          La comparación se realiza entre registros capturados y no
          representa por sí sola un diagnóstico de producción.
        </div>
      </section>
    `;
  },

  bindReportComparison(){
    const select = document.getElementById(
      'comparisonBaseSelect'
    );

    if(!select) return;

    select.addEventListener('change', () => {
      this.comparisonBaseId = select.value || null;

      if(!this.currentReportItem) return;

      this.openDetail(
        'reporte',
        this.currentReportItem
      );

      this.setInspectorTab('compare');
    });
  },

  wellOperationalData(item){
    const u = AdminUtils;
    const now = Date.now();

    const reports = (window.AdminFirebase.reportes || [])
      .filter(row => this.sameWell(item, row))
      .sort((a, b) => u.getTime(b) - u.getTime(a));

    const alarms = (window.AdminFirebase.alarmas || [])
      .filter(row => this.sameWell(item, row))
      .sort((a, b) => u.getTime(b) - u.getTime(a));

    const corrections = this.reportCorrections
      ? this.reportCorrections(item)
      : [];

    const lastReport = reports[0] || item;
    const lastTime = u.getTime(lastReport);

    const minutesSinceLast = lastTime
      ? Math.max(0, Math.floor((now - lastTime) / 60000))
      : null;

    const reports24h = reports.filter(row =>
      now - u.getTime(row) <= 24 * 60 * 60 * 1000
    );

    const reports7d = reports.filter(row =>
      now - u.getTime(row) <= 7 * 24 * 60 * 60 * 1000
    );

    const alarms24h = alarms.filter(row =>
      now - u.getTime(row) <= 24 * 60 * 60 * 1000
    );

    const alarms7d = alarms.filter(row =>
      now - u.getTime(row) <= 7 * 24 * 60 * 60 * 1000
    );

    const gpsReports = reports7d.filter(row =>
      u.hasGps(row)
    ).length;

    const gpsPct = reports7d.length
      ? Math.round((gpsReports / reports7d.length) * 100)
      : 0;

    const latestStatus = String(
      lastReport?.co?.estatus ||
      lastReport?.estatus ||
      ''
    ).trim();

    const latestMode =
      u.modeText(lastReport) ||
      lastReport?.tipo ||
      lastReport?.modo ||
      'Reporte';

    return {
      reports,
      alarms,
      corrections,
      lastReport,
      lastTime,
      minutesSinceLast,
      reports24h,
      reports7d,
      alarms24h,
      alarms7d,
      gpsPct,
      latestStatus,
      latestMode
    };
  },

  operationalDiagnosis(item){
    const data = this.wellOperationalData(item);
    const reasons = [];
    let score = 0;

    if(data.minutesSinceLast === null){
      score += 3;
      reasons.push(
        'No se pudo determinar la fecha de la última visita.'
      );
    }else if(data.minutesSinceLast > 720){
      score += 3;
      reasons.push(
        'El pozo lleva más de 12 horas sin un reporte reciente.'
      );
    }else if(data.minutesSinceLast > 240){
      score += 2;
      reasons.push(
        'El pozo lleva más de 4 horas sin un reporte reciente.'
      );
    }else if(data.minutesSinceLast > 90){
      score += 1;
      reasons.push(
        'Conviene revisar la frecuencia reciente de visitas.'
      );
    }

    if(data.alarms24h.length >= 2){
      score += 3;
      reasons.push(
        `${data.alarms24h.length} alarmas fueron registradas en las últimas 24 horas.`
      );
    }else if(data.alarms24h.length === 1){
      score += 2;
      reasons.push(
        'Existe una alarma registrada en las últimas 24 horas.'
      );
    }else if(data.alarms7d.length > 0){
      score += 1;
      reasons.push(
        `${data.alarms7d.length} alarma${data.alarms7d.length === 1 ? '' : 's'} durante los últimos 7 días.`
      );
    }

    if(data.gpsPct < 70 && data.reports7d.length >= 3){
      score += 2;
      reasons.push(
        `Solo ${data.gpsPct}% de los reportes recientes contiene GPS.`
      );
    }else if(data.gpsPct < 90 && data.reports7d.length >= 3){
      score += 1;
      reasons.push(
        `La cobertura GPS reciente es de ${data.gpsPct}%.`
      );
    }

    const status = data.latestStatus.toLowerCase();

    if(
      status.includes('cerrado') ||
      status.includes('fuera') ||
      status.includes('paro')
    ){
      score += 2;
      reasons.push(
        `El estatus más reciente es "${data.latestStatus}".`
      );
    }else if(status.includes('intermitente')){
      score += 1;
      reasons.push(
        'El pozo está registrado como intermitente.'
      );
    }

    if(data.corrections.length >= 3){
      score += 1;
      reasons.push(
        'El reporte acumula varias correcciones registradas.'
      );
    }

    let level = 'normal';
    let label = 'Operación normal';
    let description =
      'No se detectaron condiciones que requieran atención inmediata.';

    if(score >= 5){
      level = 'danger';
      label = 'Requiere atención';
      description =
        'Existen varios indicadores que conviene revisar operativamente.';
    }else if(score >= 2){
      level = 'warning';
      label = 'Mantener vigilancia';
      description =
        'Se detectaron elementos que ameritan seguimiento.';
    }

    if(!reasons.length){
      reasons.push(
        'Sin alarmas recientes, buena cobertura GPS y actividad operativa disponible.'
      );
    }

    return {
      ...data,
      score,
      level,
      label,
      description,
      reasons
    };
  },

  formatOperationalAge(minutes){
    if(minutes === null || minutes === undefined){
      return 'Sin información';
    }

    if(minutes < 1) return 'Ahora mismo';
    if(minutes === 1) return 'Hace 1 minuto';
    if(minutes < 60) return `Hace ${minutes} minutos`;

    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;

    if(hours < 24){
      if(!remaining){
        return hours === 1
          ? 'Hace 1 hora'
          : `Hace ${hours} horas`;
      }

      return `Hace ${hours} h ${remaining} min`;
    }

    const days = Math.floor(hours / 24);

    return days === 1
      ? 'Hace 1 día'
      : `Hace ${days} días`;
  },

  renderOperationalDiagnosis(item){
    const u = AdminUtils;
    const diagnosis = this.operationalDiagnosis(item);

    return `
      <section class="well-diagnosis diagnosis-${diagnosis.level}"
               data-inspector-panel="summary">

        <div class="well-diagnosis-head">
          <div>
            <span class="diagnosis-eyebrow">
              DIAGNÓSTICO OPERATIVO
            </span>

            <h3>${u.escapeHtml(diagnosis.label)}</h3>

            <p>
              ${u.escapeHtml(diagnosis.description)}
            </p>
          </div>

          <span class="diagnosis-state">
            ${
              diagnosis.level === 'danger'
                ? 'ATENCIÓN'
                : diagnosis.level === 'warning'
                  ? 'VIGILANCIA'
                  : 'NORMAL'
            }
          </span>
        </div>

        <div class="diagnosis-metrics">
          <div>
            <span>Última actividad</span>
            <b>
              ${u.escapeHtml(
                this.formatOperationalAge(
                  diagnosis.minutesSinceLast
                )
              )}
            </b>
          </div>

          <div>
            <span>Reportes 24 h</span>
            <b>${diagnosis.reports24h.length}</b>
          </div>

          <div>
            <span>Alarmas 24 h</span>
            <b>${diagnosis.alarms24h.length}</b>
          </div>

          <div>
            <span>GPS últimos 7 días</span>
            <b>${diagnosis.gpsPct}%</b>
          </div>
        </div>

        <div class="diagnosis-status-row">
          <div>
            <span>Estatus reciente</span>
            <b>
              ${u.escapeHtml(
                diagnosis.latestStatus || 'Sin estatus'
              )}
            </b>
          </div>

          <div>
            <span>Último tipo de reporte</span>
            <b>
              ${u.escapeHtml(
                diagnosis.latestMode || 'Reporte'
              )}
            </b>
          </div>

          <div>
            <span>Correcciones</span>
            <b>${diagnosis.corrections.length}</b>
          </div>
        </div>

        <div class="diagnosis-reasons">
          <span>Elementos considerados</span>

          <ul>
            ${diagnosis.reasons.map(reason => `
              <li>${u.escapeHtml(reason)}</li>
            `).join('')}
          </ul>
        </div>

        <div class="diagnosis-disclaimer">
          Evaluación informativa basada en los registros disponibles.
          No sustituye el criterio del supervisor ni los procedimientos
          operativos del campo.
        </div>
      </section>
    `;
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

      ${useInspector ? this.renderOperationalDiagnosis(item) : ''}

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
      this.bindReportComparison();

      requestAnimationFrame(() => {
        bodyEl.scrollTop = 0;
      });
    }else{
      document.getElementById('detailDialog')?.showModal();
    }
  }
};

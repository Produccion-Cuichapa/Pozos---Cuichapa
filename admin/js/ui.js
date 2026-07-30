window.AdminUI = {
  currentView: 'dashboard',
  reportInspectorRows: [],
  reportInspectorIndex: -1,
  currentReportItem: null,
  activeInspectorTab: 'summary',
  timelineFilter: 'all',
  comparisonBaseId: null,
  inspectorSource: 'report',
  inspectorWellContext: null,

  /*
   * FASE 2:
   * Las pestañas pesadas se generan únicamente cuando
   * el usuario las abre por primera vez.
   */
  lazyInspectorKey: '',
  lazyInspectorLoaded: new Set(),

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
      ia: ['IA Cuichapa', 'Asistente inteligente para análisis operativo.'],
      exportaciones: ['Exportaciones', 'Generación automática de formatos Excel y reportes.'],
      upv: ['UPV', 'Centro de control de Unidades de Producción y Volumen.']
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

    /*
     * Construye Historial, Comparar o Correcciones solamente
     * cuando el usuario selecciona realmente esa pestaña.
     */
    this.ensureInspectorPanel(selected);

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

  inspectorItemKey(item){
    if(!item){
      return '';
    }

    return String(
      item.id ||
      item.reportId ||
      item.reporteId ||
      AdminUtils.getTime(item) ||
      ''
    );
  },

  resetInspectorLazyState(item){
    const key = this.inspectorItemKey(item);

    if(key === this.lazyInspectorKey){
      return;
    }

    this.lazyInspectorKey = key;
    this.lazyInspectorLoaded = new Set();

    /*
     * Cada reporte nuevo abre en Resumen. Así no se dispara
     * automáticamente una pestaña pesada que hubiera quedado
     * seleccionada en el reporte anterior.
     */
    this.activeInspectorTab = 'summary';
    this.timelineFilter = 'all';
    this.comparisonBaseId = null;
  },

  inspectorLazyPlaceholder(tab, title){
    return `
      <section
        class="inspector-lazy-panel inspector-lazy-${tab}"
        data-inspector-panel="${tab}"
        data-inspector-lazy="${tab}"
        aria-busy="false">

        <div class="inspector-lazy-message">
          <strong>${AdminUtils.escapeHtml(title)}</strong>
          <span>
            Esta sección se cargará al abrir la pestaña.
          </span>
        </div>
      </section>
    `;
  },

  prepareInspectorLazyPanels(item){
    const body = document.getElementById(
      'reportInspectorBody'
    );

    if(!body){
      return;
    }

    this.resetInspectorLazyState(item);

    /*
     * Elimina cualquier sección pesada que haya podido quedar
     * generada por una apertura anterior.
     */
    body.querySelectorAll(
      [
        '.inspector-timeline-section',
        '.inspector-history-section',
        '.inspector-comparison-section',
        '.inspector-corrections-section',
        '[data-inspector-lazy]'
      ].join(',')
    ).forEach(section => section.remove());

    const rawJson = body.querySelector(
      ':scope > .raw-json'
    );

    const placeholders = [
      this.inspectorLazyPlaceholder(
        'history',
        'Historial operativo'
      ),
      this.inspectorLazyPlaceholder(
        'compare',
        'Comparación de reportes'
      ),
      this.inspectorLazyPlaceholder(
        'corrections',
        'Correcciones registradas'
      )
    ].join('');

    if(rawJson){
      rawJson.insertAdjacentHTML(
        'beforebegin',
        placeholders
      );
    }else{
      body.insertAdjacentHTML(
        'beforeend',
        placeholders
      );
    }

    const historyEl = document.getElementById(
      'inspectorHistoryCount'
    );

    const correctionsEl = document.getElementById(
      'inspectorCorrectionsCount'
    );

    /*
     * No calculamos todavía las cantidades porque eso obligaría
     * a recorrer los datos antes de que se abra la pestaña.
     */
    if(historyEl){
      historyEl.textContent = '…';
    }

    if(correctionsEl){
      correctionsEl.textContent = '…';
      correctionsEl.classList.remove('has-items');
    }
  },

  ensureInspectorPanel(tab){
    const lazyTabs = [
      'history',
      'compare',
      'corrections'
    ];

    if(!lazyTabs.includes(tab)){
      return;
    }

    const item = this.currentReportItem;

    if(!item){
      return;
    }

    const currentKey = this.inspectorItemKey(item);

    if(currentKey !== this.lazyInspectorKey){
      this.resetInspectorLazyState(item);
    }

    if(this.lazyInspectorLoaded.has(tab)){
      return;
    }

    const body = document.getElementById(
      'reportInspectorBody'
    );

    if(!body){
      return;
    }

    const placeholder = body.querySelector(
      `[data-inspector-lazy="${tab}"]`
    );

    if(!placeholder){
      return;
    }

    placeholder.setAttribute('aria-busy', 'true');

    /*
     * Permitimos que el navegador pinte primero la pestaña activa
     * y después ejecutamos la construcción pesada.
     */
    requestAnimationFrame(() => {
      if(
        !this.currentReportItem ||
        this.inspectorItemKey(this.currentReportItem) !== currentKey
      ){
        return;
      }

      let html = '';

      try{
        if(tab === 'history'){
          html = this.renderWellTimeline(item);
        }

        if(tab === 'compare'){
          html = this.renderReportComparison(item);
        }

        if(tab === 'corrections'){
          html = this.renderReportCorrections(item);
        }

        placeholder.insertAdjacentHTML(
          'beforebegin',
          html || `
            <section
              class="inspector-empty-section"
              data-inspector-panel="${tab}">
              <p>No hay información disponible.</p>
            </section>
          `
        );

        placeholder.remove();
        this.lazyInspectorLoaded.add(tab);

        if(tab === 'history'){
          const historyCount =
            this.timelineEvents(item).length;

          const historyEl = document.getElementById(
            'inspectorHistoryCount'
          );

          if(historyEl){
            historyEl.textContent = historyCount;
          }

          this.bindWellTimeline();
          this.bindInspectorHistory();
        }

        if(tab === 'compare'){
          this.bindReportComparison();
        }

        if(tab === 'corrections'){
          const correctionsCount =
            this.reportCorrections(item).length;

          const correctionsEl = document.getElementById(
            'inspectorCorrectionsCount'
          );

          if(correctionsEl){
            correctionsEl.textContent =
              correctionsCount;

            correctionsEl.classList.toggle(
              'has-items',
              correctionsCount > 0
            );
          }
        }

        /*
         * La nueva sección debe quedar visible inmediatamente,
         * porque fue insertada después de setInspectorTab().
         */
        body.querySelectorAll(
          '[data-inspector-panel]'
        ).forEach(section => {
          section.classList.toggle(
            'is-tab-active',
            section.dataset.inspectorPanel === tab
          );
        });

      }catch(error){
        console.error(
          `Error cargando pestaña ${tab}:`,
          error
        );

        placeholder.removeAttribute('aria-busy');

        placeholder.innerHTML = `
          <div class="inspector-lazy-message">
            <strong>No fue posible cargar esta sección</strong>
            <span>
              Cierra el inspector y vuelve a intentarlo.
            </span>
          </div>
        `;
      }
    });
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

    // El Expediente Digital pertenece exclusivamente a Resumen.
    // Debe reclasificarse después de limpiar los atributos.
    const wellExpedient = Array.from(body.children).find(
      element =>
        element.classList.contains('well-expedient')
    );

    if(wellExpedient){
      wellExpedient.dataset.inspectorPanel = 'summary';
    }

    // El diagnóstico operativo también pertenece únicamente a Resumen.
    const wellDiagnosis = Array.from(body.children).find(
      element =>
        element.classList.contains('well-diagnosis')
    );

    if(wellDiagnosis){
      wellDiagnosis.dataset.inspectorPanel = 'summary';
    }

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

      if(
        title.includes('historial') ||
        title.includes('tendencia')
      ){
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

    /*
     * Historial, Comparar y Correcciones ya no se construyen aquí.
     * Solo se colocan contenedores livianos.
     */
    this.prepareInspectorLazyPanels(item);

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

    /*
     * Los contadores de Historial y Correcciones se actualizan
     * cuando cada pestaña se genera por primera vez.
     */
    if(historyEl && historyEl.textContent !== '…'){
      historyEl.textContent = '…';
    }

    if(correctionsEl && correctionsEl.textContent !== '…'){
      correctionsEl.textContent = '…';
      correctionsEl.classList.remove('has-items');
    }

    this.setInspectorTab(
      this.activeInspectorTab || 'summary'
    );
  },

  setInspectorSource(source, context){
    this.inspectorSource =
      source === 'well'
        ? 'well'
        : 'report';

    this.inspectorWellContext =
      this.inspectorSource === 'well'
        ? (context || null)
        : null;
  },

  resetInspectorSource(){
    this.inspectorSource = 'report';
    this.inspectorWellContext = null;
  },

  isWellExpedient(){
    return (
      this.inspectorSource === 'well' &&
      this.inspectorWellContext
    );
  },

  wellExpedientData(item){
    const u = AdminUtils;
    const operational = this.wellOperationalData(item);

    const reports =
      this.inspectorWellContext?.reports?.length
        ? this.inspectorWellContext.reports
        : operational.reports;

    const alarms =
      this.inspectorWellContext?.alarms?.length
        ? this.inspectorWellContext.alarms
        : operational.alarms;

    const latest =
      this.inspectorWellContext?.latest ||
      operational.lastReport ||
      item;

    const fields = this.comparableReportFields(latest);

    const now = Date.now();

    const reports30d = reports.filter(row => {
      const time = u.getTime(row);

      return (
        time &&
        now - time <= 30 * 24 * 60 * 60 * 1000
      );
    });

    const reportsWithGps = reports.filter(row =>
      u.hasGps(row)
    ).length;

    const gpsCoverage = reports.length
      ? Math.round(
          (reportsWithGps / reports.length) * 100
        )
      : 0;

    const statusChanges = reports
      .slice()
      .sort((a, b) => u.getTime(a) - u.getTime(b))
      .reduce((total, row, index, list) => {
        if(index === 0) return 0;

        const current =
          this.comparableReportFields(row)
            .estatus.value
            .trim()
            .toLowerCase();

        const previous =
          this.comparableReportFields(list[index - 1])
            .estatus.value
            .trim()
            .toLowerCase();

        return total + (
          current &&
          previous &&
          current !== previous
            ? 1
            : 0
        );
      }, 0);

    let averageVisits = 0;

    if(reports30d.length){
      const dates = reports30d
        .map(row => u.dateObj(row))
        .filter(Boolean)
        .map(date => u.ymd(date));

      const activeDays = new Set(dates).size;

      averageVisits = activeDays
        ? reports30d.length / activeDays
        : 0;
    }

    const coordinates =
      this.inspectorWellContext?.coords || null;

    const well =
      this.inspectorWellContext?.well ||
      u.placeText(item) ||
      'Sin pozo';

    return {
      operational,
      reports,
      alarms,
      latest,
      fields,
      well,
      coordinates,
      gpsCoverage,
      statusChanges,
      averageVisits,
      reports30d
    };
  },

  expedientState(item){
    const data = this.wellExpedientData(item);
    const status = String(
      data.fields.estatus.value || ''
    ).toLowerCase();

    if(
      status.includes('cerrado') ||
      status.includes('fuera') ||
      status.includes('paro')
    ){
      return {
        key: 'closed',
        label: data.fields.estatus.value || 'Cerrado'
      };
    }

    if(status.includes('intermitente')){
      return {
        key: 'intermittent',
        label: 'Intermitente'
      };
    }

    const diagnosis = this.operationalDiagnosis(item);

    if(diagnosis.level === 'danger'){
      return {
        key: 'danger',
        label: 'Requiere atención'
      };
    }

    if(diagnosis.level === 'warning'){
      return {
        key: 'warning',
        label: 'En vigilancia'
      };
    }

    return {
      key: 'operating',
      label: data.fields.estatus.value || 'Operando'
    };
  },

  renderWellExpedient(item){
    const u = AdminUtils;
    const data = this.wellExpedientData(item);
    const state = this.expedientState(item);
    const fields = data.fields;
    const diagnosis = data.operational;

    const lastAge = this.formatOperationalAge(
      diagnosis.minutesSinceLast
    );

    const coordinates = data.coordinates;

    const mapUrl = coordinates
      ? `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lon}`
      : '';

    return `
      <section class="well-expedient well-expedient-${state.key}"
               data-inspector-panel="summary">

        <header class="well-expedient-hero">
          <div class="well-expedient-identity">
            <span class="well-expedient-eyebrow">
              EXPEDIENTE DIGITAL
            </span>

            <h2>
              POZO ${u.escapeHtml(data.well)}
            </h2>

            <div class="well-expedient-state">
              <i></i>
              ${u.escapeHtml(state.label)}
            </div>
          </div>

          <div class="well-expedient-actions">
            ${
              mapUrl
                ? `<a
                     href="${mapUrl}"
                     target="_blank"
                     rel="noopener"
                     class="well-expedient-map">
                     Ver ubicación
                   </a>`
                : ''
            }

            <span class="well-expedient-report-count">
              ${data.reports.length}
              ${data.reports.length === 1 ? 'reporte' : 'reportes'}
            </span>
          </div>
        </header>

        <div class="well-expedient-primary">
          <div>
            <span>Estatus</span>
            <b>
              ${u.escapeHtml(
                fields.estatus.value || 'Sin información'
              )}
            </b>
          </div>

          <div>
            <span>SAP</span>
            <b>${u.escapeHtml(fields.sap.value || '—')}</b>
          </div>

          <div>
            <span>Fluye</span>
            <b>${u.escapeHtml(fields.fluye.value || '—')}</b>
          </div>

          <div>
            <span>Última actividad</span>
            <b>${u.escapeHtml(lastAge)}</b>
          </div>

          <div>
            <span>Último recorredor</span>
            <b>
              ${u.escapeHtml(
                u.personText(data.latest) ||
                this.inspectorWellContext?.person ||
                'Sin información'
              )}
            </b>
          </div>

          <div>
            <span>GPS histórico</span>
            <b>${data.gpsCoverage}%</b>
          </div>
        </div>

        <div class="well-expedient-metrics">
          <article>
            <span>Reportes 24 h</span>
            <strong>
              ${diagnosis.reports24h.length}
            </strong>
          </article>

          <article>
            <span>Reportes 7 días</span>
            <strong>
              ${diagnosis.reports7d.length}
            </strong>
          </article>

          <article>
            <span>Reportes 30 días</span>
            <strong>
              ${data.reports30d.length}
            </strong>
          </article>

          <article>
            <span>Alarmas</span>
            <strong>${data.alarms.length}</strong>
          </article>

          <article>
            <span>Correcciones</span>
            <strong>
              ${diagnosis.corrections.length}
            </strong>
          </article>

          <article>
            <span>Cambios de estatus</span>
            <strong>${data.statusChanges}</strong>
          </article>

          <article>
            <span>Promedio visitas</span>
            <strong>
              ${data.averageVisits.toFixed(1)}
            </strong>
            <small>por día activo</small>
          </article>

          <article>
            <span>Cobertura GPS</span>
            <strong>${data.gpsCoverage}%</strong>
          </article>
        </div>

        <div class="well-expedient-operation">
          <div class="well-expedient-section-title">
            <span>ÚLTIMOS DATOS OPERATIVOS</span>
            <small>
              ${u.escapeHtml(u.fmtDate(data.latest))}
              ·
              ${u.escapeHtml(u.fmtTime(data.latest))}
            </small>
          </div>

          <div class="well-expedient-operation-grid">
            ${[
              fields.estrangulador,
              fields.ptp,
              fields.ptr,
              fields.ldd,
              fields.lbn,
              fields.epm,
              fields.carrera,
              fields.ctm,
              fields.bls,
              fields.horaNivel
            ].map(field => `
              <div>
                <span>${u.escapeHtml(field.label)}</span>
                <b>${u.escapeHtml(field.value || '—')}</b>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
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

  trendNumber(value){
    if(value === null || value === undefined){
      return null;
    }

    const text = String(value)
      .trim()
      .replace(/,/g, '.')
      .replace(/[^\d.+-]/g, '');

    if(!text){
      return null;
    }

    const number = Number(text);

    return Number.isFinite(number)
      ? number
      : null;
  },

  trendReports(item){
    const contextReports =
      this.inspectorWellContext?.reports;

    const reports = Array.isArray(contextReports)
      ? contextReports
      : this.sameWellReports(item);

    return reports
      .slice()
      .sort(
        (a, b) =>
          AdminUtils.getTime(a) -
          AdminUtils.getTime(b)
      );
  },

  trendValue(report, field){
    const fields =
      this.comparableReportFields(report);

    const direct =
      fields?.[field]?.value;

    const directNumber =
      this.trendNumber(direct);

    if(directNumber !== null){
      return directNumber;
    }

    const parsed =
      AdminUtils.parseMsg
        ? AdminUtils.parseMsg(report)
        : {};

    const co = report?.co || {};

    const alternatives = {
      ptp: [
        co.ptp,
        report.ptp,
        parsed.ptp
      ],

      ptr: [
        co.ptr,
        report.ptr,
        parsed.ptr
      ],

      ldd: [
        co.ldd,
        report.ldd,
        parsed.ldd
      ],

      lbn: [
        co.lbn,
        report.lbn,
        parsed.lbn
      ],

      ctm: [
        report?.nivel?.ctm,
        report?.nivel?.nivel,
        report.ctm,
        report.nivelCtm,
        report.nivelCM,
        report?.co?.ctm
      ]
    };

    for(const value of alternatives[field] || []){
      const number = this.trendNumber(value);

      if(number !== null){
        return number;
      }
    }

    if(field === 'ctm'){
      const msg = String(
        report.msg ||
        report.mensaje ||
        report.message ||
        report.texto ||
        ''
      );

      const match =
        msg.match(
          /CTM\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i
        ) ||
        msg.match(
          /CENT[IÍ]METROS?\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i
        );

      if(match){
        return this.trendNumber(match[1]);
      }
    }

    return null;
  },

  isFracTankMeasurement(report){
    const message = String(
      report.msg ||
      report.mensaje ||
      report.message ||
      report.texto ||
      ''
    );

    const upper =
      message.toUpperCase();

    const isGuardia =
      upper.includes('NIVELES DE GUARDIA');

    if(isGuardia){
      return this.trendValue(
        report,
        'ctm'
      ) !== null;
    }

    const fields =
      this.comparableReportFields(report);

    const fluye = String(
      report?.co?.fluye ||
      report.fluye ||
      fields?.fluye?.value ||
      ''
    )
      .trim()
      .toUpperCase();

    const isFt =
      fluye === 'FT' ||
      fluye.includes('FRAC TANK');

    const hasBlock =
      
/NIVEL\s+(?:DE\s+)?(?:FRAC\s*TANK|PRESA\s*MET[ÁA]LICA)/i
        .test(message);

    const hasCtm =
      this.trendValue(
        report,
        'ctm'
      ) !== null;

    return (
      isFt &&
      hasBlock &&
      hasCtm
    );
  },

  trendWeekRange(weekOffset=0){
    const now = new Date();

    const currentDay = now.getDay();
    const daysFromMonday =
      currentDay === 0
        ? 6
        : currentDay - 1;

    const start = new Date(now);

    start.setDate(
      now.getDate() -
      daysFromMonday -
      (Number(weekOffset || 0) * 7)
    );

    start.setHours(0, 0, 0, 0);

    const end = new Date(start);

    end.setDate(start.getDate() + 7);
    end.setHours(0, 0, 0, 0);

    return {
      start: start.getTime(),
      end: end.getTime(),
      startDate: start,
      endDate: new Date(end.getTime() - 1)
    };
  },

  trendWeekLabel(weekOffset=0){
    const range =
      this.trendWeekRange(weekOffset);

    const format = date =>
      date.toLocaleDateString('es-MX', {
        day:'2-digit',
        month:'short'
      });

    return (
      `${format(range.startDate)} – ` +
      `${format(range.endDate)}`
    );
  },

  trendPoints(item, field, weekOffset=0){
    const range =
      this.trendWeekRange(weekOffset);

    return this.trendReports(item)
      .filter(report => {
        const time =
          AdminUtils.getTime(report);

        if(
          !time ||
          time < range.start ||
          time >= range.end
        ){
          return false;
        }

        if(
          field === 'ctm' &&
          !this.isFracTankMeasurement(report)
        ){
          return false;
        }

        return true;
      })
      .map(report => ({
        report,
        time: AdminUtils.getTime(report),
        value: this.trendValue(
          report,
          field
        )
      }))
      .filter(point =>
        point.value !== null
      );
  },

  trendStats(points){
    if(!points.length){
      return null;
    }

    const values =
      points.map(point => point.value);

    const total =
      values.reduce(
        (sum, value) => sum + value,
        0
      );

    return {
      last: values[values.length - 1],
      min: Math.min(...values),
      max: Math.max(...values),
      average: total / values.length
    };
  },

  trendFormat(value){
    if(!Number.isFinite(value)){
      return '—';
    }

    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(1);
  },

  trendSvg(points, label, unit){
    if(!points.length){
      return `
        <div class="well-trend-empty">
          Sin mediciones de ${AdminUtils.escapeHtml(label)}
          en la semana seleccionada.
        </div>
      `;
    }

    const width = 640;
    const height = 190;

    const pad = {
      left: 42,
      right: 18,
      top: 18,
      bottom: 30
    };

    const values =
      points.map(point => point.value);

    let min = Math.min(...values);
    let max = Math.max(...values);

    if(min === max){
      min -= 1;
      max += 1;
    }

    const usableWidth =
      width - pad.left - pad.right;

    const usableHeight =
      height - pad.top - pad.bottom;

    const coords = points.map(
      (point, index) => {
        const x =
          points.length === 1
            ? pad.left + usableWidth / 2
            : pad.left +
              (
                index /
                (points.length - 1)
              ) * usableWidth;

        const y =
          pad.top +
          (
            1 -
            (point.value - min) /
            (max - min)
          ) * usableHeight;

        return {
          ...point,
          x,
          y
        };
      }
    );

    const polyline = coords
      .map(point =>
        `${point.x.toFixed(1)},${point.y.toFixed(1)}`
      )
      .join(' ');

    const gridLines = [0, .25, .5, .75, 1]
      .map(position => {
        const y =
          pad.top +
          position * usableHeight;

        const value =
          max -
          position * (max - min);

        return `
          <line
            x1="${pad.left}"
            y1="${y}"
            x2="${width - pad.right}"
            y2="${y}"
            class="well-trend-grid-line"
          ></line>

          <text
            x="${pad.left - 7}"
            y="${y + 3}"
            text-anchor="end"
            class="well-trend-axis-label">
            ${AdminUtils.escapeHtml(
              this.trendFormat(value)
            )}
          </text>
        `;
      })
      .join('');

    const circles = coords
      .map(point => {
        const title = [
          label,
          `${this.trendFormat(point.value)} ${unit}`,
          AdminUtils.fmtDate(point.report),
          AdminUtils.fmtTime(point.report),
          AdminUtils.personText(point.report) ||
            'Sin recorredor'
        ].join(' · ');

        return `
          <circle
            cx="${point.x.toFixed(1)}"
            cy="${point.y.toFixed(1)}"
            r="4"
            class="well-trend-point">
            <title>
              ${AdminUtils.escapeHtml(title)}
            </title>
          </circle>
        `;
      })
      .join('');

    const first =
      coords[0]?.report;

    const last =
      coords[coords.length - 1]?.report;

    return `
      <svg
        class="well-trend-svg"
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="Tendencia de ${AdminUtils.escapeHtml(label)}">

        ${gridLines}

        <polyline
          points="${polyline}"
          class="well-trend-line">
        </polyline>

        ${circles}

        <text
          x="${pad.left}"
          y="${height - 8}"
          class="well-trend-date-label">
          ${AdminUtils.escapeHtml(
            AdminUtils.fmtDate(first)
          )}
        </text>

        <text
          x="${width - pad.right}"
          y="${height - 8}"
          text-anchor="end"
          class="well-trend-date-label">
          ${AdminUtils.escapeHtml(
            AdminUtils.fmtDate(last)
          )}
        </text>
      </svg>
    `;
  },

  renderTrendCard(item, config, weekOffset=0){
    const points =
      this.trendPoints(
        item,
        config.field,
        weekOffset
      );

    const stats =
      this.trendStats(points);

    return `
      <article class="well-trend-card">
        <div class="well-trend-card-head">
          <div>
            <span>
              ${AdminUtils.escapeHtml(
                config.category
              )}
            </span>

            <h4>
              ${AdminUtils.escapeHtml(
                config.label
              )}
            </h4>
          </div>

          <b>
            ${points.length}
            ${
              points.length === 1
                ? 'medición'
                : 'mediciones'
            }
          </b>
        </div>

        ${
          stats
            ? `
              <div class="well-trend-stats">
                <div>
                  <span>Último</span>
                  <b>
                    ${this.trendFormat(stats.last)}
                    <small>${config.unit}</small>
                  </b>
                </div>

                <div>
                  <span>Mínimo</span>
                  <b>
                    ${this.trendFormat(stats.min)}
                    <small>${config.unit}</small>
                  </b>
                </div>

                <div>
                  <span>Máximo</span>
                  <b>
                    ${this.trendFormat(stats.max)}
                    <small>${config.unit}</small>
                  </b>
                </div>

                <div>
                  <span>Promedio</span>
                  <b>
                    ${this.trendFormat(stats.average)}
                    <small>${config.unit}</small>
                  </b>
                </div>
              </div>
            `
            : ''
        }

        <div class="well-trend-chart">
          ${this.trendSvg(
            points,
            config.label,
            config.unit
          )}
        </div>
      </article>
    `;
  },

  renderWellTrends(item){
    if(!this.isWellExpedient()){
      return '';
    }

    const weekOffset = Number(
      this.activeTrendWeek || 0
    );

    const configs = [
      {
        field: 'ptp',
        label: 'PTP',
        unit: 'kg/cm²',
        category: 'PRESIÓN'
      },
      {
        field: 'ptr',
        label: 'PTR',
        unit: 'kg/cm²',
        category: 'PRESIÓN'
      },
      {
        field: 'ldd',
        label: 'LDD',
        unit: 'kg/cm²',
        category: 'PRESIÓN'
      },
      {
        field: 'lbn',
        label: 'LBN',
        unit: 'kg/cm²',
        category: 'PRESIÓN'
      },
      {
        field: 'ctm',
        label: 'Nivel Frac Tank',
        unit: 'cm',
        category: 'NIVEL'
      }
    ];

    const options = [
      [0, 'Semana actual'],
      [1, 'Semana anterior'],
      [2, 'Hace 2 semanas'],
      [3, 'Hace 3 semanas']
    ];

    return `
      <section class="
        detail-section
        inspector-trends-section
      ">
        <div class="inspector-section-heading">
          <div>
            <span class="well-trend-eyebrow">
              ANÁLISIS SEMANAL
            </span>

            <h3>Tendencias operativas</h3>
          </div>

          <span>
            ${AdminUtils.escapeHtml(
              this.trendWeekLabel(weekOffset)
            )}
          </span>
        </div>

        <div class="well-trend-period-bar">
          <div class="well-trend-period-options">
            ${options.map(([value, label]) => `
              <button
                type="button"
                class="
                  well-trend-period-btn
                  ${
                    Number(value) === weekOffset
                      ? 'active'
                      : ''
                  }
                "
                data-trend-week="${value}">
                ${AdminUtils.escapeHtml(label)}
              </button>
            `).join('')}
          </div>

          <span class="well-trend-period-range">
            ${AdminUtils.escapeHtml(
              this.trendWeekLabel(weekOffset)
            )}
          </span>
        </div>

        <div class="well-trends-grid">
          ${configs.map(config =>
            this.renderTrendCard(
              item,
              config,
              weekOffset
            )
          ).join('')}
        </div>

        <div class="well-trend-note">
          Cada periodo corresponde de lunes a domingo.
          Los registros sin valor numérico no se grafican.
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

    this.resetInspectorSource();
  },

  detailMessage(item){
    const values = [
      item?.msg,
      item?.mensaje,
      item?.message,
      item?.texto,
      item?.observaciones,
      item?.obs,
      item?.descripcion,
      item?.nota,
      item?.contenido,
      item?.co?.observaciones,
      item?.nivel?.observaciones
    ];

    for(const value of values){
      const txt = String(value || '').trim();
      if(txt){
        return txt;
      }
    }

    return '';
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

    /*
     * Separación estricta de Estrangulador y TP #Vueltas.
     * No permite que el número de vueltas sea interpretado
     * como pulgadas del estrangulador.
     */
    const rawOperationalMessage = String(
      item?.msg ||
      item?.mensaje ||
      item?.message ||
      item?.texto ||
      ''
    );

    const chokeMessageMatch =
      rawOperationalMessage.match(
        /Estrangulador\s*:\s*(.*?)(?=\s*-\s*TP\s*#?\s*Vueltas?\s*:|\s+TP\s*#?\s*Vueltas?\s*:|\s+SAP\s*:|\s+PTP\s*:|\s+TR\s*#?\s*Vuelta\s*:|\r?\n|$)/i
      );

    const tpTurnsMessageMatch =
      rawOperationalMessage.match(
        /\bTP\s*#?\s*Vueltas?\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i
      );

    const normalizeChokeValue = value => {
      const raw = String(value ?? '')
        .replace(/\*/g, '')
        .trim();

      const normalized = raw
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if(
        !normalized ||
        normalized === '-' ||
        normalized === '—' ||
        normalized === '–' ||
        normalized === 'N/A' ||
        normalized === 'NA' ||
        normalized.includes('SIN ESTRANGULADOR')
      ){
        return '-';
      }

      if(
        normalized === 'FRANCO' ||
        normalized.includes('A FRANCO') ||
        normalized.includes('ABIERTO FRANCO')
      ){
        return 'Franco';
      }

      /*
       * Solamente acepta un número perteneciente al propio
       * segmento del Estrangulador.
       */
      const numericMatch = raw.match(
        /([0-9]+(?:[.,][0-9]+)?)\s*(?:PULG|PULGADAS?|["”])?/i
      );

      if(numericMatch){
        return numericMatch[1].replace(',', '.');
      }

      return '-';
    };

    const estranguladorDetailValue =
      chokeMessageMatch
        ? normalizeChokeValue(chokeMessageMatch[1])
        : normalizeChokeValue(
            co.estrangulador ??
            item?.estrangulador ??
            parsed.estrangulador
          );

    const tpVueltasDetailValue = (() => {
      /*
       * Se da prioridad al valor escrito explícitamente
       * en el mensaje: TP #Vueltas: 5.
       *
       * Se usa una lista con find() para ignorar valores
       * vacíos, guiones y campos antiguos sin contenido.
       */
      const candidates = [
        tpTurnsMessageMatch
          ? tpTurnsMessageMatch[1]
          : '',
        co.tpVueltas,
        co.tpVuelta,
        co.trVueltas,
        co.trVuelta,
        item?.tpVueltas,
        item?.tpVuelta,
        item?.trVueltas,
        item?.trVuelta,
        parsed.tpVueltas,
        parsed.tpVuelta,
        parsed.trVueltas,
        parsed.trVuelta
      ];

      const candidate = candidates.find(value => {
        const clean = String(value ?? '')
          .trim();

        return (
          clean &&
          clean !== '-' &&
          clean !== '—' &&
          clean !== '–'
        );
      }) || '';

      const match = String(candidate).match(
        /[0-9]+(?:[.,][0-9]+)?/
      );

      return match
        ? match[0].replace(',', '.')
        : '-';
    })();

    const isWellExpedient =
      useInspector &&
      this.isWellExpedient();

    titleEl.textContent =
      isAlarm
        ? 'Detalle de alarma'
        : isWellExpedient
          ? `Expediente del pozo ${u.placeText(item) || ''}`
          : 'Detalle de reporte';

    subtitleEl.textContent =
      isWellExpedient
        ? `Información consolidada · Última actualización ${u.fmtDate(item)} ${u.fmtTime(item)}`
        : `${u.fmtDate(item)} ${u.fmtTime(item)} · ${u.placeText(item) || 'Sin pozo/lugar'}`;

    /*
     * Presentación limpia del expediente:
     * la unidad queda en la etiqueta y el valor muestra
     * únicamente el número. No modifica los datos originales.
     */
    const detailNumber = value => {
      const raw = String(
        value === null || value === undefined
          ? ''
          : value
      ).trim();

      if(!raw || raw === '-' || raw === '—'){
        return '-';
      }

      const match = raw.match(
        /[-+]?\d+\s+\d+\s*\/\s*\d+|[-+]?\d+\s*\/\s*\d+|[-+]?\d+(?:[.,]\d+)?/
      );

      return match
        ? match[0].replace(',', '.')
        : raw;
    };

    bodyEl.innerHTML = `
      ${
        isWellExpedient
          ? this.renderWellExpedient(item)
          : ''
      }

      <div class="detail-hero ${isAlarm ? 'alarm-hero' : ''} ${isWellExpedient ? 'expedient-report-hero' : ''}">
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
          <div class="detail-box"><span>Estrangulador (pulg)</span><b>${u.escapeHtml(estranguladorDetailValue)}</b></div>
          <div class="detail-box"><span>PTP (kg/cm²)</span><b>${u.escapeHtml(detailNumber(co.ptp || item.ptp || parsed.ptp || '-'))}</b></div>
          <div class="detail-box"><span>LDD (kg/cm²)</span><b>${u.escapeHtml(detailNumber(co.ldd || item.ldd || parsed.ldd || '-'))}</b></div>
          <div class="detail-box"><span>PTR (kg/cm²)</span><b>${u.escapeHtml(detailNumber(co.ptr || item.ptr || parsed.ptr || '-'))}</b></div>
          <div class="detail-box"><span>EPM</span><b>${u.escapeHtml(detailNumber(co.epm || item.epm || parsed.epm || '-'))}</b></div>
          <div class="detail-box"><span>Carrera (pulg)</span><b>${u.escapeHtml(detailNumber(co.carrera || item.carrera || parsed.carrera || '-'))}</b></div>
          <div class="detail-box"><span>LBN (kg/cm²)</span><b>${u.escapeHtml(detailNumber(co.lbn || item.lbn || parsed.lbn || '-'))}</b></div>
          <div class="detail-box"><span>TP / Vueltas</span><b>${u.escapeHtml(tpVueltasDetailValue)}</b></div>
        </div>
      </div>

      <div class="detail-section">
        <h3>Nivel / Actividades</h3>
        <div class="detail-grid">
          <div class="detail-box"><span>CTM (cm)</span><b>${u.escapeHtml(detailNumber(nivel.ctm || item.ctm || '-'))}</b></div>
          <div class="detail-box"><span>BLS (bbl)</span><b>${u.escapeHtml(detailNumber(nivel.bls || item.bls || '-'))}</b></div>
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
        <div class="obs-box">${
  u.escapeHtml(
    this.detailMessage(item) ||
    'Sin observaciones registradas'
  )
}</div>
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

      ${
        useInspector
          ? this.inspectorLazyPlaceholder(
              'history',
              'Historial operativo'
            )
          : ''
      }

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
      /*
       * Los eventos del Timeline y Comparación se enlazan
       * únicamente cuando se abre cada pestaña.
       */

      requestAnimationFrame(() => {
        bodyEl.scrollTop = 0;
      });
    }else{
      document.getElementById('detailDialog')?.showModal();
    }
  }
};

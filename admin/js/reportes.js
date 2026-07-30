window.AdminReportes = {
  quickFilter: 'all',
  currentRows: [],

  // Render incremental:
  // evita bloquear el navegador al mostrar cientos de reportes.
  renderVersion: 0,
  renderTimer: null,
  renderChunkSize: 100,

  // Solo se crean estas filas en el DOM.
  visibleLimit: 100,

  init(){
    ['repDesde','repHasta','repBuscar','repModo'].forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;

      el.addEventListener('input', () => this.requestRender());
      el.addEventListener('change', () => this.requestRender());
    });

    document.getElementById('repLimpiar')?.addEventListener('click', () => {
      ['repDesde','repHasta','repBuscar','repModo'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
      });

      this.quickFilter = 'all';
      this.updateQuickButtons();
      this.render();
    });

    document.getElementById('repExportar')?.addEventListener('click', () => {
      AdminExport.csv(
        'reportes_pozos_cuichapa.csv',
        this.filtered()
      );
    });

    document.querySelectorAll('[data-report-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.quickFilter = btn.dataset.reportFilter || 'all';
        this.updateQuickButtons();
        this.render();
      });
    });

    this.updateQuickButtons();
  },

  requestRender(){
    clearTimeout(this.renderTimer);

    // Cada búsqueda o cambio de filtro vuelve a los 100 primeros.
    this.visibleLimit = 100;

    this.renderTimer = setTimeout(() => {
      this.render();
    }, 60);
  },

  updateQuickButtons(){
    document.querySelectorAll('[data-report-filter]').forEach(btn => {
      btn.classList.toggle(
        'active',
        btn.dataset.reportFilter === this.quickFilter
      );
    });
  },

  ymdToday(){
    const now = new Date();

    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
  },

  rowDate(row){
    const u = AdminUtils;
    const dateObj = u.dateObj(row);

    if(dateObj && !isNaN(dateObj)){
      return u.ymd(dateObj);
    }

    return String(row.fecha || '').slice(0, 10);
  },

  photosCount(row){
    const photos = []
      .concat(row.fotos || [])
      .concat(row.fotoUrls || [])
      .concat(row.photos || [])
      .filter(Boolean);

    return Number(row.nFotos || photos.length || 0);
  },

  whatsappState(row){
    const raw = String(
      row.whatsappStatus ||
      row.estado ||
      ''
    ).toLowerCase();

    if(
      raw.includes('sent') ||
      raw.includes('enviado') ||
      row.whatsappSent === true
    ){
      return 'sent';
    }

    if(
      raw.includes('pending') ||
      raw.includes('pendiente')
    ){
      return 'pending';
    }

    if(
      raw.includes('error') ||
      raw.includes('fail') ||
      raw.includes('fallo')
    ){
      return 'error';
    }

    return 'other';
  },

  normalizedMode(row){
    const raw = String(
      AdminUtils.modeText(row) ||
      row.modo ||
      row.tipo ||
      ''
    ).trim();

    const lower = raw.toLowerCase();

    if(
      lower === 'co' ||
      lower.includes('control') ||
      lower.includes('visita')
    ){
      return {
        key: 'co',
        label: raw || 'CO'
      };
    }

    if(
      lower.includes('guardia') ||
      lower.includes('nivel')
    ){
      return {
        key: 'nivel',
        label: raw || 'Nivel'
      };
    }

    if(lower.includes('nota')){
      return {
        key: 'nota',
        label: raw || 'Nota'
      };
    }

    if(lower.includes('cabezal')){
      return {
        key: 'cabezal',
        label: raw || 'Cabezal'
      };
    }

    if(
      lower.includes('estacion') ||
      lower.includes('estación')
    ){
      return {
        key: 'estacion',
        label: raw || 'Estación'
      };
    }

    return {
      key: 'otro',
      label: raw || 'Otro'
    };
  },

  matchesQuickFilter(row){
    const u = AdminUtils;
    const filter = this.quickFilter;

    if(filter === 'all'){
      return true;
    }

    if(filter === 'today'){
      return this.rowDate(row) === this.ymdToday();
    }

    if(filter === 'photos'){
      return this.photosCount(row) > 0;
    }

    if(filter === 'no-gps'){
      return !u.hasGps(row);
    }

    if(filter === 'pending'){
      return this.whatsappState(row) === 'pending';
    }

    if(filter === 'notes'){
      return this.normalizedMode(row).key === 'nota';
    }

    if(filter === 'levels'){
      return this.normalizedMode(row).key === 'nivel';
    }

    return true;
  },

  registrySearchType(value){
    const normalized = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    if(
      normalized === 'trabajo' ||
      normalized === 'trabajos' ||
      normalized === 'trabaja' ||
      normalized === 'trabajando'
    ){
      return 'trabajo';
    }

    if(
      normalized === 'drenar' ||
      normalized === 'drenado' ||
      normalized === 'barrido' ||
      normalized === 'barrer'
    ){
      return 'drenar';
    }

    if(
      normalized === 'aforo' ||
      normalized === 'aforar' ||
      normalized === 'aforado' ||
      normalized === 'proyeccion'
    ){
      return 'aforo';
    }

    if(normalized === 'intermitente'){
      return 'intermitente';
    }

    return '';
  },

  matchesRegistrySearch(row, registryType){
    const u = AdminUtils;
    const modeData = this.normalizedMode(row);

    const normalizeText = value => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    let rawRecord = '';

    try{
      rawRecord = JSON.stringify(row);
    }catch(error){
      rawRecord = [
        row?.msg,
        row?.mensaje,
        row?.observaciones,
        row?.obs,
        row?.descripcion,
        row?.texto
      ]
        .filter(Boolean)
        .join('\n');
    }

    const message = [
      row?.msg,
      row?.mensaje,
      row?.observaciones,
      row?.obs,
      row?.descripcion,
      row?.texto
    ]
      .filter(Boolean)
      .join('\n');

    const noteIdentity = normalizeText([
      modeData.key,
      u.modeText(row),
      row?.modo,
      row?.tipo,
      row?.tipoReporte,
      u.placeText(row),
      row?.pozo,
      row?.lugar,
      rawRecord.slice(0, 800)
    ]
      .filter(Boolean)
      .join(' '));

    const isNoteRow =
      modeData.key === 'nota' ||
      /(^|\s)nota($|\s)/.test(noteIdentity) ||
      /nota\s+de\s+campo/.test(noteIdentity);

    /*
     * NOTAS DE CAMPO:
     * aquí sí se permite buscar por el contenido textual.
     */
    if(isNoteRow){
      const noteText = normalizeText(message || rawRecord);

      if(registryType === 'trabajo'){
        return /\btrabaj(?:o|os|a|ar|ando|ado|ada|aron)\b/.test(
          noteText
        );
      }

      if(registryType === 'drenar'){
        return /\b(?:drenar|drenado|drenada|drenaje|barrido|barrida|barrer)\b/.test(
          noteText
        );
      }

      if(registryType === 'aforo'){
        return /\b(?:aforo|aforar|aforado|aforada|proyeccion)\b/.test(
          noteText
        );
      }

      if(registryType === 'intermitente'){
        return /\bintermitente\b/.test(noteText);
      }

      return false;
    }

    /*
     * REPORTES NORMALES Y NIVELES:
     * únicamente cuentan valores positivos de REGISTRO.
     */
    const positiveValue = value => {
      if(value === true || value === 1){
        return true;
      }

      const normalized = normalizeText(value).trim();

      return [
        'true',
        '1',
        'si',
        'yes',
        'on',
        'checked',
        'seleccionado',
        'palomeado',
        '✅',
        '☑',
        '✔'
      ].includes(normalized);
    };

    const checks =
      row?.checks ||
      row?.registro ||
      row?.checklist ||
      row?.co?.checks ||
      row?.nivel?.checks ||
      {};

    let structuredValues = [];

    if(registryType === 'trabajo'){
      structuredValues = [
        checks?.trabajo,
        checks?.trabajos,
        row?.trabajo,
        row?.registroTrabajo
      ];
    }

    if(registryType === 'drenar'){
      structuredValues = [
        checks?.drenar,
        checks?.barrido,
        checks?.drenarBarrido,
        row?.drenar,
        row?.barrido,
        row?.registroDrenar
      ];
    }

    if(registryType === 'aforo'){
      structuredValues = [
        checks?.aforo,
        checks?.proyeccion,
        checks?.aforoProyeccion,
        row?.aforo,
        row?.proyeccion,
        row?.registroAforo
      ];
    }

    if(registryType === 'intermitente'){
      structuredValues = [
        checks?.intermitente,
        row?.registroIntermitente
      ];
    }

    if(structuredValues.some(positiveValue)){
      return true;
    }

    /*
     * Compatibilidad con reportes antiguos:
     * solamente acepta líneas con palomita positiva.
     * Las líneas con ❌ no coinciden.
     */
    const positiveMarker =
      '(?:✅|☑️?|✔️?)';

    let positivePattern = null;

    if(registryType === 'trabajo'){
      positivePattern = new RegExp(
        '(?:^|\\n)\\s*' +
        positiveMarker +
        '\\s*\\*?\\s*trabajo\\b',
        'i'
      );
    }

    if(registryType === 'drenar'){
      positivePattern = new RegExp(
        '(?:^|\\n)\\s*' +
        positiveMarker +
        '\\s*\\*?\\s*(?:drenar|barrido)(?:\\s*\\/\\s*(?:drenar|barrido))?\\b',
        'i'
      );
    }

    if(registryType === 'aforo'){
      positivePattern = new RegExp(
        '(?:^|\\n)\\s*' +
        positiveMarker +
        '\\s*\\*?\\s*(?:aforo|proyecci[oó]n)(?:\\s*\\/\\s*(?:aforo|proyecci[oó]n))?\\b',
        'i'
      );
    }

    if(registryType === 'intermitente'){
      positivePattern = new RegExp(
        '(?:^|\\n)\\s*' +
        positiveMarker +
        '\\s*\\*?\\s*intermitente\\b',
        'i'
      );
    }

    return positivePattern
      ? positivePattern.test(message)
      : false;
  },

  filtered(){
    const u = AdminUtils;

    const desde =
      document.getElementById('repDesde')?.value || '';

    const hasta =
      document.getElementById('repHasta')?.value || '';

    const buscar =
      document.getElementById('repBuscar')
        ?.value
        .trim()
        .toLowerCase() || '';

    const modo =
      document.getElementById('repModo')
        ?.value
        .toLowerCase() || '';

    const source = (window.AdminFirebase.reportes || []).filter(row =>
      window.CatalogoPozos?.existe(
        AdminUtils.placeText(row)
      )
    );

    /*
     * Reconoce búsquedas exactas de pozo:
     *   376
     *   C376
     *   C 376
     *   C-376
     *   Pozo 376
     *   Pozo C-376
     */
    const wellSearchMatch = buscar.match(
      /^(?:pozo\s*)?(?:c[\s-]*)?(\d+[a-z]?)$/i
    );

    const searchedWell = wellSearchMatch
      ? wellSearchMatch[1].toLowerCase()
      : '';

    /*
     * Aplica primero los filtros comunes.
     * Estos filtros afectan tanto a reportes normales
     * como a Notas de Campo relacionadas.
     */
    const commonRows = source.filter(row => {
      const date = this.rowDate(row);
      const modeData = this.normalizedMode(row);

      if(desde && date < desde){
        return false;
      }

      if(hasta && date > hasta){
        return false;
      }

      if(modo){
        const rawMode = String(
          u.modeText(row) || ''
        ).toLowerCase();

        const modeMatches =
          rawMode === modo ||
          modeData.key === modo ||
          (
            modo === 'guardia' &&
            modeData.key === 'nivel'
          ) ||
          (
            modo === 'nivel' &&
            modeData.key === 'nivel'
          );

        if(!modeMatches){
          return false;
        }
      }

      if(!this.matchesQuickFilter(row)){
        return false;
      }

      return true;
    });

    /*
     * Sin texto de búsqueda:
     * devuelve todos los registros que cumplieron
     * fechas, modo y filtro rápido.
     */
    if(!buscar){
      return commonRows.sort(
        (a, b) => u.getTime(b) - u.getTime(a)
      );
    }

    /*
     * Búsqueda libre:
     * conserva el comportamiento general anterior.
     */
    if(!searchedWell){
      const registryType =
        this.registrySearchType(buscar);

      return commonRows
        .filter(row => {
          /*
           * Trabajo, Drenar/Barrido, Aforo/Proyección
           * e Intermitente utilizan reglas especiales.
           */
          if(registryType){
            return this.matchesRegistrySearch(
              row,
              registryType
            );
          }

          /*
           * Las demás palabras conservan la búsqueda libre.
           */
          const searchable = [
            JSON.stringify(row),
            u.personText(row),
            u.placeText(row),
            u.modeText(row),
            u.obsText(row),
            row.co?.estatus,
            row.estatus
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return searchable.includes(buscar);
        })
        .sort(
          (a, b) => u.getTime(b) - u.getTime(a)
        );
    }

    /*
     * BÚSQUEDA POR POZO
     *
     * Se separa en dos conjuntos:
     *
     * 1. Reportes cuyo Pozo/Lugar coincide exactamente.
     * 2. Notas de Campo que mencionan explícitamente
     *    C 376, C-376, C376, Pozo 376, etc.
     */

    const normalizeWell = value => String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^pozo\s*/, '')
      .replace(/^c[\s-]*/, '')
      .replace(/\s+/g, '');

    /*
     * Reportes pertenecientes directamente al pozo.
     */
    const exactWellReports = commonRows.filter(row =>
      normalizeWell(u.placeText(row)) === searchedWell
    );

    const escapedWell = searchedWell.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    /*
     * Solo acepta referencias explícitas:
     *
     *   C 356
     *   C-356
     *   C356
     *   Pozo 356
     *   Pozo C-356
     *
     * Un número aislado dentro de coordenadas GPS
     * no puede generar coincidencia.
     */
    const noteWellPattern = new RegExp(
      '(^|[^0-9a-z])' +
      '(?:' +
        'pozo\\s*(?:c\\s*[-:]?\\s*)?' +
        '|' +
        'c\\s*[-:]?\\s*' +
      ')' +
      escapedWell +
      '(?![0-9a-z])',
      'i'
    );

    /*
     * Busca el texto en el registro completo para incluir
     * notas antiguas guardadas en campos diferentes:
     * msg, mensaje, observaciones, texto, descripción, etc.
     */
    const relatedNotes = commonRows.filter(row => {
      const modeData = this.normalizedMode(row);

      let rawRecordText = '';

      try{
        rawRecordText = JSON.stringify(row);
      }catch(error){
        rawRecordText = [
          u.obsText(row),
          row.msg,
          row.mensaje,
          row.texto,
          row.descripcion
        ]
          .filter(Boolean)
          .join(' ');
      }

      const noteIdentity = [
        modeData.key,
        u.modeText(row),
        row.modo,
        row.tipo,
        row.tipoReporte,
        u.placeText(row),
        row.pozo,
        row.lugar,
        rawRecordText.slice(0, 500)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const isNoteRow =
        modeData.key === 'nota' ||
        /(^|\s)nota($|\s)/i.test(noteIdentity) ||
        /nota\s+de\s+campo/i.test(noteIdentity);

      return (
        isNoteRow &&
        noteWellPattern.test(rawRecordText)
      );
    });

    /*
     * Une ambos conjuntos.
     * Set elimina cualquier registro repetido.
     */
    return [
      ...new Set([
        ...exactWellReports,
        ...relatedNotes
      ])
    ].sort(
      (a, b) => u.getTime(b) - u.getTime(a)
    );
  },

  renderCounter(rows){
    const total = (window.AdminFirebase.reportes || []).filter(row =>
      window.CatalogoPozos?.existe(
        AdminUtils.placeText(row)
      )
    ).length;
    const countEl = document.getElementById('reportesResultado');
    const textEl = document.getElementById('reportesResultadoTexto');

    if(countEl){
      countEl.textContent = `${rows.length} de ${total}`;
    }

    if(textEl){
      textEl.textContent =
        rows.length === 1
          ? 'reporte mostrado'
          : 'reportes mostrados';
    }
  },

  modeBadge(row){
    const u = AdminUtils;
    const mode = this.normalizedMode(row);

    return `
      <span class="report-mode-badge mode-${mode.key}">
        ${u.escapeHtml(mode.label)}
      </span>
    `;
  },

  operationalStatus(row){
    /*
     * Primero usa campos estructurados de reportes nuevos.
     */
    const directStatus =
      row?.co?.estatus ||
      row?.co?.estadoPozo ||
      row?.estatus ||
      row?.estadoPozo ||
      '';

    /*
     * Normaliza únicamente estados operativos válidos.
     * No toma row.estado porque podría contener estados
     * de WhatsApp, sincronización o procesamiento.
     */
    const normalizeStatus = value => {
      const text = String(value || '').trim();

      if(/\babiert[oa]\b/i.test(text)){
        return 'Abierto';
      }

      if(/\bcerrad[oa]\b/i.test(text)){
        return 'Cerrado';
      }

      if(/\bintermitente\b/i.test(text)){
        return 'Intermitente';
      }

      return '';
    };

    const normalizedDirect = normalizeStatus(directStatus);

    if(normalizedDirect){
      return normalizedDirect;
    }

    /*
     * Reportes antiguos: el estatus puede existir únicamente
     * dentro del mensaje completo enviado a WhatsApp.
     */
    const message = [
      row?.msg,
      row?.mensaje,
      row?.observaciones,
      row?.obs,
      row?.descripcion
    ]
      .filter(Boolean)
      .join('\n');

    const statusLine = message.match(
      /(?:estatus|estado\s+del\s+pozo)\s*:\s*(abiert[oa]|cerrad[oa]|intermitente)\b/i
    );

    if(statusLine){
      return normalizeStatus(statusLine[1]);
    }

    return '';
  },

  gpsBadge(row){
    if(AdminUtils.hasGps(row)){
      return `
        <span class="report-status-badge status-ok">
          <i></i> GPS OK
        </span>
      `;
    }

    return `
      <span class="report-status-badge status-error">
        <i></i> Sin GPS
      </span>
    `;
  },

  whatsappBadge(row){
    const state = this.whatsappState(row);

    if(state === 'sent'){
      return `
        <span class="report-status-badge status-ok">
          <i></i> Enviado
        </span>
      `;
    }

    if(state === 'pending'){
      return `
        <span class="report-status-badge status-warning">
          <i></i> Pendiente
        </span>
      `;
    }

    if(state === 'error'){
      return `
        <span class="report-status-badge status-error">
          <i></i> Error
        </span>
      `;
    }

    return `
      <span class="report-status-badge status-neutral">
        <i></i> Sin estado
      </span>
    `;
  },

  render(){
    /*
     * Cada ejecución recibe una versión única.
     * Si el usuario cambia filtros mientras todavía se están
     * dibujando filas, el render anterior se cancela solo.
     */
    const version = ++this.renderVersion;
    const rows = this.filtered();

    /*
     * Conservamos todos los resultados filtrados para:
     * - exportación;
     * - navegación anterior/siguiente;
     * - comparación;
     * - inspector de reportes.
     */
    this.currentRows = rows.slice();

    const u = AdminUtils;
    const body = document.getElementById('reportesTable');
    const textEl = document.getElementById(
      'reportesResultadoTexto'
    );

    this.renderCounter(rows);

    if(!body) return;

    body.setAttribute('aria-busy', 'true');
    body.classList.add('reports-rendering');

    /*
     * Un solo listener delegado para toda la tabla.
     * Antes se creaba un listener individual para cada reporte.
     */
    body.onclick = event => {
      const loadMoreButton = event.target.closest(
        '[data-load-more-reports]'
      );

      if(loadMoreButton && body.contains(loadMoreButton)){
        this.visibleLimit += 100;
        this.render();
        return;
      }

      const button = event.target.closest('[data-report-id]');

      if(!button || !body.contains(button)){
        return;
      }

      /*
       * Evita dobles clics mientras el inspector comienza
       * a construir el detalle seleccionado.
       */
      if(button.disabled){
        return;
      }

      const item = this.currentRows.find(
        row =>
          String(row.id) ===
          String(button.dataset.reportId)
      );

      if(!item){
        return;
      }

      button.disabled = true;

      try{
        AdminUI.setReportInspectorContext(
          this.currentRows,
          item
        );

        AdminUI.setInspectorSource('report');
        AdminUI.openDetail('reporte', item);
      }finally{
        setTimeout(() => {
          button.disabled = false;
        }, 250);
      }
    };

    if(!rows.length){
      body.innerHTML = `
        <tr>
          <td colspan="10">
            <div class="reports-empty">
              <b>Sin reportes con esos filtros</b>
              <span>
                Modifica las fechas, la búsqueda, el modo o el filtro rápido.
              </span>
            </div>
          </td>
        </tr>
      `;

      body.removeAttribute('aria-busy');
      body.classList.remove('reports-rendering');
      return;
    }

    body.innerHTML = '';

    let rendered = 0;

    const targetCount = Math.min(
      rows.length,
      Math.max(100, Number(this.visibleLimit) || 100)
    );

    const chunkSize = Math.max(
      25,
      Number(this.renderChunkSize) || 100
    );

    const renderRow = row => {
      const photos = this.photosCount(row);
      const observation = u.cut(
        u.obsText(row),
        85
      );

      const estatus =
        this.operationalStatus(row);

      return `
        <tr class="report-row">
          <td class="report-date-cell">
            <b>${u.escapeHtml(u.fmtDate(row))}</b>
          </td>

          <td class="report-time-cell">
            ${u.escapeHtml(u.fmtTime(row))}
          </td>

          <td>
            <div class="report-person-cell">
              <b>
                ${u.escapeHtml(
                  u.personText(row) ||
                  'Sin recorredor'
                )}
              </b>

              ${
                photos > 0
                  ? `<small>${photos} foto${photos === 1 ? '' : 's'}</small>`
                  : ''
              }
            </div>
          </td>

          <td>${this.modeBadge(row)}</td>

          <td>
            <b class="report-place">
              ${u.escapeHtml(
                u.placeText(row) ||
                'Sin pozo/lugar'
              )}
            </b>
          </td>

          <td>
            ${
              estatus
                ? `<span class="report-estatus">${u.escapeHtml(estatus)}</span>`
                : '<span class="report-empty-value">—</span>'
            }
          </td>

          <td>${this.whatsappBadge(row)}</td>

          <td>${this.gpsBadge(row)}</td>

          <td class="report-observation">
            ${
              observation
                ? u.escapeHtml(observation)
                : '<span class="report-empty-value">Sin observaciones</span>'
            }
          </td>

          <td class="report-action-cell">
            <button
              type="button"
              class="row-action report-view-btn"
              data-report-id="${u.escapeHtml(row.id)}"
            >
              Ver
            </button>
          </td>
        </tr>
      `;
    };

    const renderNextChunk = () => {
      /*
       * Un filtro nuevo inició otro render.
       * Se cancela inmediatamente este trabajo antiguo.
       */
      if(version !== this.renderVersion){
        return;
      }

      const end = Math.min(
        rendered + chunkSize,
        targetCount
      );

      const html = rows
        .slice(rendered, end)
        .map(renderRow)
        .join('');

      body.insertAdjacentHTML(
        'beforeend',
        html
      );

      rendered = end;

      if(textEl && rendered < targetCount){
        textEl.textContent =
          `cargando ${rendered.toLocaleString('es-MX')} ` +
          `de ${targetCount.toLocaleString('es-MX')}`;
      }

      if(rendered < targetCount){
        /*
         * Cede el control al navegador entre cada bloque.
         * Permite pintar la pantalla, hacer scroll y responder.
         */
        requestAnimationFrame(renderNextChunk);
        return;
      }

      body.removeAttribute('aria-busy');
      body.classList.remove('reports-rendering');

      const countEl = document.getElementById(
        'reportesResultado'
      );

      if(countEl){
        countEl.textContent =
          `${targetCount.toLocaleString('es-MX')} ` +
          `de ${rows.length.toLocaleString('es-MX')}`;
      }

      if(textEl){
        textEl.textContent =
          targetCount === 1
            ? 'reporte mostrado'
            : 'reportes mostrados';
      }

      if(targetCount < rows.length){
        const remaining = rows.length - targetCount;
        const nextAmount = Math.min(100, remaining);

        body.insertAdjacentHTML(
          'beforeend',
          `
            <tr class="reports-load-more-row">
              <td colspan="10">
                <button
                  type="button"
                  class="row-action reports-load-more-btn"
                  data-load-more-reports
                >
                  Cargar ${nextAmount} reportes más
                </button>

                <small>
                  Mostrando ${targetCount.toLocaleString('es-MX')}
                  de ${rows.length.toLocaleString('es-MX')}
                </small>
              </td>
            </tr>
          `
        );
      }
    };

    requestAnimationFrame(renderNextChunk);
  }
};

window.AdminReportes = {
  quickFilter: 'all',
  currentRows: [],

  init(){
    ['repDesde','repHasta','repBuscar','repModo'].forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;

      el.addEventListener('input', () => this.render());
      el.addEventListener('change', () => this.render());
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

    const source = window.AdminFirebase.reportes || [];

    return source
      .filter(row => {
        const date = this.rowDate(row);
        const modeData = this.normalizedMode(row);

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

        if(desde && date < desde) return false;
        if(hasta && date > hasta) return false;

        if(modo){
          const rawMode = String(u.modeText(row) || '').toLowerCase();

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

          if(!modeMatches) return false;
        }

        if(buscar && !searchable.includes(buscar)){
          return false;
        }

        if(!this.matchesQuickFilter(row)){
          return false;
        }

        return true;
      })
      .sort((a, b) => u.getTime(b) - u.getTime(a));
  },

  renderCounter(rows){
    const total = (window.AdminFirebase.reportes || []).length;
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
    const rows = this.filtered();
    this.currentRows = rows.slice();

    const u = AdminUtils;
    const body = document.getElementById('reportesTable');

    this.renderCounter(rows);

    if(!body) return;

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
      return;
    }

    body.innerHTML = rows.map(row => {
      const photos = this.photosCount(row);
      const observation = u.cut(u.obsText(row), 85);
      const estatus = row.co?.estatus || row.estatus || '';

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
              <b>${u.escapeHtml(u.personText(row) || 'Sin recorredor')}</b>
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
              ${u.escapeHtml(u.placeText(row) || 'Sin pozo/lugar')}
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
    }).join('');

    body.querySelectorAll('[data-report-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = rows.find(
          row => String(row.id) === String(btn.dataset.reportId)
        );

        if(item){
          AdminUI.setReportInspectorContext(
            this.currentRows,
            item
          );

          AdminUI.setInspectorSource('report');
          AdminUI.openDetail('reporte', item);
        }
      });
    });
  }
};

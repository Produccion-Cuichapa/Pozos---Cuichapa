window.AdminPozos = {
  viewMode: 'cards',
  rows: [],

  init(){
    document.getElementById('wellSearch')
      ?.addEventListener('input', () => this.render());

    document.getElementById('wellStatusFilter')
      ?.addEventListener('change', () => this.render());

    document.getElementById('wellSapFilter')
      ?.addEventListener('change', () => this.render());

    document.getElementById('wellClearFilters')
      ?.addEventListener('click', () => {
        const search = document.getElementById('wellSearch');
        const status = document.getElementById('wellStatusFilter');
        const sap = document.getElementById('wellSapFilter');

        if(search) search.value = '';
        if(status) status.value = 'all';
        if(sap) sap.value = 'all';

        this.render();
      });

    document.querySelectorAll('[data-well-view]')
      .forEach(button => {
        button.addEventListener('click', () => {
          this.viewMode =
            button.dataset.wellView || 'cards';

          document.querySelectorAll('[data-well-view]')
            .forEach(item => {
              item.classList.toggle(
                'active',
                item.dataset.wellView === this.viewMode
              );
            });

          this.applyViewMode();
        });
      });
  },

  normalizeWell(value){
    const raw = String(value || '')
      .trim()
      .toUpperCase()
      .replace(/^POZO\s+/i, '')
      .replace(/^C[-\s]*/i, '')
      .replace(/\s+/g, '');

    const match = raw.match(/^(\d+[A-Z]?)$/i);

    return match
      ? match[1].toUpperCase()
      : '';
  },

  wellSort(a, b){
    const parse = value => {
      const match = String(value).match(/^(\d+)([A-Z]*)$/i);

      return {
        number: match ? Number(match[1]) : 999999,
        suffix: match ? match[2] : String(value)
      };
    };

    const aa = parse(a);
    const bb = parse(b);

    if(aa.number !== bb.number){
      return aa.number - bb.number;
    }

    return aa.suffix.localeCompare(bb.suffix);
  },

  catalog(){
    const set = new Set();

    if(Array.isArray(window.WELLS_ALL)){
      window.WELLS_ALL.forEach(well => {
        const key = this.normalizeWell(well);
        if(key) set.add(key);
      });
    }

    (window.AdminFirebase.reportes || [])
      .forEach(report => {
        const key = this.normalizeWell(
          AdminUtils.placeText(report)
        );

        if(key) set.add(key);
      });

    return Array.from(set)
      .sort((a, b) => this.wellSort(a, b));
  },

  reportWell(report){
    return this.normalizeWell(
      AdminUtils.placeText(report)
    );
  },

  alarmWell(alarm){
    return this.normalizeWell(
      AdminUtils.placeText(alarm)
    );
  },

  todayKey(){
    const now = new Date();

    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
  },

  rowDate(row){
    const date = AdminUtils.dateObj(row);

    return date && !isNaN(date)
      ? AdminUtils.ymd(date)
      : String(row.fecha || '').slice(0, 10);
  },

  parsedData(report){
    return AdminUtils.parseMsg
      ? AdminUtils.parseMsg(report)
      : {};
  },

  field(report, name){
    if(!report) return '';

    const parsed = this.parsedData(report);
    const co = report.co || {};

    const aliases = {
      estatus: [
        co.estatus,
        report.estatus,
        report.estadoPozo,
        parsed.estatus
      ],

      sap: [
        co.sap,
        report.sap,
        parsed.sap
      ],

      fluye: [
        co.fluye,
        report.fluye,
        parsed.fluye
      ]
    };

    const values = aliases[name] || [];

    for(const value of values){
      if(
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
      ){
        return String(value).trim();
      }
    }

    return '';
  },

  latestReport(reports){
    return reports.reduce((latest, row) => {
      if(!latest) return row;

      return AdminUtils.getTime(row) >
        AdminUtils.getTime(latest)
          ? row
          : latest;
    }, null);
  },

  operationalStatus(latest, visitedToday){
    if(!latest){
      return {
        key: 'unknown',
        label: 'Sin información',
        attention: true
      };
    }

    const raw = this.field(latest, 'estatus')
      .toLowerCase();

    if(
      raw.includes('cerrado') ||
      raw.includes('fuera') ||
      raw.includes('paro')
    ){
      return {
        key: 'closed',
        label: this.field(latest, 'estatus') || 'Cerrado',
        attention: true
      };
    }

    if(raw.includes('intermitente')){
      return {
        key: 'intermittent',
        label: 'Intermitente',
        attention: true
      };
    }

    const ageMs =
      Date.now() - AdminUtils.getTime(latest);

    if(!visitedToday || ageMs > 12 * 60 * 60 * 1000){
      return {
        key: 'pending',
        label: 'Sin visita hoy',
        attention: true
      };
    }

    if(ageMs > 4 * 60 * 60 * 1000){
      return {
        key: 'warning',
        label: 'Seguimiento',
        attention: true
      };
    }

    return {
      key: 'operating',
      label: this.field(latest, 'estatus') || 'Operando',
      attention: false
    };
  },

  coordinates(well, latest){
    const master =
      window.WELL_COORDS_ALL?.[well] || null;

    if(master?.lat && (master.lon || master.lng)){
      return {
        lat: Number(master.lat),
        lon: Number(master.lon || master.lng)
      };
    }

    const gps =
      latest?.gps ||
      latest?.ubicacion ||
      latest?.location ||
      latest?.coords ||
      {};

    const lat =
      gps.lat ||
      gps.latitude ||
      gps.latitud ||
      latest?.lat ||
      latest?.latitude ||
      latest?.latitud;

    const lon =
      gps.lon ||
      gps.lng ||
      gps.longitude ||
      gps.longitud ||
      latest?.lon ||
      latest?.lng ||
      latest?.longitude ||
      latest?.longitud;

    return lat && lon
      ? {
          lat: Number(lat),
          lon: Number(lon)
        }
      : null;
  },

  buildRows(){
    const reports = window.AdminFirebase.reportes || [];
    const alarms = window.AdminFirebase.alarmas || [];
    const today = this.todayKey();

    return this.catalog().map(well => {
      const wellReports = reports
        .filter(report =>
          this.reportWell(report) === well
        )
        .sort(
          (a, b) =>
            AdminUtils.getTime(b) -
            AdminUtils.getTime(a)
        );

      const wellAlarms = alarms
        .filter(alarm =>
          this.alarmWell(alarm) === well
        );

      const latest = this.latestReport(wellReports);

      const visitedToday = wellReports.some(report =>
        this.rowDate(report) === today
      );

      const status = this.operationalStatus(
        latest,
        visitedToday
      );

      return {
        well,
        latest,
        reports: wellReports,
        alarms: wellAlarms,
        visitedToday,
        status,
        estatus: this.field(latest, 'estatus'),
        sap: this.field(latest, 'sap'),
        fluye: this.field(latest, 'fluye'),
        person: latest
          ? AdminUtils.personText(latest)
          : '',
        gps: latest
          ? AdminUtils.hasGps(latest)
          : false,
        coords: this.coordinates(well, latest),
        lastTime: latest
          ? AdminUtils.getTime(latest)
          : 0
      };
    });
  },

  filteredRows(){
    const search = String(
      document.getElementById('wellSearch')?.value || ''
    )
      .trim()
      .toLowerCase();

    const statusFilter =
      document.getElementById('wellStatusFilter')
        ?.value || 'all';

    const sapFilter =
      document.getElementById('wellSapFilter')
        ?.value || 'all';

    return this.rows.filter(row => {
      if(search){
        const haystack = [
          row.well,
          row.person,
          row.estatus,
          row.sap,
          row.fluye
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if(!haystack.includes(search)){
          return false;
        }
      }

      if(statusFilter === 'visited' && !row.visitedToday){
        return false;
      }

      if(statusFilter === 'pending' && row.visitedToday){
        return false;
      }

      if(
        statusFilter === 'operating' &&
        row.status.key !== 'operating'
      ){
        return false;
      }

      if(
        statusFilter === 'intermittent' &&
        row.status.key !== 'intermittent'
      ){
        return false;
      }

      if(
        statusFilter === 'closed' &&
        row.status.key !== 'closed'
      ){
        return false;
      }

      if(
        statusFilter === 'attention' &&
        !row.status.attention
      ){
        return false;
      }

      if(statusFilter === 'gps' && !row.gps){
        return false;
      }

      if(statusFilter === 'no-gps' && row.gps){
        return false;
      }

      if(
        sapFilter !== 'all' &&
        sapFilter !== 'none' &&
        String(row.sap).toUpperCase() !== sapFilter
      ){
        return false;
      }

      if(sapFilter === 'none' && row.sap){
        return false;
      }

      return true;
    });
  },

  formatAge(timestamp){
    if(!timestamp){
      return 'Sin visita registrada';
    }

    const minutes = Math.max(
      0,
      Math.floor((Date.now() - timestamp) / 60000)
    );

    if(minutes < 1) return 'Ahora mismo';
    if(minutes === 1) return 'Hace 1 min';
    if(minutes < 60) return `Hace ${minutes} min`;

    const hours = Math.floor(minutes / 60);

    if(hours < 24){
      return hours === 1
        ? 'Hace 1 hora'
        : `Hace ${hours} horas`;
    }

    const days = Math.floor(hours / 24);

    return days === 1
      ? 'Hace 1 día'
      : `Hace ${days} días`;
  },

  renderKpis(){
    const total = this.rows.length;

    const visited = this.rows
      .filter(row => row.visitedToday)
      .length;

    const operating = this.rows
      .filter(row => row.status.key === 'operating')
      .length;

    const intermittent = this.rows
      .filter(row => row.status.key === 'intermittent')
      .length;

    const closed = this.rows
      .filter(row => row.status.key === 'closed')
      .length;

    const pending = Math.max(0, total - visited);

    const pct = total
      ? Math.round((visited / total) * 100)
      : 0;

    this.setText('wellKpiTotal', total);
    this.setText('wellKpiVisited', visited);
    this.setText('wellKpiVisitedPct', `${pct}% del campo`);
    this.setText('wellKpiOperating', operating);
    this.setText('wellKpiIntermittent', intermittent);
    this.setText('wellKpiClosed', closed);
    this.setText('wellKpiPending', pending);
  },

  setText(id, value){
    const element = document.getElementById(id);

    if(element){
      element.textContent = value;
    }
  },

  statusBadge(row){
    return `
      <span class="well-status-badge well-status-${row.status.key}">
        <i></i>
        ${AdminUtils.escapeHtml(row.status.label)}
      </span>
    `;
  },

  renderCards(rows){
    const container =
      document.getElementById('wellsCardsView');

    if(!container) return;

    if(!rows.length){
      container.innerHTML = `
        <div class="wells-empty">
          <b>No se encontraron pozos</b>
          <span>Modifica los filtros de búsqueda.</span>
        </div>
      `;

      return;
    }

    container.innerHTML = rows.map(row => `
      <article class="well-card well-card-${row.status.key}">
        <header class="well-card-header">
          <div>
            <span>POZO</span>
            <h3>${AdminUtils.escapeHtml(row.well)}</h3>
          </div>

          ${this.statusBadge(row)}
        </header>

        <div class="well-card-data">
          <div>
            <span>SAP</span>
            <b>${AdminUtils.escapeHtml(row.sap || '—')}</b>
          </div>

          <div>
            <span>Fluye</span>
            <b>${AdminUtils.escapeHtml(row.fluye || '—')}</b>
          </div>

          <div>
            <span>GPS</span>
            <b class="${row.gps ? 'well-data-ok' : 'well-data-danger'}">
              ${row.gps ? 'Disponible' : 'Sin GPS'}
            </b>
          </div>

          <div>
            <span>Alarmas</span>
            <b class="${row.alarms.length ? 'well-data-danger' : ''}">
              ${row.alarms.length}
            </b>
          </div>
        </div>

        <div class="well-card-latest">
          <span>Última visita</span>

          <b>
            ${
              row.latest
                ? `${AdminUtils.escapeHtml(
                    AdminUtils.fmtDate(row.latest)
                  )} · ${AdminUtils.escapeHtml(
                    AdminUtils.fmtTime(row.latest)
                  )}`
                : 'Sin visita registrada'
            }
          </b>

          <small>
            ${AdminUtils.escapeHtml(
              this.formatAge(row.lastTime)
            )}
            ${
              row.person
                ? ` · ${AdminUtils.escapeHtml(row.person)}`
                : ''
            }
          </small>
        </div>

        <footer class="well-card-footer">
          <span>
            ${row.reports.length}
            ${row.reports.length === 1 ? 'reporte' : 'reportes'}
          </span>

          <div>
            ${
              row.coords
                ? `<a
                     class="well-map-btn"
                     href="https://www.google.com/maps?q=${row.coords.lat},${row.coords.lon}"
                     target="_blank"
                     rel="noopener">
                     Mapa
                   </a>`
                : ''
            }

            <button
              type="button"
              class="well-open-btn"
              data-well-open="${AdminUtils.escapeHtml(row.well)}"
              ${row.latest ? '' : 'disabled'}>
              Abrir
            </button>
          </div>
        </footer>
      </article>
    `).join('');

    this.bindOpenButtons(container);
  },

  renderTable(rows){
    const body =
      document.getElementById('wellsTableBody');

    if(!body) return;

    if(!rows.length){
      body.innerHTML = `
        <tr>
          <td colspan="10">
            <div class="wells-empty">
              <b>No se encontraron pozos</b>
              <span>Modifica los filtros de búsqueda.</span>
            </div>
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML = rows.map(row => `
      <tr>
        <td>
          <b class="well-table-name">
            ${AdminUtils.escapeHtml(row.well)}
          </b>
        </td>

        <td>${this.statusBadge(row)}</td>

        <td>${AdminUtils.escapeHtml(row.sap || '—')}</td>

        <td>${AdminUtils.escapeHtml(row.fluye || '—')}</td>

        <td>
          ${
            row.latest
              ? `
                <b>${AdminUtils.escapeHtml(
                  AdminUtils.fmtDate(row.latest)
                )}</b>
                <small>${AdminUtils.escapeHtml(
                  AdminUtils.fmtTime(row.latest)
                )}</small>
              `
              : '<span class="well-no-data">Sin visita</span>'
          }
        </td>

        <td>
          ${AdminUtils.escapeHtml(row.person || '—')}
        </td>

        <td>
          <span class="well-gps-pill ${row.gps ? 'ok' : 'error'}">
            ${row.gps ? 'GPS OK' : 'Sin GPS'}
          </span>
        </td>

        <td>${row.reports.length}</td>

        <td>
          <span class="${row.alarms.length ? 'well-alarm-count' : ''}">
            ${row.alarms.length}
          </span>
        </td>

        <td>
          <button
            type="button"
            class="well-open-btn"
            data-well-open="${AdminUtils.escapeHtml(row.well)}"
            ${row.latest ? '' : 'disabled'}>
            Ver
          </button>
        </td>
      </tr>
    `).join('');

    this.bindOpenButtons(body);
  },

  bindOpenButtons(container){
    container.querySelectorAll('[data-well-open]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const well = button.dataset.wellOpen;

          const row = this.rows.find(item =>
            String(item.well) === String(well)
          );

          if(!row?.latest) return;

          AdminUI.setReportInspectorContext(
            row.reports,
            row.latest
          );

          AdminUI.activeInspectorTab = 'summary';
          AdminUI.openDetail('reporte', row.latest);
        });
      });
  },

  applyViewMode(){
    const cards =
      document.getElementById('wellsCardsView');

    const table =
      document.getElementById('wellsTableView');

    cards?.classList.toggle(
      'hidden',
      this.viewMode !== 'cards'
    );

    table?.classList.toggle(
      'hidden',
      this.viewMode !== 'table'
    );
  },

  render(){
    this.rows = this.buildRows();

    const filtered = this.filteredRows();

    this.renderKpis();

    this.setText(
      'wellResultCount',
      `${filtered.length} ${filtered.length === 1 ? 'pozo' : 'pozos'}`
    );

    this.renderCards(filtered);
    this.renderTable(filtered);
    this.applyViewMode();
  }
};

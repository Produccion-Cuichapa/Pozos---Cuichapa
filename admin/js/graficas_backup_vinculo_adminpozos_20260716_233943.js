window.AdminGraficas = {
  initialized: false,
  selectedWell: '',
  weekOffset: 0,
  currentFilter: 'all',
  searchText: '',

  init(){
    if(this.initialized) return;

    this.initialized = true;
    this.currentFilter = 'all';

    const filter =
      document.getElementById('chartsWellFilter');

    if(filter){
      filter.value = 'all';

      filter.addEventListener('change', event => {
        this.currentFilter =
          String(event.target.value || 'all');

        this.renderWellList();
      });
    }

    const search =
      document.getElementById('chartsWellSearch');

    search?.addEventListener('input', event => {
      this.searchText = String(
        event.target.value || ''
      )
        .trim()
        .toUpperCase();

      /*
       * La búsqueda escrita siempre tiene prioridad sobre
       * el filtro de visitados hoy, presión o Frac Tank.
       */
      this.renderWellList();

      const exact = this.allWellRows()
        .find(row =>
          row.well === this.searchText
        );

      if(exact){
        this.selectedWell = exact.well;
        this.weekOffset = 0;
        this.renderWellList();
        this.renderAnalysis();
      }
    });

    document.getElementById('chartsClearSelection')
      ?.addEventListener('click', () => {
        this.selectedWell = '';
        this.weekOffset = 0;
        this.currentFilter = 'all';
        this.searchText = '';

        if(search){
          search.value = '';
        }

        if(filter){
          filter.value = 'all';
        }

        this.render();
      });

    document.getElementById('chartsWeekButtons')
      ?.addEventListener('click', event => {
        const button =
          event.target.closest('[data-charts-week]');

        if(!button) return;

        this.weekOffset = Number(
          button.dataset.chartsWeek || 0
        );

        this.renderAnalysis();
      });

    document.getElementById('chartsOpenWell')
      ?.addEventListener('click', () => {
        this.openSelectedWell();
      });
  },

  rawReports(){
    const rows =
      window.AdminFirebase?.reportes;

    return Array.isArray(rows)
      ? rows
      : [];
  },

  message(report){
    return String(
      report?.msg ||
      report?.mensaje ||
      report?.message ||
      report?.texto ||
      report?.observaciones ||
      ''
    );
  },

  normalizeWell(value){
    const raw = String(value || '')
      .trim()
      .toUpperCase();

    if(!raw) return '';

    if(
      raw === 'NOTA' ||
      raw.includes('ESTACION') ||
      raw.includes('ESTACIÓN') ||
      raw.includes('CABEZAL')
    ){
      return '';
    }

    /*
     * Acepta:
     * 106D
     * C-106D
     * Pozo 106D
     * C 106D
     */
    const match = raw.match(
      /(?:POZO\s*:?\s*)?(?:C[-\s]*)?(\d+[A-Z]?)\b/i
    );

    return match
      ? match[1].toUpperCase()
      : '';
  },

  wellFromReport(report){
    if(!report) return '';

    const structured = [
      report.pozo,
      report.pozoId,
      report.numeroPozo,
      report.numero,
      report.well,
      report.wellId,
      report.lugar,
      report.location,
      report.nombrePozo,
      report.co?.pozo,
      report.operacion?.pozo,
      report.data?.pozo
    ];

    for(const value of structured){
      const well =
        this.normalizeWell(value);

      if(well){
        return well;
      }
    }

    if(window.AdminUtils?.placeText){
      const well = this.normalizeWell(
        AdminUtils.placeText(report)
      );

      if(well){
        return well;
      }
    }

    const message =
      this.message(report);

    const messageMatch = message.match(
      /(?:POZO|C)\s*:?\s*\*?C?[-\s]*(\d+[A-Z]?)\*?/i
    );

    return messageMatch
      ? messageMatch[1].toUpperCase()
      : '';
  },

  reportTime(report){
    const utilityTime =
      Number(AdminUtils?.getTime?.(report) || 0);

    if(utilityTime){
      return utilityTime;
    }

    const candidates = [
      report.timestamp,
      report.createdAt,
      report.fechaHora,
      report.date,
      report.fecha
    ];

    for(const candidate of candidates){
      if(candidate === null || candidate === undefined){
        continue;
      }

      const numeric = Number(candidate);

      if(
        Number.isFinite(numeric) &&
        numeric > 1000000000
      ){
        return numeric < 100000000000
          ? numeric * 1000
          : numeric;
      }

      const parsed =
        new Date(candidate).getTime();

      if(!Number.isNaN(parsed)){
        return parsed;
      }
    }

    return 0;
  },

  reports(){
    return this.rawReports()
      .map(report => ({
        ...report,
        _chartsWell:
          this.wellFromReport(report),

        _chartsTime:
          this.reportTime(report)
      }))
      .filter(report =>
        report._chartsWell &&
        report._chartsTime
      )
      .sort(
        (a, b) =>
          a._chartsTime -
          b._chartsTime
      );
  },

  reportsByWell(){
    const result = {};

    this.reports().forEach(report => {
      const well =
        report._chartsWell;

      if(!result[well]){
        result[well] = [];
      }

      result[well].push(report);
    });

    return result;
  },

  numericValue(value){
    if(
      value === null ||
      value === undefined ||
      value === ''
    ){
      return null;
    }

    const match = String(value)
      .trim()
      .replace(/,/g, '.')
      .match(/[-+]?\d+(?:\.\d+)?/);

    if(!match){
      return null;
    }

    const number = Number(match[0]);

    return Number.isFinite(number)
      ? number
      : null;
  },

  parsedReport(report){
    try{
      return AdminUtils?.parseMsg
        ? AdminUtils.parseMsg(report) || {}
        : {};
    }catch(error){
      return {};
    }
  },

  valueFromMessage(report, expressions){
    const message =
      this.message(report);

    for(const expression of expressions){
      const match =
        message.match(expression);

      if(!match) continue;

      const value =
        this.numericValue(match[1]);

      if(value !== null){
        return value;
      }
    }

    return null;
  },

  fieldValue(report, field){
    const co =
      report.co || {};

    const nivel =
      report.nivel || {};

    const parsed =
      this.parsedReport(report);

    const candidates = {
      ptp: [
        co.ptp,
        report.ptp,
        report.PTP,
        parsed.ptp
      ],

      ptr: [
        co.ptr,
        report.ptr,
        report.PTR,
        parsed.ptr
      ],

      ldd: [
        co.ldd,
        report.ldd,
        report.LDD,
        parsed.ldd
      ],

      lbn: [
        co.lbn,
        report.lbn,
        report.LBN,
        parsed.lbn
      ],

      ctm: [
        nivel.ctm,
        nivel.nivel,
        report.ctm,
        report.CTM,
        report.nivelCtm,
        report.nivelCM,
        co.ctm,
        parsed.ctm
      ]
    };

    for(const candidate of candidates[field] || []){
      const value =
        this.numericValue(candidate);

      if(value !== null){
        return value;
      }
    }

    const expressions = {
      ptp: [
        /\bPTP\s*:\s*([-+]?\d+(?:[.,]\d+)?)/i
      ],

      ptr: [
        /\bPTR\s*:\s*([-+]?\d+(?:[.,]\d+)?)/i
      ],

      ldd: [
        /\bLDD\s*:\s*([-+]?\d+(?:[.,]\d+)?)/i
      ],

      lbn: [
        /\bLBN\s*:\s*([-+]?\d+(?:[.,]\d+)?)/i
      ],

      ctm: [
        /\bCTM\s*:\s*([-+]?\d+(?:[.,]\d+)?)/i,
        /CENT[IÍ]METROS?\s*:\s*([-+]?\d+(?:[.,]\d+)?)/i
      ]
    };

    return this.valueFromMessage(
      report,
      expressions[field] || []
    );
  },

  isFracTankMeasurement(report){
    const ctm =
      this.fieldValue(report, 'ctm');

    if(ctm === null){
      return false;
    }

    const message =
      this.message(report);

    if(
      /NIVELES?\s+DE\s+GUARDIA/i.test(message)
    ){
      return true;
    }

    const parsed =
      this.parsedReport(report);

    const fluye = String(
      report.co?.fluye ||
      report.fluye ||
      parsed.fluye ||
      ''
    )
      .trim()
      .toUpperCase();

    const isFt =
      fluye === 'FT' ||
      /FLUYE\s*:\s*FT\b/i.test(message);

    const hasLevelBlock =
      /NIVEL\s+(?:DE\s+)?FRAC\s*TANK/i
        .test(message);

    return (
      isFt &&
      hasLevelBlock
    );
  },

  hasPressure(report){
    return [
      'ptp',
      'ptr',
      'ldd',
      'lbn'
    ].some(field =>
      this.fieldValue(report, field) !== null
    );
  },

  isToday(report){
    const timestamp =
      report._chartsTime ||
      this.reportTime(report);

    if(!timestamp){
      return false;
    }

    const reportDate =
      new Date(timestamp);

    const today =
      new Date();

    return (
      reportDate.getFullYear() === today.getFullYear() &&
      reportDate.getMonth() === today.getMonth() &&
      reportDate.getDate() === today.getDate()
    );
  },

  allWellRows(){
    const grouped =
      this.reportsByWell();

    return Object.entries(grouped)
      .map(([well, reports]) => ({
        well,
        reports,
        latest:
          reports[reports.length - 1],

        visitedToday:
          reports.some(report =>
            this.isToday(report)
          ),

        hasPressure:
          reports.some(report =>
            this.hasPressure(report)
          ),

        hasFracTank:
          reports.some(report =>
            this.isFracTankMeasurement(report)
          )
      }))
      .sort((a, b) =>
        a.well.localeCompare(
          b.well,
          'es',
          {numeric:true}
        )
      );
  },

  wellRows(){
    return this.allWellRows()
      .filter(row => {
        if(this.searchText){
          return row.well.includes(
            this.searchText
          );
        }

        if(this.currentFilter === 'today'){
          return row.visitedToday;
        }

        if(this.currentFilter === 'pressure'){
          return row.hasPressure;
        }

        if(this.currentFilter === 'ft'){
          return row.hasFracTank;
        }

        return true;
      });
  },

  renderWellList(){
    const container =
      document.getElementById('chartsWellList');

    const count =
      document.getElementById('chartsWellCount');

    if(!container) return;

    const allRows =
      this.allWellRows();

    const rows =
      this.wellRows();

    if(count){
      count.textContent = rows.length;
    }

    if(!rows.length){
      const rawCount =
        this.rawReports().length;

      const validCount =
        this.reports().length;

      container.innerHTML = `
        <div class="charts-well-empty">
          <b>Sin coincidencias</b>

          <span>
            ${
              rawCount === 0
                ? 'Firebase todavía no ha entregado reportes al módulo.'
                : this.searchText
                  ? `No se encontró el pozo ${AdminUtils.escapeHtml(this.searchText)}.`
                  : 'No existen pozos para el filtro seleccionado.'
            }
          </span>

          <small>
            Reportes cargados: ${rawCount}<br>
            Reportes con pozo y fecha: ${validCount}<br>
            Pozos detectados: ${allRows.length}
          </small>
        </div>
      `;

      return;
    }

    container.innerHTML = rows.map(row => `
      <button
        type="button"
        class="
          charts-well-item
          ${
            row.well === this.selectedWell
              ? 'active'
              : ''
          }
        "
        data-chart-well="${AdminUtils.escapeHtml(row.well)}">

        <div>
          <b>Pozo ${AdminUtils.escapeHtml(row.well)}</b>

          <span>
            ${row.reports.length}
            ${
              row.reports.length === 1
                ? 'reporte'
                : 'reportes'
            }
          </span>
        </div>

        <div class="charts-well-flags">
          ${
            row.visitedToday
              ? '<span class="today">Hoy</span>'
              : ''
          }

          ${
            row.hasPressure
              ? '<span>Presión</span>'
              : ''
          }

          ${
            row.hasFracTank
              ? '<span class="ft">FT</span>'
              : ''
          }
        </div>
      </button>
    `).join('');

    container
      .querySelectorAll('[data-chart-well]')
      .forEach(button => {
        button.addEventListener('click', () => {
          this.selectedWell =
            button.dataset.chartWell || '';

          this.weekOffset = 0;

          this.renderWellList();
          this.renderAnalysis();
        });
      });
  },

  weekRange(offset=0){
    const now =
      new Date();

    const day =
      now.getDay();

    const fromMonday =
      day === 0
        ? 6
        : day - 1;

    const start =
      new Date(now);

    start.setDate(
      now.getDate() -
      fromMonday -
      Number(offset || 0) * 7
    );

    start.setHours(0, 0, 0, 0);

    const end =
      new Date(start);

    end.setDate(
      start.getDate() + 7
    );

    end.setHours(0, 0, 0, 0);

    return {
      start: start.getTime(),
      end: end.getTime(),
      startDate: start,
      endDate:
        new Date(end.getTime() - 1)
    };
  },

  weekLabel(offset=0){
    const range =
      this.weekRange(offset);

    const format = date =>
      date.toLocaleDateString(
        'es-MX',
        {
          day:'2-digit',
          month:'short',
          year:'numeric'
        }
      );

    return (
      format(range.startDate) +
      ' – ' +
      format(range.endDate)
    );
  },

  selectedReports(){
    return (
      this.reportsByWell()[
        this.selectedWell
      ] || []
    );
  },

  points(field){
    const range =
      this.weekRange(this.weekOffset);

    return this.selectedReports()
      .filter(report => {
        const timestamp =
          report._chartsTime;

        if(
          !timestamp ||
          timestamp < range.start ||
          timestamp >= range.end
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
        time:
          report._chartsTime,

        value:
          this.fieldValue(report, field)
      }))
      .filter(point =>
        point.value !== null
      )
      .sort(
        (a, b) =>
          a.time - b.time
      );
  },

  stats(points){
    if(!points.length){
      return null;
    }

    const values =
      points.map(point =>
        point.value
      );

    return {
      last:
        values[values.length - 1],

      min:
        Math.min(...values),

      max:
        Math.max(...values),

      average:
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / values.length
    };
  },

  number(value){
    if(!Number.isFinite(value)){
      return '—';
    }

    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(1);
  },

  svg(points, label, unit){
    if(!points.length){
      return `
        <div class="charts-no-data">
          Sin mediciones de
          ${AdminUtils.escapeHtml(label)}
          en esta semana.
        </div>
      `;
    }

    const width = 720;
    const height = 220;

    const padding = {
      left:48,
      right:20,
      top:20,
      bottom:34
    };

    const values =
      points.map(point =>
        point.value
      );

    let min =
      Math.min(...values);

    let max =
      Math.max(...values);

    if(min === max){
      min -= 1;
      max += 1;
    }

    const chartWidth =
      width -
      padding.left -
      padding.right;

    const chartHeight =
      height -
      padding.top -
      padding.bottom;

    const range =
      this.weekRange(this.weekOffset);

    const coordinates =
      points.map(point => {
        const x =
          padding.left +
          (
            (point.time - range.start) /
            (range.end - range.start)
          ) * chartWidth;

        const y =
          padding.top +
          (
            1 -
            (
              point.value - min
            ) /
            (
              max - min
            )
          ) * chartHeight;

        return {
          ...point,
          x,
          y
        };
      });

    const polyline =
      coordinates
        .map(point =>
          `${point.x.toFixed(1)},${point.y.toFixed(1)}`
        )
        .join(' ');

    const grid =
      [0, .25, .5, .75, 1]
        .map(position => {
          const y =
            padding.top +
            position * chartHeight;

          const value =
            max -
            position * (max - min);

          return `
            <line
              x1="${padding.left}"
              y1="${y}"
              x2="${width - padding.right}"
              y2="${y}"
              class="charts-grid-line">
            </line>

            <text
              x="${padding.left - 8}"
              y="${y + 3}"
              text-anchor="end"
              class="charts-axis-text">
              ${this.number(value)}
            </text>
          `;
        })
        .join('');

    const circles =
      coordinates
        .map(point => {
          const tooltip = [
            label,
            `${this.number(point.value)} ${unit}`,
            AdminUtils.fmtDate(point.report),
            AdminUtils.fmtTime(point.report),
            AdminUtils.personText(point.report) ||
              'Sin recorredor'
          ].join(' · ');

          return `
            <circle
              cx="${point.x.toFixed(1)}"
              cy="${point.y.toFixed(1)}"
              r="4.5"
              class="charts-data-point">

              <title>
                ${AdminUtils.escapeHtml(tooltip)}
              </title>
            </circle>
          `;
        })
        .join('');

    return `
      <svg
        class="charts-svg"
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="${AdminUtils.escapeHtml(label)}">

        ${grid}

        <polyline
          points="${polyline}"
          class="charts-data-line">
        </polyline>

        ${circles}

        <text
          x="${padding.left}"
          y="${height - 9}"
          class="charts-date-text">
          Lunes
        </text>

        <text
          x="${width - padding.right}"
          y="${height - 9}"
          text-anchor="end"
          class="charts-date-text">
          Domingo
        </text>
      </svg>
    `;
  },

  renderCard(config){
    const points =
      this.points(config.field);

    const stats =
      this.stats(points);

    return `
      <article class="
        charts-variable-card
        ${
          config.field === 'ctm'
            ? 'charts-variable-ft'
            : ''
        }
      ">
        <header class="charts-variable-head">
          <div>
            <span>
              ${AdminUtils.escapeHtml(config.category)}
            </span>

            <h3>
              ${AdminUtils.escapeHtml(config.label)}
            </h3>
          </div>

          <b>
            ${points.length}
            ${
              points.length === 1
                ? 'medición'
                : 'mediciones'
            }
          </b>
        </header>

        ${
          stats
            ? `
              <div class="charts-variable-stats">
                <div>
                  <span>Último</span>
                  <b>
                    ${this.number(stats.last)}
                    <small>${config.unit}</small>
                  </b>
                </div>

                <div>
                  <span>Mínimo</span>
                  <b>
                    ${this.number(stats.min)}
                    <small>${config.unit}</small>
                  </b>
                </div>

                <div>
                  <span>Máximo</span>
                  <b>
                    ${this.number(stats.max)}
                    <small>${config.unit}</small>
                  </b>
                </div>

                <div>
                  <span>Promedio</span>
                  <b>
                    ${this.number(stats.average)}
                    <small>${config.unit}</small>
                  </b>
                </div>
              </div>
            `
            : ''
        }

        <div class="charts-variable-graph">
          ${this.svg(
            points,
            config.label,
            config.unit
          )}
        </div>
      </article>
    `;
  },

  renderAnalysis(){
    const empty =
      document.getElementById('chartsEmptyState');

    const dashboard =
      document.getElementById('chartsDashboard');

    const summary =
      document.getElementById('chartsSelectedSummary');

    if(!this.selectedWell){
      empty?.classList.remove('hidden');
      dashboard?.classList.add('hidden');

      if(summary){
        summary.textContent =
          'Selecciona un pozo';
      }

      return;
    }

    const reports =
      this.selectedReports();

    if(!reports.length){
      this.selectedWell = '';
      this.renderAnalysis();
      return;
    }

    empty?.classList.add('hidden');
    dashboard?.classList.remove('hidden');

    const latest =
      reports[reports.length - 1];

    const title =
      document.getElementById('chartsWellTitle');

    const activity =
      document.getElementById('chartsWellLastActivity');

    const range =
      document.getElementById('chartsWeekRange');

    if(title){
      title.textContent =
        `Pozo ${this.selectedWell}`;
    }

    if(activity){
      activity.textContent =
        `Último reporte: ` +
        `${AdminUtils.fmtDate(latest)} ` +
        `${AdminUtils.fmtTime(latest)} · ` +
        `${AdminUtils.personText(latest) || 'Sin recorredor'}`;
    }

    if(summary){
      summary.textContent =
        `Pozo ${this.selectedWell} · ` +
        `${reports.length} reportes históricos`;
    }

    if(range){
      range.textContent =
        this.weekLabel(this.weekOffset);
    }

    document
      .querySelectorAll('[data-charts-week]')
      .forEach(button => {
        button.classList.toggle(
          'active',
          Number(
            button.dataset.chartsWeek
          ) === this.weekOffset
        );
      });

    const configs = [
      {
        field:'ptp',
        label:'PTP',
        unit:'kg/cm²',
        category:'PRESIÓN'
      },
      {
        field:'ptr',
        label:'PTR',
        unit:'kg/cm²',
        category:'PRESIÓN'
      },
      {
        field:'ldd',
        label:'LDD',
        unit:'kg/cm²',
        category:'PRESIÓN'
      },
      {
        field:'lbn',
        label:'LBN',
        unit:'kg/cm²',
        category:'PRESIÓN'
      },
      {
        field:'ctm',
        label:'Nivel Frac Tank',
        unit:'cm',
        category:'NIVEL'
      }
    ];

    const cards =
      document.getElementById('chartsCards');

    if(cards){
      cards.innerHTML =
        configs
          .map(config =>
            this.renderCard(config)
          )
          .join('');
    }
  },

  openSelectedWell(){
    if(!this.selectedWell) return;

    const reports =
      this.selectedReports();

    if(!reports.length) return;

    const latest =
      reports[reports.length - 1];

    if(!window.AdminUI) return;

    AdminUI.setInspectorSource?.(
      'well',
      {
        place: this.selectedWell,
        pozo: this.selectedWell,
        latest,
        reports,
        alarms: (
          window.AdminFirebase?.alarmas || []
        ).filter(alarm =>
          this.wellFromReport(alarm) ===
          this.selectedWell
        )
      }
    );

    AdminUI.openDetail(
      'reporte',
      latest,
      true
    );
  },

  render(){
    if(!this.initialized){
      this.init();
    }

    /*
     * El HTML puede conservar una opción anterior por caché.
     * Este estado es la fuente de verdad.
     */
    if(!this.currentFilter){
      this.currentFilter = 'all';
    }

    this.renderWellList();
    this.renderAnalysis();
  }
};

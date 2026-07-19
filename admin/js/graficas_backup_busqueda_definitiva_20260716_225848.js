window.AdminGraficas = {
  initialized: false,
  selectedWell: '',
  weekOffset: 0,
  currentFilter: 'all',
  searchText: '',

  init(){
    if(this.initialized) return;

    this.initialized = true;

    document.getElementById('chartsWellSearch')
      ?.addEventListener('input', event => {
        this.searchText = String(
          event.target.value || ''
        )
          .trim()
          .toUpperCase();

        this.renderWellList();

        const exact = this.wellRows()
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

    document.getElementById('chartsWellFilter')
      ?.addEventListener('change', event => {
        this.currentFilter =
          event.target.value || 'all';

        this.renderWellList();
      });

    document.getElementById('chartsClearSelection')
      ?.addEventListener('click', () => {
        this.selectedWell = '';
        this.weekOffset = 0;

        const search =
          document.getElementById('chartsWellSearch');

        if(search){
          search.value = '';
        }

        this.searchText = '';
        this.currentFilter = 'all';

        const filter =
          document.getElementById(
            'chartsWellFilter'
          );

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

    const navButton =
      document.querySelector(
        '.nav-btn[data-view="graficas"]'
      );

    navButton?.addEventListener('click', () => {
      this.showView();
    });
  },

  showView(){
    document.querySelectorAll('.view')
      .forEach(view => {
        view.classList.add('hidden');
      });

    document.querySelectorAll('.nav-btn')
      .forEach(button => {
        button.classList.remove('active');
      });

    document.getElementById('graficasView')
      ?.classList.remove('hidden');

    document.querySelector(
      '.nav-btn[data-view="graficas"]'
    )?.classList.add('active');

    const title =
      document.getElementById('viewTitle');

    const subtitle =
      document.getElementById('viewSubtitle');

    if(title){
      title.textContent = 'Gráficas';
    }

    if(subtitle){
      subtitle.textContent =
        'Tendencias semanales de variables operativas por pozo.';
    }

    this.render();
  },

  normalizeWell(value){
    const raw = String(value || '')
      .trim()
      .toUpperCase();

    if(!raw) return '';

    if(
      raw.includes('NOTA') ||
      raw.includes('CABEZAL') ||
      raw.includes('ESTACION') ||
      raw.includes('ESTACIÓN')
    ){
      return '';
    }

    const match = raw.match(
      /(?:C[-\s]*)?(\d+[A-Z]?)/
    );

    return match
      ? match[1]
      : '';
  },

  reports(){
    return (
      window.AdminFirebase?.reportes || []
    )
      .filter(report =>
        this.normalizeWell(
          AdminUtils.placeText(report)
        )
      )
      .slice()
      .sort(
        (a, b) =>
          AdminUtils.getTime(a) -
          AdminUtils.getTime(b)
      );
  },

  reportsByWell(){
    const map = {};

    this.reports().forEach(report => {
      const well =
        this.normalizeWell(
          AdminUtils.placeText(report)
        );

      if(!well) return;

      if(!map[well]){
        map[well] = [];
      }

      map[well].push(report);
    });

    return map;
  },

  numericValue(value){
    if(
      value === null ||
      value === undefined ||
      value === ''
    ){
      return null;
    }

    const text = String(value)
      .trim()
      .replace(/,/g, '.');

    const match = text.match(
      /[-+]?\d+(?:\.\d+)?/
    );

    if(!match){
      return null;
    }

    const number = Number(match[0]);

    return Number.isFinite(number)
      ? number
      : null;
  },

  message(report){
    return String(
      report.msg ||
      report.mensaje ||
      report.message ||
      report.texto ||
      ''
    );
  },

  valueFromMessage(report, expressions){
    const message =
      this.message(report);

    for(const expression of expressions){
      const match =
        message.match(expression);

      if(match){
        const value =
          this.numericValue(match[1]);

        if(value !== null){
          return value;
        }
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
      AdminUtils.parseMsg
        ? AdminUtils.parseMsg(report)
        : {};

    const candidates = {
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
        nivel.ctm,
        nivel.nivel,
        report.ctm,
        report.nivelCtm,
        report.nivelCM,
        co.ctm
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
        /\bPTR\s*:\s*([-+]?\d+(?:[.,]\d+)?)/i,
        /TUBER[IÍ]A\s+DE\s+REVESTIMIENTO[^0-9-]*([-+]?\d+(?:[.,]\d+)?)/i
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
    const message =
      this.message(report);

    const normalized =
      message.toUpperCase();

    const ctm =
      this.fieldValue(report, 'ctm');

    if(ctm === null){
      return false;
    }

    if(
      normalized.includes('NIVELES DE GUARDIA') ||
      normalized.includes('NIVEL DE GUARDIA')
    ){
      return true;
    }

    const fluye = String(
      report.co?.fluye ||
      report.fluye ||
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

    return isFt && hasLevelBlock;
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
      AdminUtils.getTime(report);

    if(!timestamp){
      return false;
    }

    const reportDate =
      new Date(timestamp);

    const today =
      new Date();

    return (
      reportDate.getFullYear() ===
        today.getFullYear() &&
      reportDate.getMonth() ===
        today.getMonth() &&
      reportDate.getDate() ===
        today.getDate()
    );
  },

  wellRows(){
    const map =
      this.reportsByWell();

    return Object.entries(map)
      .map(([well, reports]) => {
        const latest =
          reports[reports.length - 1];

        return {
          well,
          reports,
          latest,
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
        };
      })
      .filter(row => {
        if(
          this.searchText &&
          !row.well.includes(this.searchText)
        ){
          return false;
        }

        /*
         * Una búsqueda explícita tiene prioridad.
         * Así se puede encontrar un pozo aunque no haya sido
         * visitado hoy o no pertenezca al filtro seleccionado.
         */
        if(this.searchText){
          return true;
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
      })
      .sort((a, b) => {
        const aNumber =
          Number.parseInt(a.well, 10);

        const bNumber =
          Number.parseInt(b.well, 10);

        if(
          Number.isFinite(aNumber) &&
          Number.isFinite(bNumber) &&
          aNumber !== bNumber
        ){
          return aNumber - bNumber;
        }

        return a.well.localeCompare(
          b.well,
          undefined,
          {numeric:true}
        );
      });
  },

  renderWellList(){
    const container =
      document.getElementById('chartsWellList');

    if(!container) return;

    const rows =
      this.wellRows();

    const count =
      document.getElementById('chartsWellCount');

    if(count){
      count.textContent = rows.length;
    }

    if(!rows.length){
      container.innerHTML = `
        <div class="charts-well-empty">
          <b>Sin coincidencias</b>
          <span>
            ${
              this.searchText
                ? 'No se encontró ese pozo en los reportes cargados.'
                : 'No existen pozos para el filtro seleccionado.'
            }
          </span>
        </div>
      `;

      return;
    }

    container.innerHTML = rows
      .map(row => `
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
      `)
      .join('');

    container
      .querySelectorAll('[data-chart-well]')
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            this.selectedWell =
              button.dataset.chartWell;

            this.weekOffset = 0;
            this.render();
          }
        );
      });
  },

  weekRange(offset=0){
    const now = new Date();

    const day = now.getDay();

    const fromMonday =
      day === 0
        ? 6
        : day - 1;

    const start = new Date(now);

    start.setDate(
      now.getDate() -
      fromMonday -
      Number(offset || 0) * 7
    );

    start.setHours(0, 0, 0, 0);

    const end = new Date(start);

    end.setDate(start.getDate() + 7);
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

    const formatter = date =>
      date.toLocaleDateString(
        'es-MX',
        {
          day:'2-digit',
          month:'short',
          year:'numeric'
        }
      );

    return (
      formatter(range.startDate) +
      ' – ' +
      formatter(range.endDate)
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
        time:
          AdminUtils.getTime(report),

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
      points.map(point => point.value);

    return {
      last:
        values[values.length - 1],

      min:
        Math.min(...values),

      max:
        Math.max(...values),

      average:
        values.reduce(
          (sum, value) => sum + value,
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
      points.map(point => point.value);

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

    const firstTime =
      points[0].time;

    const lastTime =
      points[points.length - 1].time;

    const timeRange =
      Math.max(
        1,
        lastTime - firstTime
      );

    const coordinates =
      points.map((point, index) => {
        const x =
          points.length === 1
            ? padding.left +
              chartWidth / 2
            : padding.left +
              (
                (point.time - firstTime) /
                timeRange
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
          y,
          index
        };
      });

    const line =
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

    const pointsHtml =
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
      <svg class="charts-svg"
           viewBox="0 0 ${width} ${height}"
           role="img"
           aria-label="${AdminUtils.escapeHtml(label)}">

        ${grid}

        <polyline
          points="${line}"
          class="charts-data-line">
        </polyline>

        ${pointsHtml}

        <text
          x="${padding.left}"
          y="${height - 9}"
          class="charts-date-text">
          ${AdminUtils.escapeHtml(
            AdminUtils.fmtDate(
              points[0].report
            )
          )}
        </text>

        <text
          x="${width - padding.right}"
          y="${height - 9}"
          text-anchor="end"
          class="charts-date-text">
          ${AdminUtils.escapeHtml(
            AdminUtils.fmtDate(
              points[points.length - 1].report
            )
          )}
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
      document.getElementById(
        'chartsEmptyState'
      );

    const dashboard =
      document.getElementById(
        'chartsDashboard'
      );

    if(!this.selectedWell){
      empty?.classList.remove('hidden');
      dashboard?.classList.add('hidden');

      const summary =
        document.getElementById(
          'chartsSelectedSummary'
        );

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
      document.getElementById(
        'chartsWellTitle'
      );

    const activity =
      document.getElementById(
        'chartsWellLastActivity'
      );

    const summary =
      document.getElementById(
        'chartsSelectedSummary'
      );

    const range =
      document.getElementById(
        'chartsWeekRange'
      );

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
        this.weekLabel(
          this.weekOffset
        );
    }

    document
      .querySelectorAll(
        '[data-charts-week]'
      )
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
      document.getElementById(
        'chartsCards'
      );

    if(cards){
      cards.innerHTML =
        configs.map(config =>
          this.renderCard(config)
        ).join('');
    }
  },

  openSelectedWell(){
    if(!this.selectedWell) return;

    const reports =
      this.selectedReports();

    if(!reports.length) return;

    const latest =
      reports[reports.length - 1];

    if(
      window.AdminPozos &&
      typeof AdminPozos.openWell === 'function'
    ){
      AdminPozos.openWell(
        this.selectedWell
      );

      return;
    }

    if(window.AdminUI){
      AdminUI.setInspectorSource?.(
        'well',
        {
          place: this.selectedWell,
          pozo: this.selectedWell,
          latest,
          reports,
          alarms: (
            window.AdminFirebase?.alarmas ||
            []
          ).filter(alarm =>
            this.normalizeWell(
              AdminUtils.placeText(alarm)
            ) === this.selectedWell
          )
        }
      );

      AdminUI.openDetail(
        'reporte',
        latest,
        true
      );
    }
  },

  render(){
    if(!this.initialized){
      this.init();
    }

    this.renderWellList();
    this.renderAnalysis();
  }
};

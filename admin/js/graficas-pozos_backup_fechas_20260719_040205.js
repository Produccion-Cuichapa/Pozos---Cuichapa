window.AdminGraficas = {
  row: null,
  weekOffset: 0,
  initialized: false,
  refreshTimer: null,
  activeWell: '',

  init(){
    if(this.initialized) return;

    this.initialized = true;

    document.addEventListener('click', event => {
      if(event.target.closest('[data-close-well-charts]')){
        this.close();
        return;
      }

      const weekButton = event.target.closest(
        '[data-well-chart-week]'
      );

      if(weekButton){
        this.weekOffset = Number(
          weekButton.dataset.wellChartWeek || 0
        );

        this.render();
      }
    });

    document.addEventListener('keydown', event => {
      if(event.key === 'Escape'){
        this.close();
      }
    });

    console.info(
      '✅ AdminGraficas inicializado correctamente'
    );
  },

  open(row){
    const drawer =
      document.getElementById('wellChartsDrawer');

    if(!drawer){
      console.error(
        'AdminGraficas: no existe #wellChartsDrawer'
      );

      alert(
        'No se encontró el panel de gráficas.'
      );

      return;
    }

    if(!row || !Array.isArray(row.reports)){
      console.error(
        'AdminGraficas: objeto del pozo inválido',
        row
      );

      alert(
        'No se encontró el historial del pozo.'
      );

      return;
    }

    this.init();

    this.activeWell = String(row.well || '');
    this.row = row;
    this.weekOffset = 0;

    drawer.classList.remove('hidden');
    drawer.setAttribute('aria-hidden', 'false');

    document.body.classList.add(
      'well-charts-open'
    );

    /*
     * Antes de dibujar, vuelve a tomar el pozo desde
     * los datos actuales de Firebase.
     */
    this.refreshLiveRow();
    this.startLiveRefresh();
  },

  close(){
    const drawer =
      document.getElementById('wellChartsDrawer');

    if(drawer){
      drawer.classList.add('hidden');
      drawer.setAttribute('aria-hidden', 'true');
    }

    document.body.classList.remove(
      'well-charts-open'
    );

    this.stopLiveRefresh();

    this.row = null;
    this.activeWell = '';
  },

  refreshLiveRow(){
    if(!this.activeWell){
      return;
    }

    let currentRows = [];

    /*
     * Se reconstruyen los pozos directamente desde
     * AdminFirebase.reportes, mediante la misma función
     * utilizada por la sección Pozos.
     */
    if(
      window.AdminPozos &&
      typeof AdminPozos.buildRows === 'function'
    ){
      currentRows = AdminPozos.buildRows();
    }

    const currentRow = currentRows.find(item =>
      String(item.well) === String(this.activeWell)
    );

    if(currentRow){
      this.row = currentRow;

      /*
       * También actualizamos la fila que mantiene Pozos
       * para que tarjeta, expediente y gráficas compartan
       * exactamente la misma información.
       */
      const index = Array.isArray(AdminPozos.rows)
        ? AdminPozos.rows.findIndex(item =>
            String(item.well) ===
            String(this.activeWell)
          )
        : -1;

      if(index >= 0){
        AdminPozos.rows[index] = currentRow;
      }
    }

    this.render();
  },

  startLiveRefresh(){
    this.stopLiveRefresh();

    this.refreshTimer = window.setInterval(
      () => {
        const drawer =
          document.getElementById('wellChartsDrawer');

        const isOpen =
          drawer &&
          !drawer.classList.contains('hidden');

        if(!isOpen){
          this.stopLiveRefresh();
          return;
        }

        this.refreshLiveRow();
      },
      5000
    );
  },

  stopLiveRefresh(){
    if(this.refreshTimer){
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  reportText(report){
    return String(
      report?.msg ||
      report?.mensaje ||
      report?.message ||
      report?.texto ||
      ''
    );
  },

  parsed(report){
    try{
      if(
        window.AdminUtils &&
        typeof AdminUtils.parseMsg === 'function'
      ){
        return AdminUtils.parseMsg(report) || {};
      }
    }catch(error){
      console.warn(
        'No se pudo interpretar reporte',
        error
      );
    }

    return {};
  },

  toNumber(value){
    if(
      value === null ||
      value === undefined ||
      value === ''
    ){
      return null;
    }

    const match = String(value)
      .replace(/,/g, '.')
      .match(/[-+]?\d+(?:\.\d+)?/);

    if(!match) return null;

    const number = Number(match[0]);

    return Number.isFinite(number)
      ? number
      : null;
  },

  regexValue(report, field){
    const patterns = {
      ptp: /\bPTP\s*[:=-]?\s*([-+]?\d+(?:[.,]\d+)?)/i,
      ptr: /\bPTR\s*[:=-]?\s*([-+]?\d+(?:[.,]\d+)?)/i,
      ldd: /\bLDD\s*[:=-]?\s*([-+]?\d+(?:[.,]\d+)?)/i,
      lbn: /\bLBN\s*[:=-]?\s*([-+]?\d+(?:[.,]\d+)?)/i,
      ctm: /\b(?:CTM|CENT[IÍ]METROS?|CMS?)\s*[:=-]?\s*([-+]?\d+(?:[.,]\d+)?)/i,
      bls: /\b(?:BLS|BARRILES?|BBL)\s*[:=-]?\s*([-+]?\d+(?:[.,]\d+)?)/i
    };

    const pattern = patterns[field];

    if(!pattern) return null;

    const match =
      this.reportText(report).match(pattern);

    return match
      ? this.toNumber(match[1])
      : null;
  },

  fieldValue(report, field){
    const co = report?.co || {};
    const nivel = report?.nivel || {};
    const parsed = this.parsed(report);

    const candidates = {
      ptp: [
        co.ptp,
        report?.ptp,
        report?.PTP,
        parsed.ptp,
        parsed.PTP
      ],

      ptr: [
        co.ptr,
        report?.ptr,
        report?.PTR,
        parsed.ptr,
        parsed.PTR
      ],

      ldd: [
        co.ldd,
        report?.ldd,
        report?.LDD,
        parsed.ldd,
        parsed.LDD
      ],

      lbn: [
        co.lbn,
        report?.lbn,
        report?.LBN,
        parsed.lbn,
        parsed.LBN
      ],

      ctm: [
        nivel.ctm,
        nivel.nivel,
        report?.ctm,
        report?.CTM,
        report?.nivelCtm,
        report?.nivelCM,
        co.ctm,
        parsed.ctm,
        parsed.CTM
      ],

      bls: [
        nivel.bls,
        nivel.BLS,
        report?.bls,
        report?.BLS,
        report?.nivelBls,
        report?.nivelBLS,
        co.bls,
        co.BLS,
        parsed.bls,
        parsed.BLS
      ]
    };

    for(const candidate of candidates[field] || []){
      const number = this.toNumber(candidate);

      if(number !== null){
        return number;
      }
    }

    return this.regexValue(report, field);
  },

  isFracTank(report){
    const bls = this.fieldValue(report, 'bls');

    if(bls === null){
      return false;
    }

    const text = this.reportText(report);
    const parsed = this.parsed(report);

    if(
      /NIVELES?\s+DE\s+GUARDIA/i.test(text)
    ){
      return true;
    }

    const fluye = String(
      report?.co?.fluye ||
      report?.fluye ||
      parsed?.fluye ||
      ''
    )
      .trim()
      .toUpperCase();

    const fluyeFt =
      fluye === 'FT' ||
      /FLUYE\s*[:=-]?\s*FT\b/i.test(text);

    const hasFracTank =
      /NIVEL\s+(?:DE\s+)?FRAC\s*TANK/i
        .test(text);

    return fluyeFt && hasFracTank;
  },

  weekRange(){
    const now = new Date();
    const day = now.getDay();
    const distance = day === 0 ? 6 : day - 1;

    const start = new Date(now);

    start.setDate(
      now.getDate() -
      distance -
      this.weekOffset * 7
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

  dateLabel(){
    const range = this.weekRange();

    const format = date =>
      date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

    return (
      format(range.startDate) +
      ' – ' +
      format(range.endDate)
    );
  },

  reports(){
    return Array.isArray(this.row?.reports)
      ? this.row.reports
          .slice()
          .sort(
            (a, b) =>
              AdminUtils.getTime(a) -
              AdminUtils.getTime(b)
          )
      : [];
  },

  points(field){
    const range = this.weekRange();

    return this.reports()
      .filter(report => {
        const time = AdminUtils.getTime(report);

        if(
          !time ||
          time < range.start ||
          time >= range.end
        ){
          return false;
        }

        if(
          field === 'bls' &&
          !this.isFracTank(report)
        ){
          return false;
        }

        return true;
      })
      .map(report => ({
        report,
        time: AdminUtils.getTime(report),
        value: this.fieldValue(report, field)
      }))
      .filter(point =>
        point.value !== null
      );
  },

  stats(points){
    if(!points.length) return null;

    const values = points.map(
      point => point.value
    );

    return {
      last: values[values.length - 1],
      min: Math.min(...values),
      max: Math.max(...values),
      average:
        values.reduce(
          (sum, value) => sum + value,
          0
        ) / values.length
    };
  },

  formatNumber(value){
    if(!Number.isFinite(value)){
      return '—';
    }

    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(1);
  },

  svg(points, label){
    if(!points.length){
      return `
        <div class="well-charts-no-data">
          Sin mediciones de
          ${AdminUtils.escapeHtml(label)}
          en esta semana.
        </div>
      `;
    }

    const width = 700;
    const height = 220;
    const left = 50;
    const right = 20;
    const top = 20;
    const bottom = 34;

    const chartWidth =
      width - left - right;

    const chartHeight =
      height - top - bottom;

    const values = points.map(
      point => point.value
    );

    let min = Math.min(...values);
    let max = Math.max(...values);

    if(min === max){
      min -= 1;
      max += 1;
    }

    const week = this.weekRange();

    const coordinates = points.map(point => {
      const x =
        left +
        (
          (point.time - week.start) /
          (week.end - week.start)
        ) * chartWidth;

      const y =
        top +
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

    const polyline = coordinates
      .map(point =>
        `${point.x.toFixed(1)},${point.y.toFixed(1)}`
      )
      .join(' ');

    const grid = [0, .25, .5, .75, 1]
      .map(position => {
        const y =
          top + position * chartHeight;

        const value =
          max - position * (max - min);

        return `
          <line
            x1="${left}"
            y1="${y}"
            x2="${width - right}"
            y2="${y}"
            class="well-charts-grid-line">
          </line>

          <text
            x="${left - 8}"
            y="${y + 3}"
            text-anchor="end"
            class="well-charts-axis-text">
            ${this.formatNumber(value)}
          </text>
        `;
      })
      .join('');

    const circles = coordinates
      .map(point => `
        <circle
          cx="${point.x.toFixed(1)}"
          cy="${point.y.toFixed(1)}"
          r="4"
          class="well-charts-point">

          <title>
            ${AdminUtils.escapeHtml(
              `${label}: ${this.formatNumber(point.value)} · ` +
              `${AdminUtils.fmtDate(point.report)} · ` +
              `${AdminUtils.fmtTime(point.report)}`
            )}
          </title>
        </circle>
      `)
      .join('');

    return `
      <svg class="well-charts-svg"
           viewBox="0 0 ${width} ${height}">

        ${grid}

        <polyline
          points="${polyline}"
          class="well-charts-line">
        </polyline>

        ${circles}

        <text x="${left}"
              y="${height - 8}"
              class="well-charts-date-text">
          Lunes
        </text>

        <text x="${width - right}"
              y="${height - 8}"
              text-anchor="end"
              class="well-charts-date-text">
          Domingo
        </text>
      </svg>
    `;
  },

  card(field, label, unit, category){
    const points = this.points(field);
    const stats = this.stats(points);

    return `
      <article class="well-charts-card ${
        field === 'bls'
          ? 'well-charts-card-ft'
          : ''
      }">

        <header>
          <div>
            <span>${category}</span>
            <h3>${label}</h3>
          </div>

          <b>
            ${points.length}
            ${points.length === 1
              ? 'medición'
              : 'mediciones'}
          </b>
        </header>

        ${
          stats
            ? `
              <div class="well-charts-stats">
                <div>
                  <span>Último</span>
                  <b>${this.formatNumber(stats.last)}
                    <small>${unit}</small>
                  </b>
                </div>

                <div>
                  <span>Mínimo</span>
                  <b>${this.formatNumber(stats.min)}
                    <small>${unit}</small>
                  </b>
                </div>

                <div>
                  <span>Máximo</span>
                  <b>${this.formatNumber(stats.max)}
                    <small>${unit}</small>
                  </b>
                </div>

                <div>
                  <span>Promedio</span>
                  <b>${this.formatNumber(stats.average)}
                    <small>${unit}</small>
                  </b>
                </div>
              </div>
            `
            : ''
        }

        <div class="well-charts-graph">
          ${this.svg(points, label)}
        </div>
      </article>
    `;
  },

  render(){
    if(!this.row) return;

    const title =
      document.getElementById('wellChartsTitle');

    const subtitle =
      document.getElementById('wellChartsSubtitle');

    const range =
      document.getElementById('wellChartsWeekRange');

    const content =
      document.getElementById('wellChartsContent');

    if(title){
      title.textContent =
        `Gráficas del pozo ${this.row.well}`;
    }

    if(subtitle){
      const orderedReports = this.reports();

      const latestReport =
        orderedReports.length
          ? orderedReports[orderedReports.length - 1]
          : null;

      const latestText = latestReport
        ? ` · Último: ${AdminUtils.fmtDate(latestReport)} ${AdminUtils.fmtTime(latestReport)}`
        : '';

      const refreshedAt =
        new Date().toLocaleTimeString(
          'es-MX',
          {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }
        );

      subtitle.textContent =
        `${this.row.reports.length} reportes históricos${latestText} · Actualizado ${refreshedAt}`;
    }

    if(range){
      range.textContent = this.dateLabel();
    }

    document
      .querySelectorAll('[data-well-chart-week]')
      .forEach(button => {
        button.classList.toggle(
          'active',
          Number(
            button.dataset.wellChartWeek
          ) === this.weekOffset
        );
      });

    if(!content) return;

    content.innerHTML = [
      this.card(
        'ptp',
        'PTP',
        'kg/cm²',
        'PRESIÓN'
      ),

      this.card(
        'ptr',
        'PTR',
        'kg/cm²',
        'PRESIÓN'
      ),

      this.card(
        'ldd',
        'LDD',
        'kg/cm²',
        'PRESIÓN'
      ),

      this.card(
        'lbn',
        'LBN',
        'kg/cm²',
        'PRESIÓN'
      ),

      this.card(
        'bls',
        'Nivel Frac Tank',
        'bbl',
        'NIVEL'
      )
    ].join('');
  }
};

document.addEventListener(
  'DOMContentLoaded',
  () => {
    window.AdminGraficas.init();
  }
);

console.info(
  '✅ graficas-pozos.js cargado',
  typeof window.AdminGraficas.open
);

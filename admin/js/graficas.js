window.AdminGraficas = {
  row: null,
  weekOffset: 0,
  initialized: false,

  init(){
    if(this.initialized) return;

    this.initialized = true;

    document
      .querySelectorAll('[data-close-well-charts]')
      .forEach(element => {
        element.addEventListener(
          'click',
          () => this.close()
        );
      });

    document.getElementById('wellChartsWeekButtons')
      ?.addEventListener('click', event => {
        const button =
          event.target.closest(
            '[data-well-chart-week]'
          );

        if(!button) return;

        this.weekOffset = Number(
          button.dataset.wellChartWeek || 0
        );

        this.render();
      });

    document.addEventListener('keydown', event => {
      if(event.key === 'Escape'){
        this.close();
      }
    });
  },

  open(row){
    if(!row){
      console.error(
        'AdminGraficas.open: falta el objeto del pozo.'
      );

      return;
    }

    if(!Array.isArray(row.reports)){
      console.error(
        'AdminGraficas.open: reports no es un arreglo.',
        row
      );

      return;
    }

    this.init();

    const drawer =
      document.getElementById('wellChartsDrawer');

    if(!drawer){
      console.error(
        'AdminGraficas.open: no existe #wellChartsDrawer.'
      );

      alert(
        'No se encontró el panel de gráficas en la página.'
      );

      return;
    }

    this.row = row;
    this.weekOffset = 0;

    drawer?.classList.remove('hidden');
    drawer?.setAttribute('aria-hidden', 'false');

    document.body.classList.add(
      'well-charts-open'
    );

    this.render();
  },

  close(){
    const drawer =
      document.getElementById('wellChartsDrawer');

    drawer?.classList.add('hidden');
    drawer?.setAttribute('aria-hidden', 'true');

    document.body.classList.remove(
      'well-charts-open'
    );

    this.row = null;
  },

  message(report){
    return String(
      report?.msg ||
      report?.mensaje ||
      report?.message ||
      report?.texto ||
      ''
    );
  },

  numberValue(value){
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

  parsed(report){
    try{
      return AdminUtils.parseMsg
        ? AdminUtils.parseMsg(report) || {}
        : {};
    }catch(error){
      return {};
    }
  },

  messageValue(report, expressions){
    const message = this.message(report);

    for(const expression of expressions){
      const match = message.match(expression);

      if(!match) continue;

      const value = this.numberValue(match[1]);

      if(value !== null){
        return value;
      }
    }

    return null;
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
        parsed.ptp
      ],

      ptr: [
        co.ptr,
        report?.ptr,
        report?.PTR,
        parsed.ptr
      ],

      ldd: [
        co.ldd,
        report?.ldd,
        report?.LDD,
        parsed.ldd
      ],

      lbn: [
        co.lbn,
        report?.lbn,
        report?.LBN,
        parsed.lbn
      ],

      ctm: [
        nivel.ctm,
        nivel.nivel,
        report?.ctm,
        report?.CTM,
        report?.nivelCtm,
        report?.nivelCM,
        co.ctm,
        parsed.ctm
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
      const value = this.numberValue(candidate);

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

    return this.messageValue(
      report,
      expressions[field] || []
    );
  },

  isFracTankMeasurement(report){
    const bls = this.fieldValue(report, 'bls');

    if(bls === null){
      return false;
    }

    const message = this.message(report);

    /*
     * Regla 1:
     * Los reportes de Niveles de guardia sí son mediciones FT.
     */
    if(
      /NIVELES?\s+DE\s+GUARDIA/i.test(message)
    ){
      return true;
    }

    const parsed = this.parsed(report);

    const fluye = String(
      report?.co?.fluye ||
      report?.fluye ||
      parsed.fluye ||
      ''
    )
      .trim()
      .toUpperCase();

    const isFt =
      fluye === 'FT' ||
      /FLUYE\s*:\s*FT\b/i.test(message);

    /*
     * Regla 2:
     * Un reporte de visita solo cuenta cuando:
     * - Fluye a FT.
     * - Incluye el bloque NIVEL FRAC TANK.
     * - Tiene CTM válido.
     */
    const hasLevelBlock =
      /NIVEL\s+(?:DE\s+)?FRAC\s*TANK/i
        .test(message);

    return isFt && hasLevelBlock;
  },

  weekRange(offset=0){
    const now = new Date();

    const day = now.getDay();

    const daysFromMonday =
      day === 0
        ? 6
        : day - 1;

    const start = new Date(now);

    start.setDate(
      now.getDate() -
      daysFromMonday -
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
      endDate: new Date(end.getTime() - 1)
    };
  },

  weekLabel(){
    const range = this.weekRange(
      this.weekOffset
    );

    const format = date =>
      date.toLocaleDateString(
        'es-MX',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }
      );

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
    const range = this.weekRange(
      this.weekOffset
    );

    return this.reports()
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
          field === 'bls' &&
          !this.isFracTankMeasurement(report)
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
    if(!points.length){
      return null;
    }

    const values = points.map(
      point => point.value
    );

    return {
      last: values[values.length - 1],
      min: Math.min(...values),
      max: Math.max(...values),
      average:
        values.reduce(
          (total, value) => total + value,
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

  svg(points, label, unit){
    if(!points.length){
      return `
        <div class="well-charts-no-data">
          Sin mediciones de
          ${AdminUtils.escapeHtml(label)}
          en la semana seleccionada.
        </div>
      `;
    }

    const width = 700;
    const height = 220;

    const padding = {
      left: 48,
      right: 20,
      top: 20,
      bottom: 34
    };

    const values = points.map(
      point => point.value
    );

    let min = Math.min(...values);
    let max = Math.max(...values);

    if(min === max){
      min -= 1;
      max += 1;
    }

    const range = this.weekRange(
      this.weekOffset
    );

    const chartWidth =
      width - padding.left - padding.right;

    const chartHeight =
      height - padding.top - padding.bottom;

    const coordinates = points.map(point => {
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

    const polyline = coordinates
      .map(point =>
        `${point.x.toFixed(1)},${point.y.toFixed(1)}`
      )
      .join(' ');

    const grid = [0, .25, .5, .75, 1]
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
            class="well-charts-grid-line">
          </line>

          <text
            x="${padding.left - 8}"
            y="${y + 3}"
            text-anchor="end"
            class="well-charts-axis-text">
            ${this.formatNumber(value)}
          </text>
        `;
      })
      .join('');

    const circles = coordinates
      .map(point => {
        const tooltip = [
          label,
          `${this.formatNumber(point.value)} ${unit}`,
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
            class="well-charts-point">

            <title>
              ${AdminUtils.escapeHtml(tooltip)}
            </title>
          </circle>
        `;
      })
      .join('');

    return `
      <svg
        class="well-charts-svg"
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="${AdminUtils.escapeHtml(label)}">

        ${grid}

        <polyline
          points="${polyline}"
          class="well-charts-line">
        </polyline>

        ${circles}

        <text
          x="${padding.left}"
          y="${height - 9}"
          class="well-charts-date-text">
          Lunes
        </text>

        <text
          x="${width - padding.right}"
          y="${height - 9}"
          text-anchor="end"
          class="well-charts-date-text">
          Domingo
        </text>
      </svg>
    `;
  },

  card(config){
    const points = this.points(config.field);
    const stats = this.stats(points);

    return `
      <article class="
        well-charts-card
        ${
          config.field === 'bls'
            ? 'well-charts-card-ft'
            : ''
        }
      ">
        <header>
          <div>
            <span>${config.category}</span>
            <h3>${config.label}</h3>
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
              <div class="well-charts-stats">
                <div>
                  <span>Último</span>
                  <b>
                    ${this.formatNumber(stats.last)}
                    <small>${config.unit}</small>
                  </b>
                </div>

                <div>
                  <span>Mínimo</span>
                  <b>
                    ${this.formatNumber(stats.min)}
                    <small>${config.unit}</small>
                  </b>
                </div>

                <div>
                  <span>Máximo</span>
                  <b>
                    ${this.formatNumber(stats.max)}
                    <small>${config.unit}</small>
                  </b>
                </div>

                <div>
                  <span>Promedio</span>
                  <b>
                    ${this.formatNumber(stats.average)}
                    <small>${config.unit}</small>
                  </b>
                </div>
              </div>
            `
            : ''
        }

        <div class="well-charts-graph">
          ${this.svg(
            points,
            config.label,
            config.unit
          )}
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
      subtitle.textContent =
        `${this.row.reports.length} reportes históricos disponibles`;
    }

    if(range){
      range.textContent = this.weekLabel();
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
        field: 'bls',
        label: 'Nivel Frac Tank',
        unit: 'bbl',
        category: 'NIVEL'
      }
    ];

    if(content){
      content.innerHTML = configs
        .map(config => this.card(config))
        .join('');
    }
  }
};

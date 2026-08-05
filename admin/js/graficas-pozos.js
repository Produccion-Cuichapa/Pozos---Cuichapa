window.AdminGraficas = {

  /*
   * BALANCE DE FRAC TANK DIARIO
   *
   * Valores fijos cargados manualmente.
   * No se calculan con reportes.
   * No se guardan ni sincronizan con Firebase.
   */
  balanceFracTankDiario: {
    '172': 104,
    '106D': 453,
    '505': 0,
    '179': 45,
    '401': 0,
    '107': 147,
    '19': 54,
    '601': 600,
    '201': 0,
    '376': 34,
    '385': 13,
    '602': 0,
    '139': 69,
    '352': 384,
    '603': 23
  },
  row: null,
  weekOffset: 0,
  dateFrom: '',
  dateTo: '',
  activeDatePreset: '30',
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

      const applyButton = event.target.closest(
        '[data-well-chart-apply]'
      );

      if(applyButton){
        this.applyDateFilter();
        return;
      }

      const rangeButton = event.target.closest(
        '[data-well-chart-range]'
      );

      if(rangeButton){
        this.setDatePreset(
          rangeButton.dataset.wellChartRange
        );
        return;
      }
    });

    document.addEventListener('keydown', event => {
      if(event.key === 'Escape'){
        this.close();
      }
    });

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
    this.setDatePreset('30', false);

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

  /*
   * Genera una firma ligera únicamente con los datos
   * correspondientes al pozo que tiene abierta la gráfica.
   *
   * El temporizador sigue revisando cada 5 segundos, pero
   * buildRows() solo se ejecuta cuando esta firma cambia.
   */
  liveDataSignature(){
    const activeWell = String(this.activeWell || '');

    if(!activeWell){
      return '';
    }

    const reports =
      window.AdminFirebase?.reportes || [];

    const alarms =
      window.AdminFirebase?.alarmas || [];

    const parts = [
      activeWell,
      String(reports.length),
      String(alarms.length)
    ];

    const getTime = item =>
      window.AdminUtils &&
      typeof AdminUtils.getTime === 'function'
        ? AdminUtils.getTime(item)
        : (
            item?.timestamp ||
            item?.createdAt ||
            item?.fechaHora ||
            ''
          );

    for(const report of reports){
      const reportWell =
        window.AdminPozos &&
        typeof AdminPozos.reportWell === 'function'
          ? AdminPozos.reportWell(report)
          : (
              report?.pozo ||
              report?.nombrePozo ||
              report?.well ||
              ''
            );

      if(String(reportWell) !== activeWell){
        continue;
      }

      parts.push(
        'R',
        String(
          report?.id ||
          report?._id ||
          report?.key ||
          report?.firebaseKey ||
          ''
        ),
        String(getTime(report) || ''),
        String(
          report?.msg ||
          report?.mensaje ||
          report?.message ||
          report?.texto ||
          ''
        ),
        String(
          report?.estadoPozo ||
          report?.estatus ||
          report?.whatsappStatus ||
          ''
        ),
        JSON.stringify(report?.co || {}),
        JSON.stringify(report?.nivel || {}),
        JSON.stringify(report?.checks || {})
      );
    }

    for(const alarm of alarms){
      const alarmWell =
        window.AdminPozos &&
        typeof AdminPozos.alarmWell === 'function'
          ? AdminPozos.alarmWell(alarm)
          : (
              alarm?.pozo ||
              alarm?.nombrePozo ||
              alarm?.well ||
              ''
            );

      if(String(alarmWell) !== activeWell){
        continue;
      }

      parts.push(
        'A',
        String(
          alarm?.id ||
          alarm?._id ||
          alarm?.key ||
          alarm?.firebaseKey ||
          ''
        ),
        String(getTime(alarm) || ''),
        String(
          alarm?.msg ||
          alarm?.mensaje ||
          alarm?.descripcion ||
          alarm?.tipo ||
          ''
        ),
        String(
          alarm?.estatus ||
          alarm?.status ||
          ''
        )
      );
    }

    return parts.join('\\u001f');
  },

  startLiveRefresh(){
    this.stopLiveRefresh();

    /*
     * Guardamos la fotografía lógica inicial. Así, el
     * primer ciclo no reconstruye si nada ha cambiado.
     */
    this.lastLiveSignature =
      this.liveDataSignature();

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

        const nextSignature =
          this.liveDataSignature();

        if(
          nextSignature ===
          this.lastLiveSignature
        ){
          return;
        }

        this.lastLiveSignature =
          nextSignature;

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

    this.lastLiveSignature = '';
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
      
/NIVEL\s+(?:DE\s+)?(?:FRAC\s*TANK|PRESA\s*MET[ÁA]LICA)/i
        .test(text);

    return fluyeFt && hasFracTank;
  },

  ymd(date){
    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');
    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  },

  parseYmd(value, endExclusive=false){
    const parts = String(value || '')
      .split('-')
      .map(Number);

    if(
      parts.length !== 3 ||
      parts.some(part => !Number.isFinite(part))
    ){
      return null;
    }

    const date = new Date(
      parts[0],
      parts[1] - 1,
      parts[2],
      0, 0, 0, 0
    );

    if(endExclusive){
      date.setDate(date.getDate() + 1);
    }

    return date;
  },

  syncDateInputs(){
    const fromInput =
      document.getElementById('wellChartsDateFrom');

    const toInput =
      document.getElementById('wellChartsDateTo');

    if(fromInput){
      fromInput.value = this.dateFrom || '';
    }

    if(toInput){
      toInput.value = this.dateTo || '';
    }
  },

  setDatePreset(preset, shouldRender=true){
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start = new Date(today);
    let end = new Date(today);

    if(preset === '7'){
      start.setDate(start.getDate() - 6);
    }else if(preset === 'month'){
      start = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );
    }else if(preset === 'all'){
      const reports = this.reports();

      if(reports.length){
        const firstTime =
          AdminUtils.getTime(reports[0]);

        const lastTime =
          AdminUtils.getTime(
            reports[reports.length - 1]
          );

        if(firstTime){
          start = new Date(firstTime);
          start.setHours(0, 0, 0, 0);
        }

        if(lastTime){
          end = new Date(lastTime);
          end.setHours(0, 0, 0, 0);
        }
      }
    }else{
      preset = '30';
      start.setDate(start.getDate() - 29);
    }

    this.dateFrom = this.ymd(start);
    this.dateTo = this.ymd(end);
    this.activeDatePreset = preset;

    this.syncDateInputs();

    if(shouldRender){
      this.render();
    }
  },

  applyDateFilter(){
    const fromInput =
      document.getElementById('wellChartsDateFrom');

    const toInput =
      document.getElementById('wellChartsDateTo');

    const from = String(
      fromInput?.value || ''
    );

    const to = String(
      toInput?.value || ''
    );

    if(!from || !to){
      alert(
        'Selecciona la fecha inicial y la fecha final.'
      );
      return;
    }

    if(from > to){
      alert(
        'La fecha inicial no puede ser posterior a la fecha final.'
      );
      return;
    }

    this.dateFrom = from;
    this.dateTo = to;
    this.activeDatePreset = 'custom';

    this.render();
  },

  weekRange(){
    let start = this.parseYmd(this.dateFrom);
    let end = this.parseYmd(this.dateTo, true);

    if(!start || !end){
      this.setDatePreset('30', false);

      start = this.parseYmd(this.dateFrom);
      end = this.parseYmd(this.dateTo, true);
    }

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

  balanceFracTankCard(){
    const well = String(
      this.row?.well || ''
    )
      .trim()
      .toUpperCase()
      .replace(/^POZO\s+/i, '')
      .replace(/^C[-\s]*/i, '');

    const catalogo =
      this.balanceFracTankDiario || {};

    if(
      !Object.prototype.hasOwnProperty.call(
        catalogo,
        well
      )
    ){
      return '';
    }

    const balance = catalogo[well];

    return `
      <article class="well-charts-balance-daily">

        <div class="well-charts-balance-main">

          <div class="well-charts-balance-icon"
               aria-hidden="true">
            FT
          </div>

          <div class="well-charts-balance-copy">

            <span class="well-charts-balance-kicker">
              BALANCE FIJO
            </span>

            <h3>
              Balance de Frac Tank Diario
            </h3>

            <p>
              Valor fijo cargado manualmente.
              No se calcula desde los reportes.
            </p>

          </div>

        </div>

        <div class="well-charts-balance-values">

          <div class="well-charts-balance-value">
            <span>POZO</span>
            <b>${well}</b>
          </div>

          <div class="
            well-charts-balance-value
            well-charts-balance-value-primary
          ">
            <span>BLS/DÍA</span>
            <b>${this.formatNumber(balance)}</b>
            <small>bbl/día</small>
          </div>

        </div>

        <div class="well-charts-balance-badge">
          ✓ Actualización manual
        </div>

      </article>
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

          <div class="well-charts-card-actions">
            <b>
              ${points.length}
              ${points.length === 1
                ? 'medición'
                : 'mediciones'}
            </b>

            <button
              type="button"
              class="well-chart-expand-btn"
              data-well-chart-expand
              aria-label="Ampliar gráfica ${AdminUtils.escapeHtml(label)}"
              title="Ampliar gráfica">
              ⛶ Ampliar
            </button>
          </div>
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

    this.syncDateInputs();

    document
      .querySelectorAll('[data-well-chart-range]')
      .forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.wellChartRange ===
            this.activeDatePreset
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
        'Volumen Frac Tank',
        'bbl',
        'VOLUMEN'
      ),

      this.balanceFracTankCard()
    ]
      .filter(Boolean)
      .join('');
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


/* ==========================================================
 * VISOR INDIVIDUAL DE GRÁFICAS
 * Amplía únicamente la tarjeta seleccionada.
 * ========================================================== */
(function instalarVisorGraficaIndividual(){
  'use strict';

  if(window.__visorGraficaIndividualInstalado){
    return;
  }

  window.__visorGraficaIndividualInstalado = true;

  function elementos(){
    return {
      modal: document.getElementById(
        'wellChartExpandedModal'
      ),
      body: document.getElementById(
        'wellChartExpandedBody'
      ),
      title: document.getElementById(
        'wellChartExpandedTitle'
      ),
      subtitle: document.getElementById(
        'wellChartExpandedSubtitle'
      )
    };
  }

  function abrirGrafica(button){
    const card = button.closest(
      '.well-charts-card'
    );

    if(!card){
      return;
    }

    const refs = elementos();

    if(
      !refs.modal ||
      !refs.body
    ){
      console.warn(
        '[GRÁFICAS] No existe el modal ampliado.'
      );
      return;
    }

    const heading = card.querySelector(
      'header h3'
    );

    const category = card.querySelector(
      'header span'
    );

    const drawerTitle = document.getElementById(
      'wellChartsTitle'
    );

    const dateRange = document.getElementById(
      'wellChartsWeekRange'
    );

    if(refs.title){
      refs.title.textContent =
        heading?.textContent?.trim() ||
        'Gráfica operativa';
    }

    if(refs.subtitle){
      const parts = [];

      if(drawerTitle?.textContent){
        parts.push(
          drawerTitle.textContent.trim()
        );
      }

      if(category?.textContent){
        parts.push(
          category.textContent.trim()
        );
      }

      if(dateRange?.textContent){
        parts.push(
          dateRange.textContent.trim()
        );
      }

      refs.subtitle.textContent =
        parts.join(' · ');
    }

    /*
     * Clonar la tarjeta evita mover o modificar
     * la gráfica original del panel lateral.
     */
    const clone = card.cloneNode(true);

    clone.classList.add(
      'well-charts-card-expanded'
    );

    clone.classList.remove(
      'well-charts-card-ft'
    );

    clone
      .querySelectorAll(
        '[data-well-chart-expand]'
      )
      .forEach(element => element.remove());

    refs.body.innerHTML = '';
    refs.body.appendChild(clone);

    refs.modal.classList.remove('hidden');
    refs.modal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.classList.add(
      'well-chart-expanded-open'
    );

    const closeButton = refs.modal.querySelector(
      '[data-close-expanded-chart]'
    );

    setTimeout(() => {
      closeButton?.focus();
    }, 30);
  }

  function cerrarGrafica(){
    const refs = elementos();

    if(!refs.modal){
      return;
    }

    refs.modal.classList.add('hidden');
    refs.modal.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.classList.remove(
      'well-chart-expanded-open'
    );

    if(refs.body){
      refs.body.innerHTML = '';
    }
  }

  document.addEventListener(
    'click',
    event => {
      const expandButton = event.target.closest(
        '[data-well-chart-expand]'
      );

      if(expandButton){
        event.preventDefault();
        abrirGrafica(expandButton);
        return;
      }

      const closeButton = event.target.closest(
        '[data-close-expanded-chart]'
      );

      if(closeButton){
        event.preventDefault();
        cerrarGrafica();
      }
    }
  );

  document.addEventListener(
    'keydown',
    event => {
      if(event.key !== 'Escape'){
        return;
      }

      const modal = document.getElementById(
        'wellChartExpandedModal'
      );

      if(
        modal &&
        !modal.classList.contains('hidden')
      ){
        cerrarGrafica();
      }
    }
  );
})();

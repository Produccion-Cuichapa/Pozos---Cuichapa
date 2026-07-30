(function(){
  'use strict';

  /*
   * ========================================================
   * RESUMEN MENSUAL — INICIO
   *
   * Replica las reglas del soporte mensual:
   *
   * SUPER:
   *   REPORTE DE VISITA válido.
   *
   * NIVEL:
   *   1. NIVELES DE GUARDIA.
   *   2. REPORTE DE VISITA que fluye a FT y contiene
   *      NIVEL FRAC TANK con CTM real.
   *
   * REGISTRO:
   *   Solamente palomitas explícitas:
   *   ✅ TRABAJO
   *   ✅ DRENAR
   *   ✅ AFORO / AFORO-PROYECCIÓN
   *   ✅ INTERMITENTE
   *
   * No guarda contadores separados.
   * Siempre recalcula desde /reportes.
   * ========================================================
   */

  const POZOS_PLANTILLA = new Set(
    window.CatalogoPozos?.ids || []
  );

  const MONTH_NAMES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ];

  function toArray(snapshot){
    const rows = [];

    snapshot.forEach(child => {
      rows.push({
        id: child.key,
        ...(child.val() || {})
      });
    });

    return rows;
  }

  function messageOf(report){
    return [
      report.msg,
      report.mensaje,
      report.message,
      report.texto,
      report.whatsappText,
      report.raw
    ]
      .filter(Boolean)
      .join('\n');
  }

  function normalizeText(value){
    return String(value || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function reportDate(report){
    const candidates = [
      report.fecha,
      report.date,
      report.createdAt,
      report.timestamp,
      report.ts,
      report.fechaHora,
      report.datetime,
      report.sentAt,
      report.whatsappSentAt,
      report.horaServidor
    ];

    for(const candidate of candidates){
      if(candidate === null || candidate === undefined || candidate === ''){
        continue;
      }

      if(candidate instanceof Date && !isNaN(candidate)){
        return candidate;
      }

      if(typeof candidate === 'number'){
        const millis =
          candidate < 100000000000
            ? candidate * 1000
            : candidate;

        const date = new Date(millis);

        if(!isNaN(date)){
          return date;
        }
      }

      if(typeof candidate === 'string'){
        const clean = candidate.trim();

        if(!clean){
          continue;
        }

        const ymd = clean.match(
          /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/
        );

        if(ymd){
          const date = new Date(
            Number(ymd[1]),
            Number(ymd[2]) - 1,
            Number(ymd[3])
          );

          if(!isNaN(date)){
            return date;
          }
        }

        const dmy = clean.match(
          /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/
        );

        if(dmy){
          const date = new Date(
            Number(dmy[3]),
            Number(dmy[2]) - 1,
            Number(dmy[1])
          );

          if(!isNaN(date)){
            return date;
          }
        }

        const parsed = new Date(clean);

        if(!isNaN(parsed)){
          return parsed;
        }
      }
    }

    const message = messageOf(report);

    const messageYmd = message.match(
      /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/
    );

    if(messageYmd){
      return new Date(
        Number(messageYmd[1]),
        Number(messageYmd[2]) - 1,
        Number(messageYmd[3])
      );
    }

    const messageDmy = message.match(
      /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/
    );

    if(messageDmy){
      return new Date(
        Number(messageDmy[3]),
        Number(messageDmy[2]) - 1,
        Number(messageDmy[1])
      );
    }

    return null;
  }

  function isCurrentMonth(report, now){
    const date = reportDate(report);

    return Boolean(
      date &&
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  function wellFromReport(report, message){
    const directCandidates = [
      report.pozo,
      report.pozoNombre,
      report.well,
      report.wellName,
      report.numeroPozo,
      report.numPozo,
      report.lugar
    ];

    for(const candidate of directCandidates){
      const normalized = normalizeWell(candidate);

      if(normalized){
        return normalized;
      }
    }

    const patterns = [
      /\bPOZO\s*[:#-]?\s*([0-9]{1,3}\s*[A-Z]?)\b/i,
      /\bPZO\s*[:#-]?\s*([0-9]{1,3}\s*[A-Z]?)\b/i,
      /\bCUICHAPA\s*[- ]\s*([0-9]{1,3}\s*[A-Z]?)\b/i
    ];

    for(const pattern of patterns){
      const match = String(message || '').match(pattern);

      if(match){
        const normalized = normalizeWell(match[1]);

        if(normalized){
          return normalized;
        }
      }
    }

    return '';
  }

  function normalizeWell(value){
    const clean = normalizeText(value)
      .replace(/\bPOZO\b/g, '')
      .replace(/\bPZO\b/g, '')
      .replace(/\bCUICHAPA\b/g, '')
      .replace(/[^0-9A-Z]/g, '');

    const match = clean.match(/([0-9]{1,3}[A-Z]?)/);

    if(!match){
      return '';
    }

    const well = match[1];

    return POZOS_PLANTILLA.has(well)
      ? well
      : '';
  }

  function parsed(report){
    try{
      if(window.AdminExportaciones?.parsed){
        return window.AdminExportaciones.parsed(report) || {};
      }

      if(window.AdminUtils?.parseMsg){
        return window.AdminUtils.parseMsg(report) || {};
      }
    }catch(error){
      console.warn('[RESUMEN_MENSUAL] parseMsg:', error);
    }

    return {};
  }

  function levelCm(report){
    const direct =
      report.nivel?.ctm ||
      report.nivel?.nivel ||
      report.ctm ||
      report.nivelCtm ||
      '';

    if(String(direct).trim()){
      return String(direct).trim();
    }

    const message = messageOf(report);

    const match =
      message.match(/CTM\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i) ||
      message.match(/CENT[IÍ]METROS?\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i) ||
      message.match(/\bCM\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i);

    return match
      ? match[1]
      : '';
  }

  function hasFracTankLevel(report){
    try{
      if(window.AdminExportaciones?.hasNivelFracTank){
        return Boolean(
          window.AdminExportaciones.hasNivelFracTank(report)
        );
      }
    }catch(error){
      console.warn(
        '[RESUMEN_MENSUAL] hasNivelFracTank:',
        error
      );
    }

    const message = messageOf(report);

    const block =
      
/NIVEL\s+(?:DE\s+)?(?:FRAC\s*TANK|PRESA\s*MET[ÁA]LICA)/i.test(message);

    return block && levelCm(report) !== '';
  }

  function isFracTank(report, message){
    const data = parsed(report);

    const flow = normalizeText(
      report.co?.fluye ||
      report.fluye ||
      data.fluye ||
      ''
    );

    return Boolean(
      flow === 'FT' ||
      flow.includes('FRAC TANK') ||
      /FLUYE\s*:\s*FT\b/i.test(message) ||
      /FLUYE\s+FT\b/i.test(message)
    );
  }

  function startOfDay(date){
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  function endOfDay(date){
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
  }

  function startOfCurrentWeek(){
    const now = new Date();
    const day = now.getDay();
    const distanceToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);

    return startOfDay(monday);
  }

  function endOfCurrentWeek(){
    const sunday = startOfCurrentWeek();
    sunday.setDate(sunday.getDate() + 6);

    return endOfDay(sunday);
  }

  function parseDateInput(value, end){
    const match = String(value || '').match(
      /^(20\d{2})-(\d{2})-(\d{2})$/
    );

    if(!match){
      return null;
    }

    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );

    return end
      ? endOfDay(date)
      : startOfDay(date);
  }

  function currentMonthRange(){
    const now = new Date();

    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0
      ),

      end: new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      )
    };
  }

  function isWithinRange(report, range){
    const date = reportDate(report);

    return Boolean(
      date &&
      range?.start &&
      range?.end &&
      date >= range.start &&
      date <= range.end
    );
  }

  function calculate(rows, range){
    const totals = {
      super: 0,
      nivel: 0,
      trabajo: 0,
      drena: 0,
      aforo: 0,
      intermitente: 0,
      reportsRead: 0,
      validReports: 0
    };

    rows.forEach(report => {
      totals.reportsRead += 1;

      if(!isWithinRange(report, range)){
        return;
      }

      const rawMessage = messageOf(report);
      const message = normalizeText(rawMessage);

      const isVisit =
        message.includes('REPORTE DE VISITA');

      const isGuard =
        message.includes('NIVELES DE GUARDIA');

      if(!isVisit && !isGuard){
        return;
      }

      const well = wellFromReport(report, rawMessage);

      /*
       * Igual que el soporte mensual:
       * si el pozo no pertenece a la plantilla, no se cuenta.
       */
      if(!well){
        return;
      }

      totals.validReports += 1;

      if(isGuard){
        totals.nivel += 1;
      }

      if(!isVisit){
        return;
      }

      totals.super += 1;

      if(
        isFracTank(report, rawMessage) &&
        hasFracTankLevel(report)
      ){
        totals.nivel += 1;
      }

      if(/✅\s*TRABAJO/i.test(rawMessage)){
        totals.trabajo += 1;
      }

      if(/✅\s*DRENAR/i.test(rawMessage)){
        totals.drena += 1;
      }

      if(
        /✅\s*AFORO/i.test(rawMessage) ||
        /✅\s*AFORO\/PROYECCI[ÓO]N/i.test(rawMessage)
      ){
        totals.aforo += 1;
      }

      if(/✅\s*INTERMITENTE/i.test(rawMessage)){
        totals.intermitente += 1;
      }
    });

    return totals;
  }

  function monthLabel(){
    const now = new Date();

    return (
      MONTH_NAMES[now.getMonth()] +
      ' ' +
      now.getFullYear()
    );
  }

  function formatShortDate(date){
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatInputDate(date){
    const value = new Date(date);

    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }

  function getPeriodLabel(mode, range){
    if(mode === 'week'){
      return (
        'Semana del ' +
        formatShortDate(range.start) +
        ' al ' +
        formatShortDate(range.end)
      );
    }

    if(mode === 'custom'){
      return (
        formatShortDate(range.start) +
        ' al ' +
        formatShortDate(range.end)
      );
    }

    return monthLabel();
  }

  function updateNumber(id, value){
    const element = document.getElementById(id);

    if(element){
      element.textContent = Number(value || 0)
        .toLocaleString('es-MX');
    }
  }

  function ensurePanel(){
    let panel =
      document.getElementById('dashboardMonthlySupport');

    if(panel){
      return panel;
    }

    const anchor =
      document.getElementById('kpiReportesHoy');

    const home =
      anchor?.closest('.view') ||
      anchor?.closest('section') ||
      document.getElementById('inicioView') ||
      document.getElementById('dashboardView');

    if(!home){
      return null;
    }

    panel = document.createElement('section');
    panel.id = 'dashboardMonthlySupport';
    panel.className = 'monthly-support-panel';

    panel.innerHTML = `
      <header class="monthly-support-head">
        <div>
          <span class="monthly-support-eyebrow">
            SOPORTE OPERATIVO EN TIEMPO REAL
          </span>

          <h2>Avance operativo por periodo</h2>

          <p>
            Acumulado con las mismas reglas utilizadas para
            generar el Excel mensual.
          </p>
        </div>

        <div class="monthly-support-state">
          <span class="monthly-support-live-dot"></span>
          <div>
            <strong>Firebase en tiempo real</strong>
            <span id="monthlySupportUpdated">
              Esperando información
            </span>
          </div>
        </div>
      </header>

      <div class="monthly-support-controls">
        <div class="monthly-support-period-buttons">
          <button
            type="button"
            class="monthly-support-period-btn active"
            data-monthly-period="month">
            Mes actual
          </button>

          <button
            type="button"
            class="monthly-support-period-btn"
            data-monthly-period="week">
            Semana actual
          </button>

          <button
            type="button"
            class="monthly-support-period-btn"
            data-monthly-period="custom">
            Personalizado
          </button>
        </div>

        <div
          id="monthlySupportCustomDates"
          class="monthly-support-custom-dates hidden">

          <label>
            <span>Desde</span>
            <input
              id="monthlySupportDateFrom"
              type="date">
          </label>

          <label>
            <span>Hasta</span>
            <input
              id="monthlySupportDateTo"
              type="date">
          </label>

          <button
            id="monthlySupportApplyDates"
            type="button"
            class="monthly-support-apply-btn">
            Aplicar
          </button>
        </div>
      </div>

      <div class="monthly-support-table-wrap">
        <table class="monthly-support-table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>SUPER</th>
              <th>NIVEL</th>
              <th>TRABAJO</th>
              <th>DRENA</th>
              <th>AFORO</th>
              <th>INTERMITENTE</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <strong id="monthlySupportMonth">
                  ${monthLabel()}
                </strong>
                <span
                  id="monthlySupportPeriodSub"
                  class="monthly-support-month-sub">
                  Acumulado al día de hoy
                </span>
              </td>

              <td>
                <span
                  id="monthlySupportSuper"
                  class="monthly-support-number">
                  0
                </span>
              </td>

              <td>
                <span
                  id="monthlySupportNivel"
                  class="monthly-support-number">
                  0
                </span>
              </td>

              <td>
                <span
                  id="monthlySupportTrabajo"
                  class="monthly-support-number">
                  0
                </span>
              </td>

              <td>
                <span
                  id="monthlySupportDrena"
                  class="monthly-support-number">
                  0
                </span>
              </td>

              <td>
                <span
                  id="monthlySupportAforo"
                  class="monthly-support-number">
                  0
                </span>
              </td>

              <td>
                <span
                  id="monthlySupportIntermitente"
                  class="monthly-support-number">
                  0
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="monthly-support-footer">
        <span>
          Solo considera pozos incluidos en la plantilla del
          soporte mensual.
        </span>

        <span id="monthlySupportSource">
          Consultando reportes…
        </span>
      </footer>
    `;

    /*
     * Se coloca después de los KPI principales y antes
     * del resto de paneles de Inicio.
     */
    const preferredContainer =
      anchor?.closest('.dashboard-kpis') ||
      anchor?.closest('.stats-grid') ||
      anchor?.closest('.kpi-grid');

    if(
      preferredContainer &&
      preferredContainer.parentNode
    ){
      preferredContainer.insertAdjacentElement(
        'afterend',
        panel
      );
    }else{
      home.insertAdjacentElement(
        'afterbegin',
        panel
      );
    }

    return panel;
  }

  window.AdminDashboardMensual = {
    rows: [],
    db: null,
    initialized: false,
    currentMonthKey: '',
    mode: 'month',
    customStart: null,
    customEnd: null,

    init(){
      if(this.initialized){
        return;
      }

      this.initialized = true;

      ensurePanel();
      this.bindPeriodControls();
      this.setDefaultCustomDates();
      this.waitForFirebase();

      /*
       * Detecta el cambio de mes aun cuando el Admin permanezca
       * abierto durante la medianoche del último día.
       */
      this.monthTimer = window.setInterval(() => {
        const key = this.getMonthKey();

        if(key !== this.currentMonthKey){
          this.currentMonthKey = key;
          this.render();
        }
      }, 60000);
    },

    bindPeriodControls(){
      document
        .querySelectorAll('[data-monthly-period]')
        .forEach(button => {
          button.addEventListener('click', () => {
            this.setMode(
              button.dataset.monthlyPeriod || 'month'
            );
          });
        });

      document
        .getElementById('monthlySupportApplyDates')
        ?.addEventListener('click', () => {
          this.applyCustomDates();
        });

      document
        .getElementById('monthlySupportDateFrom')
        ?.addEventListener('change', () => {
          this.validateCustomDates();
        });

      document
        .getElementById('monthlySupportDateTo')
        ?.addEventListener('change', () => {
          this.validateCustomDates();
        });
    },

    setDefaultCustomDates(){
      const range = currentMonthRange();

      const from =
        document.getElementById('monthlySupportDateFrom');

      const to =
        document.getElementById('monthlySupportDateTo');

      if(from){
        from.value = formatInputDate(range.start);
      }

      if(to){
        to.value = formatInputDate(new Date());
      }

      this.customStart = range.start;
      this.customEnd = endOfDay(new Date());
    },

    setMode(mode){
      this.mode = mode;

      document
        .querySelectorAll('[data-monthly-period]')
        .forEach(button => {
          button.classList.toggle(
            'active',
            button.dataset.monthlyPeriod === mode
          );
        });

      const customPanel =
        document.getElementById('monthlySupportCustomDates');

      if(customPanel){
        customPanel.classList.toggle(
          'hidden',
          mode !== 'custom'
        );
      }

      if(mode !== 'custom'){
        this.render();
      }
    },

    validateCustomDates(){
      const fromValue =
        document.getElementById(
          'monthlySupportDateFrom'
        )?.value;

      const toValue =
        document.getElementById(
          'monthlySupportDateTo'
        )?.value;

      const start = parseDateInput(fromValue, false);
      const end = parseDateInput(toValue, true);

      const button =
        document.getElementById(
          'monthlySupportApplyDates'
        );

      const valid =
        Boolean(start && end && start <= end);

      if(button){
        button.disabled = !valid;
      }

      return {
        valid,
        start,
        end
      };
    },

    applyCustomDates(){
      const result = this.validateCustomDates();

      if(!result.valid){
        window.alert(
          'La fecha inicial debe ser anterior o igual a la fecha final.'
        );
        return;
      }

      this.customStart = result.start;
      this.customEnd = result.end;
      this.render();
    },

    getActiveRange(){
      if(this.mode === 'week'){
        return {
          start: startOfCurrentWeek(),
          end: endOfCurrentWeek()
        };
      }

      if(this.mode === 'custom'){
        return {
          start:
            this.customStart ||
            currentMonthRange().start,

          end:
            this.customEnd ||
            endOfDay(new Date())
        };
      }

      return currentMonthRange();
    },

    getMonthKey(){
      const now = new Date();

      return (
        now.getFullYear() +
        '-' +
        String(now.getMonth() + 1).padStart(2, '0')
      );
    },

    waitForFirebase(){
      let attempts = 0;

      const timer = window.setInterval(() => {
        attempts += 1;

        const db = window.AdminFirebase?.db;

        if(db){
          window.clearInterval(timer);

          this.db = db;
          this.currentMonthKey = this.getMonthKey();
          this.listen();

          return;
        }

        if(attempts >= 60){
          window.clearInterval(timer);
          this.showError(
            'No fue posible conectar el resumen mensual.'
          );
        }
      }, 500);
    },

    listen(){
      if(!this.db){
        return;
      }

      /*
       * Se escucha /reportes directamente para que el resumen:
       * - no dependa del limitToLast del resto del Admin;
       * - incluya todo el mes;
       * - se actualice al agregar, corregir o eliminar reportes.
       */
      this.db.ref('reportes').on(
        'value',
        snapshot => {
          this.rows = toArray(snapshot);
          this.render();
        },
        error => {
          console.error(
            '[RESUMEN_MENSUAL] Firebase:',
            error
          );

          this.showError(
            'No se pudo actualizar el acumulado mensual.'
          );
        }
      );
    },

    render(){
      const panel = ensurePanel();

      if(!panel){
        return;
      }

      const range = this.getActiveRange();
      const totals = calculate(this.rows, range);

      const monthElement =
        document.getElementById('monthlySupportMonth');

      if(monthElement){
        monthElement.textContent =
          getPeriodLabel(this.mode, range);
      }

      const periodSub =
        document.getElementById(
          'monthlySupportPeriodSub'
        );

      if(periodSub){
        periodSub.textContent =
          this.mode === 'month'
            ? 'Acumulado del mes actual'
            : this.mode === 'week'
              ? 'Semana de lunes a domingo'
              : 'Rango personalizado';
      }

      updateNumber(
        'monthlySupportSuper',
        totals.super
      );

      updateNumber(
        'monthlySupportNivel',
        totals.nivel
      );

      updateNumber(
        'monthlySupportTrabajo',
        totals.trabajo
      );

      updateNumber(
        'monthlySupportDrena',
        totals.drena
      );

      updateNumber(
        'monthlySupportAforo',
        totals.aforo
      );

      updateNumber(
        'monthlySupportIntermitente',
        totals.intermitente
      );

      const source =
        document.getElementById('monthlySupportSource');

      if(source){
        source.textContent =
          totals.validReports.toLocaleString('es-MX') +
          ' reportes válidos del mes';
      }

      const updated =
        document.getElementById('monthlySupportUpdated');

      if(updated){
        updated.textContent =
          'Actualizado ' +
          new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
      }
    },

    showError(message){
      ensurePanel();

      const updated =
        document.getElementById('monthlySupportUpdated');

      if(updated){
        updated.textContent = message;
      }
    }
  };

  function start(){
    window.AdminDashboardMensual.init();
  }

  if(document.readyState === 'loading'){
    document.addEventListener(
      'DOMContentLoaded',
      start
    );
  }else{
    start();
  }

  /*
   * ========================================================
   * DESGLOSE_PLEGABLE_RECORREDORES_V1
   *
   * Desglose opcional del avance operativo.
   * Reutiliza calculate() para conservar exactamente las
   * mismas reglas del soporte mensual.
   *
   * Recorredores incluidos:
   *   - Manrique
   *   - Juan Carlos
   *   - Luis Carlos
   *
   * Cirilo queda excluido.
   * ========================================================
   */

  const MONTHLY_ACTIVE_WORKERS = [
    {
      key: 'manrique',
      label: 'Manrique',
      aliases: [
        'MANRIQUE'
      ]
    },
    {
      key: 'juan-carlos',
      label: 'Juan Carlos',
      aliases: [
        'JUAN CARLOS',
        'JUAN CARLOS FLORES'
      ]
    },
    {
      key: 'luis-carlos',
      label: 'Luis Carlos',
      aliases: [
        'LUIS CARLOS',
        'LUIS CARLOS FLORES',
        'LUIS CARLOS FLORES CRUZ'
      ]
    }
  ];

  function reportWorkerText(report){
    return normalizeText([
      report.recorredor,
      report.recorredorNombre,
      report.nombreRecorredor,
      report.usuario,
      report.user,
      report.userName,
      report.username,
      report.nombre,
      report.operador,
      report.reportadoPor,
      report.enviadoPor,
      report.autor,
      report.createdBy,
      report.profile,
      messageOf(report)
    ]
      .filter(Boolean)
      .join(' | '));
  }

  function workerFromReport(report){
    const text = reportWorkerText(report);

    if(!text){
      return '';
    }

    /*
     * Se evalúan primero los nombres compuestos para evitar
     * coincidencias ambiguas.
     */
    for(const worker of MONTHLY_ACTIVE_WORKERS){
      if(
        worker.aliases.some(alias =>
          text.includes(normalizeText(alias))
        )
      ){
        return worker.key;
      }
    }

    return '';
  }

  function monthlyCurrentRange(controller){
    if(controller.mode === 'week'){
      return {
        start: startOfCurrentWeek(),
        end: endOfCurrentWeek()
      };
    }

    if(controller.mode === 'custom'){
      const fromInput =
        document.getElementById('monthlySupportDateFrom');

      const toInput =
        document.getElementById('monthlySupportDateTo');

      const start =
        parseDateInput(fromInput?.value, false) ||
        controller.customStart;

      const end =
        parseDateInput(toInput?.value, true) ||
        controller.customEnd;

      if(start && end){
        return { start, end };
      }
    }

    return currentMonthRange();
  }

  function ensureMonthlyWorkerBreakdown(){
    const panel =
      document.getElementById('dashboardMonthlySupport');

    if(!panel){
      return null;
    }

    let section =
      document.getElementById(
        'monthlySupportWorkerBreakdown'
      );

    if(section){
      return section;
    }

    const footer =
      panel.querySelector('.monthly-support-footer');

    section = document.createElement('section');
    section.id = 'monthlySupportWorkerBreakdown';
    section.className =
      'monthly-worker-breakdown is-collapsed';

    section.innerHTML = `
      <button
        id="monthlyWorkerToggle"
        type="button"
        class="monthly-worker-toggle"
        aria-expanded="false"
        aria-controls="monthlyWorkerContent">

        <span class="monthly-worker-toggle-main">
          <span class="monthly-worker-toggle-icon">
            ▦
          </span>

          <span>
            Ver desglose por recorredor
          </span>

          <span class="monthly-worker-count">
            ${MONTHLY_ACTIVE_WORKERS.length}
          </span>
        </span>

        <span
          id="monthlyWorkerToggleArrow"
          class="monthly-worker-toggle-arrow"
          aria-hidden="true">
          ▾
        </span>
      </button>

      <div
        id="monthlyWorkerContent"
        class="monthly-worker-content"
        aria-hidden="true">

        <div class="monthly-worker-heading">
          <div>
            <strong>Desglose por recorredor</strong>
            <span id="monthlyWorkerPeriodLabel">
              Periodo seleccionado
            </span>
          </div>

          <span>
            Mismas reglas del soporte mensual
          </span>
        </div>

        <div class="monthly-worker-table-wrap">
          <table class="monthly-worker-table">
            <thead>
              <tr>
                <th>Recorredor</th>
                <th>SUPER</th>
                <th>NIVEL</th>
                <th>TRABAJO</th>
                <th>DRENA</th>
                <th>AFORO</th>
                <th>INTERMITENTE</th>
              </tr>
            </thead>

            <tbody id="monthlyWorkerTableBody">
              ${MONTHLY_ACTIVE_WORKERS.map(worker => `
                <tr data-monthly-worker="${worker.key}">
                  <td>
                    <strong>${worker.label}</strong>
                  </td>

                  <td data-worker-value="super">0</td>
                  <td data-worker-value="nivel">0</td>
                  <td data-worker-value="trabajo">0</td>
                  <td data-worker-value="drena">0</td>
                  <td data-worker-value="aforo">0</td>
                  <td data-worker-value="intermitente">0</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if(footer){
      footer.insertAdjacentElement(
        'beforebegin',
        section
      );
    }else{
      panel.appendChild(section);
    }

    return section;
  }

  function bindMonthlyWorkerToggle(controller){
    const button =
      document.getElementById('monthlyWorkerToggle');

    if(!button || button.dataset.bound === '1'){
      return;
    }

    button.dataset.bound = '1';

    button.addEventListener('click', () => {
      controller.workerBreakdownOpen =
        !controller.workerBreakdownOpen;

      updateMonthlyWorkerVisibility(controller);

      if(controller.workerBreakdownOpen){
        renderMonthlyWorkerBreakdown(controller);
      }
    });
  }

  function updateMonthlyWorkerVisibility(controller){
    const section =
      ensureMonthlyWorkerBreakdown();

    const button =
      document.getElementById('monthlyWorkerToggle');

    const content =
      document.getElementById('monthlyWorkerContent');

    const arrow =
      document.getElementById('monthlyWorkerToggleArrow');

    if(!section || !button || !content){
      return;
    }

    const open =
      Boolean(controller.workerBreakdownOpen);

    section.classList.toggle(
      'is-collapsed',
      !open
    );

    section.classList.toggle(
      'is-open',
      open
    );

    button.setAttribute(
      'aria-expanded',
      open ? 'true' : 'false'
    );

    content.setAttribute(
      'aria-hidden',
      open ? 'false' : 'true'
    );

    const text =
      button.querySelector(
        '.monthly-worker-toggle-main > span:nth-child(2)'
      );

    if(text){
      text.textContent = open
        ? 'Ocultar desglose por recorredor'
        : 'Ver desglose por recorredor';
    }

    if(arrow){
      arrow.textContent = open ? '▴' : '▾';
    }
  }

  function setMonthlyWorkerValue(
    workerKey,
    metric,
    value
  ){
    const cell = document.querySelector(
      `[data-monthly-worker="${workerKey}"] ` +
      `[data-worker-value="${metric}"]`
    );

    if(cell){
      cell.textContent =
        Number(value || 0).toLocaleString('es-MX');
    }
  }

  function renderMonthlyWorkerBreakdown(controller){
    ensureMonthlyWorkerBreakdown();

    /*
     * Mientras está cerrado no se hace el cálculo adicional.
     * Esto mantiene limpio y ligero el Dashboard.
     */
    if(!controller.workerBreakdownOpen){
      return;
    }

    const range =
      monthlyCurrentRange(controller);

    if(
      !range?.start ||
      !range?.end
    ){
      return;
    }

    const rows =
      Array.isArray(controller.rows)
        ? controller.rows
        : [];

    MONTHLY_ACTIVE_WORKERS.forEach(worker => {
      const workerRows = rows.filter(report =>
        workerFromReport(report) === worker.key
      );

      /*
       * Se reutiliza la función principal calculate().
       * No se duplican ni se reinterpretan las reglas.
       */
      const totals = calculate(
        workerRows,
        range
      );

      [
        'super',
        'nivel',
        'trabajo',
        'drena',
        'aforo',
        'intermitente'
      ].forEach(metric => {
        setMonthlyWorkerValue(
          worker.key,
          metric,
          totals[metric]
        );
      });
    });

    const periodLabel =
      document.getElementById(
        'monthlyWorkerPeriodLabel'
      );

    if(periodLabel){
      periodLabel.textContent =
        getPeriodLabel(
          controller.mode,
          range
        );
    }
  }

  /*
   * Se extiende el controlador existente sin sustituir
   * su lógica original.
   */
  if(window.AdminDashboardMensual){
    const dashboardMonthly =
      window.AdminDashboardMensual;

    dashboardMonthly.workerBreakdownOpen = false;

    const originalInit =
      dashboardMonthly.init;

    dashboardMonthly.init = function(){
      const result =
        originalInit.apply(this, arguments);

      ensureMonthlyWorkerBreakdown();
      bindMonthlyWorkerToggle(this);
      updateMonthlyWorkerVisibility(this);

      return result;
    };

    const originalRender =
      dashboardMonthly.render;

    if(typeof originalRender === 'function'){
      dashboardMonthly.render = function(){
        const result =
          originalRender.apply(this, arguments);

        ensureMonthlyWorkerBreakdown();
        bindMonthlyWorkerToggle(this);
        updateMonthlyWorkerVisibility(this);
        renderMonthlyWorkerBreakdown(this);

        return result;
      };
    }
  }

})();

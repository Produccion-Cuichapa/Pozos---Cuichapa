window.AdminPozos = {
  viewMode: 'cards',
  rows: [],
  selectedMapWell: null,

  init(){
    /*
     * Los filtros trabajan sobre this.rows, que ya contiene
     * los datos construidos desde Firebase.
     *
     * No es necesario ejecutar buildRows() al escribir cada
     * letra o cambiar una opción.
     */
    document.getElementById('wellSearch')
      ?.addEventListener('input', () => this.renderView());

    document.getElementById('wellStatusFilter')
      ?.addEventListener('change', () => this.renderView());

    document.getElementById('wellSapFilter')
      ?.addEventListener('change', () => this.renderView());

    document.getElementById('wellClearFilters')
      ?.addEventListener('click', () => {
        const search = document.getElementById('wellSearch');
        const status = document.getElementById('wellStatusFilter');
        const sap = document.getElementById('wellSapFilter');

        if(search) search.value = '';
        if(status) status.value = 'all';
        if(sap) sap.value = 'all';

        this.renderView();
      });

    this.bindPriorityActions();

    /*
     * Evento delegado para los botones de Gráficas.
     * Funciona aunque tarjetas, tabla o mapa se vuelvan
     * a renderizar después de cargar Firebase.
     */
    document.addEventListener('click', event => {
      const button = event.target.closest(
        '[data-well-charts], [data-map-open-charts]'
      );

      if(!button) return;

      event.preventDefault();
      event.stopPropagation();

      const well =
        button.dataset.wellCharts ||
        button.dataset.mapOpenCharts ||
        '';

      const row = this.rows.find(item =>
        String(item.well) === String(well)
      );

      if(!row){
        console.error(
          'Gráficas: no se encontró el pozo',
          well
        );

        alert(
          'No fue posible localizar la información del pozo.'
        );

        return;
      }

      if(!Array.isArray(row.reports) || !row.reports.length){
        alert(
          'Este pozo todavía no tiene reportes para graficar.'
        );

        return;
      }

      if(
        !window.AdminGraficas ||
        typeof AdminGraficas.open !== 'function'
      ){
        console.error(
          'Gráficas: AdminGraficas no está disponible.'
        );

        alert(
          'El módulo de gráficas no terminó de cargar. Actualiza la página.'
        );

        return;
      }

      AdminGraficas.open(row);
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
    if(!window.CatalogoPozos || !Array.isArray(window.CatalogoPozos.ids)) return [];
    return [...window.CatalogoPozos.ids].sort((a,b) => this.wellSort(a,b));
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

  normalizeSap(value){
    const raw = String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[.\s_-]+/g, '');

    if(!raw) return '';

    if(
      raw === 'BM' ||
      raw.includes('BOMBEO MECANICO') ||
      raw.includes('BOMBEOMECANICO')
    ){
      return 'BM';
    }

    if(
      raw === 'BN' ||
      raw.includes('BOMBEO NEUMATICO') ||
      raw.includes('BOMBEONEUMATICO')
    ){
      return 'BN';
    }

    if(
      raw === 'FY' ||
      raw === 'FLUYENTE' ||
      raw.includes('FLUYE NATURAL') ||
      raw.includes('FLUYENATURAL')
    ){
      return 'FY';
    }

    return String(value || '')
      .trim()
      .toUpperCase();
  },

  latestSap(reports){
    if(!Array.isArray(reports)){
      return '';
    }

    /*
     * wellReports ya viene ordenado del reporte más reciente
     * al más antiguo. Se toma el primer SAP válido encontrado.
     */
    for(const report of reports){
      const value = this.normalizeSap(
        this.field(report, 'sap')
      );

      if(value){
        return value;
      }
    }

    /*
     * Respaldo para reportes donde SAP solamente quedó
     * escrito dentro del mensaje.
     */
    for(const report of reports){
      const message = String(
        report?.msg ||
        report?.mensaje ||
        report?.message ||
        report?.texto ||
        ''
      );

      const match = message.match(
        /\bSAP\s*[:=-]?\s*(BM|BN|FY|BOMBEO\s+MEC[AÁ]NICO|BOMBEO\s+NEUM[AÁ]TICO|FLUYENTE)\b/i
      );

      if(match){
        const value = this.normalizeSap(match[1]);

        if(value){
          return value;
        }
      }
    }

    return '';
  },

  normalizeWellState(value){
    const raw = String(value || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if(!raw){
      return '';
    }

    if(
      raw === 'ABIERTO' ||
      raw === 'ABIERTA' ||
      raw === 'OPERANDO' ||
      raw === 'OPERATIVO' ||
      raw === 'EN OPERACION'
    ){
      return 'ABIERTO';
    }

    if(
      raw === 'CERRADO' ||
      raw === 'CERRADA' ||
      raw === 'FUERA DE OPERACION'
    ){
      return 'CERRADO';
    }

    if(
      raw === 'INTERMITENTE' ||
      raw === 'INTERMITENCIA'
    ){
      return 'INTERMITENTE';
    }

    return '';
  },

  reportWellState(report){
    if(!report){
      return '';
    }

    const parsed = (() => {
      try{
        return (
          window.AdminUtils &&
          typeof AdminUtils.parseMsg === 'function'
        )
          ? AdminUtils.parseMsg(report) || {}
          : {};
      }catch(error){
        return {};
      }
    })();

    const co = report.co || {};

    /*
     * Se revisan todos los nombres de campo utilizados
     * históricamente por la aplicación.
     */
    const candidates = [
      report.estadoPozo,
      report.estado_pozo,
      report.estado,
      report.estatusPozo,
      report.estatus_pozo,
      co.estadoPozo,
      co.estado_pozo,
      co.estado,
      co.estatusPozo,
      parsed.estadoPozo,
      parsed.estado_pozo,
      parsed.estado,
      parsed.estatusPozo
    ];

    for(const candidate of candidates){
      const state = this.normalizeWellState(candidate);

      if(state){
        return state;
      }
    }

    /*
     * También se utiliza this.field(), porque ya es el
     * lector oficial empleado por el módulo Pozos.
     */
    for(const fieldName of [
      'estadoPozo',
      'estado_pozo',
      'estado',
      'estatusPozo'
    ]){
      const state = this.normalizeWellState(
        this.field(report, fieldName)
      );

      if(state){
        return state;
      }
    }

    /*
     * Respaldo para reportes donde el estado solamente
     * quedó escrito dentro del mensaje de WhatsApp.
     */
    const message = String(
      report.msg ||
      report.mensaje ||
      report.message ||
      report.texto ||
      ''
    );

    const labeledMatch = message.match(
      /(?:ESTADO(?:\s+DEL)?\s+POZO|ESTATUS(?:\s+DEL)?\s+POZO)\s*[:=-]?\s*(ABIERTO|CERRADO|INTERMITENTE)\b/i
    );

    if(labeledMatch){
      return this.normalizeWellState(
        labeledMatch[1]
      );
    }

    /*
     * Respaldo adicional para el bloque nuevo de selección:
     * ✅ ABIERTO / ✅ CERRADO / ✅ INTERMITENTE
     */
    const checkedMatch = message.match(
      /(?:✅|☑️?|✔️?)\s*(ABIERTO|CERRADO|INTERMITENTE)\b/i
    );

    if(checkedMatch){
      return this.normalizeWellState(
        checkedMatch[1]
      );
    }

    return '';
  },

  latestWellStateData(reports){
    if(!Array.isArray(reports)){
      return {
        value: '',
        report: null
      };
    }

    /*
     * wellReports está ordenado del más reciente al más
     * antiguo. Por eso el primer estado encontrado es el
     * último estado válido conocido del pozo.
     */
    for(const report of reports){
      const value = this.reportWellState(report);

      if(value){
        return {
          value,
          report
        };
      }
    }

    return {
      value: '',
      report: null
    };
  },

  historicalStatus(stateData, latest, visitedToday){
    const value = stateData?.value || '';

    if(value === 'ABIERTO'){
      return {
        key: 'operating',
        label: 'Abierto'
      };
    }

    if(value === 'CERRADO'){
      return {
        key: 'closed',
        label: 'Cerrado'
      };
    }

    if(value === 'INTERMITENTE'){
      return {
        key: 'intermittent',
        label: 'Intermitente'
      };
    }

    /*
     * Si nunca se ha registrado un estado explícito,
     * se conserva la lógica anterior del sistema.
     */
    return this.operationalStatus(
      latest,
      visitedToday
    );
  },

  buildRows(){
    const reports = window.AdminFirebase.reportes || [];
    const alarms = window.AdminFirebase.alarmas || [];
    const today = this.todayKey();

    /*
     * =====================================================
     * OPTIMIZACIÓN DE RENDIMIENTO
     * -----------------------------------------------------
     * Antes:
     *   Cada pozo recorría TODOS los reportes y alarmas.
     *
     * Ahora:
     *   Se construyen índices una sola vez y cada pozo
     *   consulta únicamente su arreglo correspondiente.
     * =====================================================
     */

    const reportIndex = Object.create(null);

    for(const report of reports){
      const well = this.reportWell(report);

      if(!well || !window.CatalogoPozos?.existe(well)) continue;

      (reportIndex[well] ||= []).push(report);
    }

    for(const well in reportIndex){
      reportIndex[well].sort(
        (a,b)=>
          AdminUtils.getTime(b)-
          AdminUtils.getTime(a)
      );
    }

    const alarmIndex = Object.create(null);

    for(const alarm of alarms){
      const well = this.alarmWell(alarm);

      if(!well || !window.CatalogoPozos?.existe(well)) continue;

      (alarmIndex[well] ||= []).push(alarm);
    }

    return this.catalog().map(well => {
      const wellReports =
        reportIndex[well] || [];

      const wellAlarms =
        alarmIndex[well] || [];

      const latest = this.latestReport(wellReports);

      const visitedToday = wellReports.some(report =>
        this.rowDate(report) === today
      );

      const stateData =
        this.latestWellStateData(wellReports);

      const status =
        this.historicalStatus(
          stateData,
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

        /*
         * Estado explícito más reciente del historial.
         */
        estadoPozo: stateData.value,
        estadoPozoReport: stateData.report,

        /*
         * Se conserva el estatus operativo tradicional
         * para no afectar otras funciones del expediente.
         */
        estatus: this.field(latest, 'estatus'),

        sap: this.latestSap(wellReports),
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
    }).map(row => ({
      ...row,
      risk: this.riskData(row)
    }));
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

    const sapFilterRaw =
      document.getElementById('wellSapFilter')
        ?.value || 'all';

    const sapFilter =
      sapFilterRaw === 'all'
        ? 'all'
        : this.normalizeSap(sapFilterRaw);

    return this.rows.filter(row => {
      if(search){
        const haystack = [
          row.well,
          row.person,
          row.estadoPozo,
          row.status?.label,
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

  wellStatusChanges(row){
    const reports = (row.reports || [])
      .slice()
      .sort(
        (a, b) =>
          AdminUtils.getTime(a) -
          AdminUtils.getTime(b)
      );

    let changes = 0;
    let previous = '';

    reports.forEach(report => {
      const current = String(
        this.field(report, 'estatus') || ''
      )
        .trim()
        .toLowerCase();

      if(
        previous &&
        current &&
        previous !== current
      ){
        changes++;
      }

      if(current){
        previous = current;
      }
    });

    return changes;
  },

  wellGpsCoverage(row){
    const reports = row.reports || [];

    if(!reports.length){
      return 0;
    }

    const withGps = reports.filter(report =>
      AdminUtils.hasGps(report)
    ).length;

    return Math.round(
      (withGps / reports.length) * 100
    );
  },

  riskData(row){
    const now = Date.now();

    const ageHours = row.lastTime
      ? Math.max(
          0,
          (now - row.lastTime) /
          (60 * 60 * 1000)
        )
      : null;

    const gpsCoverage =
      this.wellGpsCoverage(row);

    const statusChanges =
      this.wellStatusChanges(row);

    let score = 0;
    const factors = [];

    // Sin historial operativo.
    if(!row.latest){
      score += 45;
      factors.push({
        key: 'no-data',
        label: 'Sin reportes registrados',
        points: 45
      });
    }

    // Antigüedad de la última visita.
    if(ageHours !== null){
      if(ageHours >= 168){
        score += 35;
        factors.push({
          key: 'overdue',
          label: 'Más de 7 días sin visita',
          points: 35
        });
      }else if(ageHours >= 72){
        score += 28;
        factors.push({
          key: 'overdue',
          label: 'Más de 3 días sin visita',
          points: 28
        });
      }else if(ageHours >= 24){
        score += 20;
        factors.push({
          key: 'overdue',
          label: 'Más de 24 horas sin visita',
          points: 20
        });
      }else if(ageHours >= 8){
        score += 10;
        factors.push({
          key: 'overdue',
          label: 'Más de 8 horas sin visita',
          points: 10
        });
      }
    }

    // Alarmas.
    if(row.alarms.length){
      const alarmPoints = Math.min(
        30,
        row.alarms.length * 10
      );

      score += alarmPoints;

      factors.push({
        key: 'alarms',
        label:
          `${row.alarms.length} ${
            row.alarms.length === 1
              ? 'alarma relacionada'
              : 'alarmas relacionadas'
          }`,
        points: alarmPoints
      });
    }

    // Condición operativa.
    if(row.status.key === 'closed'){
      score += 15;
      factors.push({
        key: 'closed',
        label: 'Último estatus cerrado',
        points: 15
      });
    }

    if(row.status.key === 'intermittent'){
      score += 12;
      factors.push({
        key: 'intermittent',
        label: 'Pozo intermitente',
        points: 12
      });
    }

    // Calidad del registro.
    if(row.latest && !row.gps){
      score += 10;
      factors.push({
        key: 'gps',
        label: 'Último reporte sin GPS',
        points: 10
      });
    }

    if(
      row.reports.length >= 3 &&
      gpsCoverage < 70
    ){
      score += 8;
      factors.push({
        key: 'gps-coverage',
        label:
          `Cobertura GPS histórica de ${gpsCoverage}%`,
        points: 8
      });
    }

    if(row.latest && !row.estatus){
      score += 7;
      factors.push({
        key: 'status',
        label: 'Sin estatus operativo',
        points: 7
      });
    }

    // Variabilidad del estatus.
    if(statusChanges >= 4){
      score += 12;
      factors.push({
        key: 'changes',
        label:
          `${statusChanges} cambios de estatus`,
        points: 12
      });
    }else if(statusChanges >= 2){
      score += 6;
      factors.push({
        key: 'changes',
        label:
          `${statusChanges} cambios de estatus`,
        points: 6
      });
    }

    score = Math.max(
      0,
      Math.min(100, Math.round(score))
    );

    let level = 'low';
    let label = 'Bajo';

    if(score >= 75){
      level = 'critical';
      label = 'Crítico';
    }else if(score >= 50){
      level = 'high';
      label = 'Alto';
    }else if(score >= 25){
      level = 'medium';
      label = 'Medio';
    }

    return {
      score,
      level,
      label,
      factors: factors.sort(
        (a, b) => b.points - a.points
      ),
      ageHours,
      gpsCoverage,
      statusChanges
    };
  },

  riskBadge(row, compact=false){
    const risk = row.risk || this.riskData(row);

    return `
      <span
        class="
          well-risk-badge
          risk-${risk.level}
          ${compact ? 'is-compact' : ''}
        "
        title="${AdminUtils.escapeHtml(
          risk.factors
            .slice(0, 4)
            .map(item => item.label)
            .join(' · ') ||
          'Sin factores de riesgo relevantes'
        )}">

        <span class="well-risk-score">
          ${risk.score}
        </span>

        <span class="well-risk-text">
          Riesgo ${AdminUtils.escapeHtml(risk.label)}
        </span>
      </span>
    `;
  },

  priorityData(row){
    const risk = row.risk || this.riskData(row);

    let level = 'normal';
    let label = 'Normal';

    if(risk.score >= 50){
      level = 'critical';
      label = 'Atención alta';
    }else if(risk.score >= 25){
      level = 'warning';
      label = 'Vigilancia';
    }

    return {
      score: risk.score,
      level,
      label,
      reasons: risk.factors.map(
        factor => factor.label
      ),
      ageHours: risk.ageHours,
      riskLevel: risk.level,
      gpsCoverage: risk.gpsCoverage,
      statusChanges: risk.statusChanges
    };
  },

  priorityRows(){
    return this.rows
      .map(row => ({
        ...row,
        priority: this.priorityData(row)
      }))
      .filter(row =>
        row.priority.level !== 'normal'
      )
      .sort((a, b) => {
        if(b.priority.score !== a.priority.score){
          return b.priority.score - a.priority.score;
        }

        return a.wellSort
          ? a.wellSort
          : this.wellSort(a.well, b.well);
      });
  },

  renderPriorities(){
    const rows = this.priorityRows();
    const container =
      document.getElementById('wellPriorityList');

    if(!container) return;

    const critical = rows.filter(row =>
      row.priority.level === 'critical'
    ).length;

    const warning = rows.filter(row =>
      row.priority.level === 'warning'
    ).length;

    const overdue = this.rows.filter(row =>
      row.lastTime &&
      Date.now() - row.lastTime >=
        24 * 60 * 60 * 1000
    ).length;

    const noData = this.rows.filter(row =>
      !row.latest
    ).length;

    this.setText('wellPriorityCritical', critical);
    this.setText('wellPriorityWarning', warning);
    this.setText('wellPriorityOverdue', overdue);
    this.setText('wellPriorityNoData', noData);

    const visible = rows.slice(0, 6);

    if(!visible.length){
      container.innerHTML = `
        <div class="well-priority-empty">
          <b>Sin prioridades operativas</b>
          <span>
            No se detectaron pozos que requieran seguimiento.
          </span>
        </div>
      `;
      return;
    }

    container.innerHTML = visible.map(row => `
      <article class="
        well-priority-card
        priority-${row.priority.level}
      ">
        <div class="well-priority-rank">
          ${row.priority.score}
        </div>

        <div class="well-priority-main">
          <div class="well-priority-title">
            <b>Pozo ${AdminUtils.escapeHtml(row.well)}</b>

            <span>
              ${AdminUtils.escapeHtml(row.priority.label)}
            </span>
          </div>

          <p>
            ${AdminUtils.escapeHtml(
              row.priority.reasons.slice(0, 3).join(' · ')
            )}
          </p>

          <small>
            ${
              row.latest
                ? `${AdminUtils.escapeHtml(
                    AdminUtils.fmtDate(row.latest)
                  )} · ${AdminUtils.escapeHtml(
                    AdminUtils.fmtTime(row.latest)
                  )}`
                : 'Sin visita registrada'
            }

            ${
              row.person
                ? ` · ${AdminUtils.escapeHtml(row.person)}`
                : ''
            }
          </small>
        </div>

        <button
          type="button"
          class="well-priority-open"
          data-priority-well="${AdminUtils.escapeHtml(row.well)}">
          Revisar
        </button>
      </article>
    `).join('');

    container.querySelectorAll('[data-priority-well]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const row = this.rows.find(item =>
            String(item.well) ===
            String(button.dataset.priorityWell)
          );

          if(!row) return;

          // Todos los prioritarios se revisan primero en el mapa.
          // Desde el panel lateral se abre el expediente cuando existe.
          this.selectedMapWell = row.well;
          this.viewMode = 'map';

          this.applyViewMode();
          this.renderMap(this.filteredRows());
          this.renderMapInspector(row);

          document.getElementById('wellsMapView')
            ?.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
        });
      });
  },

  bindPriorityActions(){
    document.getElementById('wellShowAllPriorities')
      ?.addEventListener('click', () => {
        const status =
          document.getElementById('wellStatusFilter');

        if(status){
          status.value = 'attention';
        }

        this.viewMode = 'table';
        this.renderView();
      });
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

          <div class="well-card-header-status">
            ${this.statusBadge(row)}
            ${this.riskBadge(row, true)}
          </div>
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
              class="well-chart-btn"
              data-well-charts="${AdminUtils.escapeHtml(row.well)}"
              ${row.reports.length ? '' : 'disabled'}>
              Gráficas
            </button>

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
          <td colspan="11">
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
          ${this.riskBadge(row, true)}
        </td>

        <td>
          <div class="well-table-actions">
            <button
              type="button"
              class="well-chart-btn"
              data-well-charts="${AdminUtils.escapeHtml(row.well)}"
              ${row.reports.length ? '' : 'disabled'}>
              Gráficas
            </button>

            <button
              type="button"
              class="well-open-btn"
              data-well-open="${AdminUtils.escapeHtml(row.well)}"
              ${row.latest ? '' : 'disabled'}>
              Ver
            </button>
          </div>
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

          this.openWellExpedient(row);
        });
      });

    container.querySelectorAll('[data-well-charts]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const well =
            button.dataset.wellCharts;

          const row = this.rows.find(item =>
            String(item.well) === String(well)
          );

          if(!row?.reports?.length) return;

          if(window.AdminGraficas){
            AdminGraficas.open(row);
          }
        });
      });
  },

  mapRows(rows){
    return rows.filter(row =>
      row.coords &&
      Number.isFinite(Number(row.coords.lat)) &&
      Number.isFinite(Number(row.coords.lon))
    );
  },

  mapBounds(rows){
    const valid = this.mapRows(rows);

    if(!valid.length){
      return null;
    }

    const lats = valid.map(row =>
      Number(row.coords.lat)
    );

    const lons = valid.map(row =>
      Number(row.coords.lon)
    );

    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLon = Math.min(...lons);
    let maxLon = Math.max(...lons);

    if(minLat === maxLat){
      minLat -= 0.001;
      maxLat += 0.001;
    }

    if(minLon === maxLon){
      minLon -= 0.001;
      maxLon += 0.001;
    }

    const latPad = (maxLat - minLat) * 0.07;
    const lonPad = (maxLon - minLon) * 0.07;

    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLon: minLon - lonPad,
      maxLon: maxLon + lonPad
    };
  },

  mapPosition(row, bounds){
    const lat = Number(row.coords.lat);
    const lon = Number(row.coords.lon);

    const x =
      ((lon - bounds.minLon) /
      (bounds.maxLon - bounds.minLon)) * 100;

    const y =
      100 -
      ((lat - bounds.minLat) /
      (bounds.maxLat - bounds.minLat)) * 100;

    return {
      x: Math.max(2, Math.min(98, x)),
      y: Math.max(2, Math.min(98, y))
    };
  },

  mapMarkerClass(row){
    const key = row.status?.key || 'unknown';

    if(key === 'operating') return 'operating';
    if(key === 'intermittent') return 'intermittent';
    if(key === 'closed') return 'closed';
    if(key === 'warning') return 'warning';
    if(key === 'pending') return 'pending';

    return 'unknown';
  },

  mapLabel(row){
    return String(row.well || '')
      .replace(/^C[-\s]*/i, '');
  },

  renderMap(rows){
    const markers =
      document.getElementById('wellsMapMarkers');

    const empty =
      document.getElementById('wellsMapEmpty');

    if(!markers) return;

    const valid = this.mapRows(rows);
    const missing = rows.length - valid.length;
    const bounds = this.mapBounds(valid);

    this.setText(
      'wellMapVisibleCount',
      `${valid.length} ${
        valid.length === 1
          ? 'pozo visible'
          : 'pozos visibles'
      }`
    );

    this.setText(
      'wellMapMissingCount',
      `${missing} sin coordenadas`
    );

    if(!valid.length || !bounds){
      markers.innerHTML = '';
      empty?.classList.remove('hidden');
      this.renderMapInspector(null);
      return;
    }

    empty?.classList.add('hidden');

    markers.innerHTML = valid.map(row => {
      const position = this.mapPosition(row, bounds);
      const selected =
        String(this.selectedMapWell) === String(row.well);

      return `
        <button
          type="button"
          class="
            well-map-marker
            marker-${this.mapMarkerClass(row)}
            ${selected ? 'is-selected' : ''}
          "
          style="
            left:${position.x.toFixed(3)}%;
            top:${position.y.toFixed(3)}%;
          "
          data-map-well="${AdminUtils.escapeHtml(row.well)}"
          title="Pozo ${AdminUtils.escapeHtml(row.well)} · ${AdminUtils.escapeHtml(row.status.label)}">

          <span class="well-map-marker-dot"></span>

          <span class="well-map-marker-label">
            ${AdminUtils.escapeHtml(this.mapLabel(row))}
          </span>

          ${
            row.alarms.length
              ? `<span class="well-map-alarm-badge">
                   ${row.alarms.length}
                 </span>`
              : ''
          }
        </button>
      `;
    }).join('');

    markers.querySelectorAll('[data-map-well]')
      .forEach(button => {
        button.addEventListener('click', () => {
          this.selectedMapWell =
            button.dataset.mapWell || null;

          const selected = this.rows.find(row =>
            String(row.well) ===
            String(this.selectedMapWell)
          );

          this.renderMapInspector(selected);
          this.renderMap(rows);
        });
      });

    const selected = valid.find(row =>
      String(row.well) ===
      String(this.selectedMapWell)
    );

    if(selected){
      this.renderMapInspector(selected);
    }
  },

  renderMapInspector(row){
    const panel =
      document.getElementById('wellMapInspector');

    if(!panel) return;

    if(!row){
      panel.innerHTML = `
        <div class="well-map-inspector-empty">
          <div class="well-map-empty-icon">⌖</div>

          <b>Selecciona un pozo</b>

          <span>
            Presiona un marcador para consultar su estado operativo.
          </span>
        </div>
      `;

      return;
    }

    panel.innerHTML = `
      <div class="well-map-inspector-head">
        <div>
          <span>POZO</span>
          <h3>${AdminUtils.escapeHtml(row.well)}</h3>
        </div>

        ${this.statusBadge(row)}
      </div>

      <div class="well-map-risk-panel">
        <div>
          <span>Índice de riesgo operativo</span>
          ${this.riskBadge(row)}
        </div>

        ${
          row.risk.factors.length
            ? `<ul>
                 ${row.risk.factors
                   .slice(0, 3)
                   .map(factor => `
                     <li>
                       ${AdminUtils.escapeHtml(factor.label)}
                       <b>+${factor.points}</b>
                     </li>
                   `)
                   .join('')}
               </ul>`
            : `<p>
                 Sin factores de riesgo relevantes.
               </p>`
        }
      </div>

      <div class="well-map-inspector-grid">
        <div>
          <span>Estatus</span>
          <b>
            ${AdminUtils.escapeHtml(
              row.estatus || row.status.label || 'Sin información'
            )}
          </b>
        </div>

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
          <span>Reportes</span>
          <b>${row.reports.length}</b>
        </div>

        <div>
          <span>Alarmas</span>
          <b class="${row.alarms.length ? 'well-data-danger' : ''}">
            ${row.alarms.length}
          </b>
        </div>
      </div>

      <div class="well-map-last-report">
        <span>Última actividad</span>

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

      <div class="well-map-coordinates">
        <span>Coordenadas maestras</span>

        <b>
          ${Number(row.coords.lat).toFixed(6)},
          ${Number(row.coords.lon).toFixed(6)}
        </b>
      </div>

      <div class="well-map-inspector-actions">
        <a
          href="https://www.google.com/maps?q=${row.coords.lat},${row.coords.lon}"
          target="_blank"
          rel="noopener"
          class="well-map-location-btn">
          Ver ubicación
        </a>

        <button
          type="button"
          class="well-map-chart-btn"
          data-map-open-charts="${AdminUtils.escapeHtml(row.well)}"
          ${row.reports.length ? '' : 'disabled'}>
          Gráficas
        </button>

        <button
          type="button"
          class="well-map-expedient-btn"
          data-map-open-expedient="${AdminUtils.escapeHtml(row.well)}"
          ${row.latest ? '' : 'disabled'}>
          Abrir expediente
        </button>
      </div>
    `;

    panel.querySelector(
      '[data-map-open-charts]'
    )?.addEventListener('click', () => {
      if(window.AdminGraficas){
        AdminGraficas.open(row);
      }
    });

    panel.querySelector(
      '[data-map-open-expedient]'
    )?.addEventListener('click', () => {
      this.openWellExpedient(row);
    });
  },

  openWellExpedient(row){
    if(!row?.latest) return;

    AdminUI.setReportInspectorContext(
      row.reports,
      row.latest
    );

    AdminUI.setInspectorSource('well', {
      well: row.well,
      reports: row.reports,
      alarms: row.alarms,
      latest: row.latest,
      status: row.status,
      sap: row.sap,
      fluye: row.fluye,
      person: row.person,
      gps: row.gps,
      coords: row.coords,
      visitedToday: row.visitedToday
    });

    AdminUI.activeInspectorTab = 'summary';
    AdminUI.openDetail('reporte', row.latest);
  },

  applyViewMode(){
    const cards =
      document.getElementById('wellsCardsView');

    const table =
      document.getElementById('wellsTableView');

    const map =
      document.getElementById('wellsMapView');

    const validModes = ['cards', 'table', 'map'];

    if(!validModes.includes(this.viewMode)){
      this.viewMode = 'cards';
    }

    cards?.classList.toggle(
      'hidden',
      this.viewMode !== 'cards'
    );

    table?.classList.toggle(
      'hidden',
      this.viewMode !== 'table'
    );

    map?.classList.toggle(
      'hidden',
      this.viewMode !== 'map'
    );

    document.querySelectorAll('[data-well-view]')
      .forEach(button => {
        const active =
          button.dataset.wellView === this.viewMode;

        button.classList.toggle('active', active);
        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });
  },

  /*
   * Redibuja la interfaz utilizando las filas que ya están
   * construidas en memoria.
   *
   * Este método se utiliza para búsquedas, filtros y cambios
   * visuales que no requieren volver a procesar Firebase.
   */
  renderView(){
    const filtered = this.filteredRows();

    this.renderKpis();
    this.renderPriorities();

    this.setText(
      'wellResultCount',
      `${filtered.length} ${filtered.length === 1 ? 'pozo' : 'pozos'}`
    );

    this.renderCards(filtered);
    this.renderTable(filtered);
    this.renderMap(filtered);
    this.applyViewMode();
  },

  /*
   * Refresco completo de datos.
   *
   * Se conserva AdminPozos.render() como método público para
   * mantener compatibilidad con app.js y con las actualizaciones
   * procedentes de Firebase.
   */
  render(){
    this.rows = this.buildRows();

    this.renderView();

    /*
     * Si el panel de gráficas está abierto, actualizarlo con
     * los reportes recién recibidos.
     *
     * Esta operación solo se ejecuta durante un refresco real
     * de datos, no al escribir o cambiar filtros.
     */
    if(
      window.AdminGraficas &&
      AdminGraficas.activeWell &&
      typeof AdminGraficas.refreshLiveRow === 'function'
    ){
      AdminGraficas.refreshLiveRow();
    }
  }
};

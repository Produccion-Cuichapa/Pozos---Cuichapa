(function () {
  'use strict';

  /**
   * IA CUICHAPA — MOTOR DE CONSULTA OPERATIVA
   *
   * Características:
   * - Solo lectura.
   * - No consulta Firebase directamente.
   * - No crea listeners.
   * - No modifica el DOM.
   * - Consume window.AdminFirebase.
   * - Reutiliza window.AdminUtils.parseMsg().
   */

  const Engine = {
    version: '1.0.0',

    normalize(value) {
      return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    },

    cleanWell(value) {
      return String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/^POZO[\s:#-]*/i, '')
        .replace(/\s+/g, '');
    },

    escapeText(value) {
      return String(value ?? '').trim();
    },

    getReports() {
      const rows = window.AdminFirebase?.reportes;
      return Array.isArray(rows) ? rows : [];
    },

    getAlarms() {
      const rows = window.AdminFirebase?.alarmas;
      return Array.isArray(rows) ? rows : [];
    },

    parseReport(row) {
      if (!row || typeof row !== 'object') {
        return {};
      }

      try {
        if (
          window.AdminUtils &&
          typeof window.AdminUtils.parseMsg === 'function'
        ) {
          return window.AdminUtils.parseMsg(row) || {};
        }
      } catch (error) {
        console.warn(
          '[IA Engine] No fue posible interpretar un reporte:',
          error
        );
      }

      return {};
    },

    getDate(row) {
      try {
        if (
          window.AdminUtils &&
          typeof window.AdminUtils.dateObj === 'function'
        ) {
          const parsed = window.AdminUtils.dateObj(row);

          if (
            parsed instanceof Date &&
            !Number.isNaN(parsed.getTime())
          ) {
            return parsed;
          }
        }
      } catch (_) {}

      const raw =
        row?.timestamp ??
        row?.createdAt ??
        row?.fechaHora ??
        row?.fechaCreacion ??
        row?.sentAt ??
        row?.fechaMs ??
        row?.fechaISO ??
        row?.fecha ??
        null;

      if (raw === null || raw === undefined || raw === '') {
        return null;
      }

      if (typeof raw === 'number') {
        const milliseconds =
          raw > 0 && raw < 100000000000
            ? raw * 1000
            : raw;

        const date = new Date(milliseconds);

        return Number.isNaN(date.getTime())
          ? null
          : date;
      }

      const text = String(raw).trim();

      const dmy = text.match(
        /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/
      );

      if (dmy) {
        const date = new Date(
          Number(dmy[3]),
          Number(dmy[2]) - 1,
          Number(dmy[1])
        );

        return Number.isNaN(date.getTime())
          ? null
          : date;
      }

      const date = new Date(text);

      return Number.isNaN(date.getTime())
        ? null
        : date;
    },

    toYMD(date) {
      if (!(date instanceof Date)) {
        return '';
      }

      if (Number.isNaN(date.getTime())) {
        return '';
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    },

    todayYMD() {
      try {
        if (
          window.AdminUtils &&
          typeof window.AdminUtils.todayYMD === 'function'
        ) {
          return window.AdminUtils.todayYMD();
        }
      } catch (_) {}

      return this.toYMD(new Date());
    },

    isSameDay(row, ymd) {
      const date = this.getDate(row);
      return date ? this.toYMD(date) === ymd : false;
    },

    getTime(row) {
      try {
        if (
          window.AdminUtils &&
          typeof window.AdminUtils.getTime === 'function'
        ) {
          return Number(window.AdminUtils.getTime(row)) || 0;
        }
      } catch (_) {}

      const date = this.getDate(row);
      return date ? date.getTime() : 0;
    },

    pickValue(row, parsed, keys) {
      for (const key of keys) {
        const candidates = [
          row?.[key],
          parsed?.[key],
          parsed?.fields?.[key],
          parsed?.datos?.[key]
        ];

        for (const value of candidates) {
          if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ''
          ) {
            return value;
          }
        }
      }

      return '';
    },

    getWell(row, parsed) {
      const value = this.pickValue(
        row,
        parsed,
        [
          'pozo',
          'nombrePozo',
          'well',
          'lugar',
          'ubicacion'
        ]
      );

      return this.cleanWell(value);
    },

    getWorker(row, parsed) {
      const value = this.pickValue(
        row,
        parsed,
        [
          'recorredor',
          'usuario',
          'user',
          'nombre',
          'operador'
        ]
      );

      return this.escapeText(value);
    },

    getMode(row, parsed) {
      const value = this.pickValue(
        row,
        parsed,
        [
          'modo',
          'tipo',
          'tipoReporte',
          'reporte',
          'titulo'
        ]
      );

      return this.escapeText(value);
    },

    getStatus(row, parsed) {
      const value = this.pickValue(
        row,
        parsed,
        [
          'estatus',
          'estadoPozo',
          'estado',
          'status'
        ]
      );

      return this.escapeText(value);
    },

    getSap(row, parsed) {
      return this.escapeText(
        this.pickValue(
          row,
          parsed,
          ['sap', 'SAP', 'sistema']
        )
      );
    },

    getObservation(row, parsed) {
      const value = this.pickValue(
        row,
        parsed,
        [
          'observaciones',
          'observacion',
          'nota',
          'mensaje',
          'msg'
        ]
      );

      return this.escapeText(value);
    },

    hasGps(row, parsed) {
      try {
        if (
          window.AdminUtils &&
          typeof window.AdminUtils.hasGps === 'function'
        ) {
          return Boolean(window.AdminUtils.hasGps(row));
        }
      } catch (_) {}

      const lat = this.pickValue(
        row,
        parsed,
        ['lat', 'latitude', 'latitud']
      );

      const lng = this.pickValue(
        row,
        parsed,
        ['lng', 'lon', 'longitude', 'longitud']
      );

      return (
        Number.isFinite(Number(lat)) &&
        Number.isFinite(Number(lng))
      );
    },

    getDistance(row, parsed) {
      const value = this.pickValue(
        row,
        parsed,
        [
          'distancia',
          'distance',
          'distanciaMetros',
          'gpsDistance'
        ]
      );

      const number = Number(
        String(value).replace(',', '.')
      );

      return Number.isFinite(number)
        ? number
        : null;
    },

    getWhatsappStatus(row) {
      if (
        row?.whatsappSent === true ||
        this.normalize(row?.whatsappStatus) === 'sent' ||
        this.normalize(row?.estado) === 'enviado'
      ) {
        return 'Enviado';
      }

      const status = this.normalize(
        row?.whatsappStatus ??
        row?.estado ??
        row?.status
      );

      if (
        status.includes('error') ||
        status.includes('fail')
      ) {
        return 'Error';
      }

      if (
        status.includes('pending') ||
        status.includes('pendiente')
      ) {
        return 'Pendiente';
      }

      return 'Sin confirmar';
    },

    enrichReport(row) {
      const parsed = this.parseReport(row);
      const date = this.getDate(row);

      return {
        id: row?.id || '',
        raw: row,
        parsed,
        timestamp: this.getTime(row),
        date,
        ymd: date ? this.toYMD(date) : '',
        pozo: this.getWell(row, parsed),
        recorredor: this.getWorker(row, parsed),
        modo: this.getMode(row, parsed),
        estatus: this.getStatus(row, parsed),
        sap: this.getSap(row, parsed),
        observaciones: this.getObservation(row, parsed),
        tieneGps: this.hasGps(row, parsed),
        distancia: this.getDistance(row, parsed),
        whatsapp: this.getWhatsappStatus(row)
      };
    },

    reportsEnriched() {
      return this.getReports()
        .map(row => this.enrichReport(row))
        .sort((a, b) => b.timestamp - a.timestamp);
    },

    getReportsByDate(ymd) {
      const target = ymd || this.todayYMD();

      return this.reportsEnriched()
        .filter(row => row.ymd === target);
    },

    getReportsToday() {
      return this.getReportsByDate(this.todayYMD());
    },

    getAlarmsByDate(ymd) {
      const target = ymd || this.todayYMD();

      return this.getAlarms()
        .filter(row => this.isSameDay(row, target))
        .sort(
          (a, b) =>
            this.getTime(b) - this.getTime(a)
        );
    },

    getAlarmsToday() {
      return this.getAlarmsByDate(this.todayYMD());
    },

    getWellHistory(well, limit) {
      const target = this.cleanWell(well);
      const max = Number(limit) > 0
        ? Number(limit)
        : 20;

      if (!target) {
        return [];
      }

      return this.reportsEnriched()
        .filter(row => row.pozo === target)
        .slice(0, max);
    },

    getLastWellReport(well) {
      return this.getWellHistory(well, 1)[0] || null;
    },

    getWorkerReports(worker, ymd) {
      const target = this.normalize(worker);
      const rows = ymd
        ? this.getReportsByDate(ymd)
        : this.reportsEnriched();

      if (!target) {
        return [];
      }

      return rows.filter(row =>
        this.normalize(row.recorredor).includes(target)
      );
    },

    getWorkerSummary(worker, ymd) {
      const targetDate = ymd || this.todayYMD();
      const reports = this.getWorkerReports(
        worker,
        targetDate
      );

      const wells = [
        ...new Set(
          reports
            .map(row => row.pozo)
            .filter(Boolean)
        )
      ];

      return {
        recorredor: worker,
        fecha: targetDate,
        reportes: reports.length,
        pozosVisitados: wells.length,
        pozos: wells,
        primerReporte:
          reports.length
            ? reports[reports.length - 1]
            : null,
        ultimoReporte:
          reports.length
            ? reports[0]
            : null
      };
    },

    getIntermittentWells(ymd) {
      const rows = ymd
        ? this.getReportsByDate(ymd)
        : this.reportsEnriched();

      const latestByWell = new Map();

      rows.forEach(row => {
        if (!row.pozo) {
          return;
        }

        if (!latestByWell.has(row.pozo)) {
          latestByWell.set(row.pozo, row);
        }
      });

      return [...latestByWell.values()]
        .filter(row =>
          this.normalize(row.estatus)
            .includes('intermitente')
        );
    },

    getClosedWells(ymd) {
      const rows = ymd
        ? this.getReportsByDate(ymd)
        : this.reportsEnriched();

      const latestByWell = new Map();

      rows.forEach(row => {
        if (!row.pozo) {
          return;
        }

        if (!latestByWell.has(row.pozo)) {
          latestByWell.set(row.pozo, row);
        }
      });

      return [...latestByWell.values()]
        .filter(row =>
          this.normalize(row.estatus)
            .includes('cerrado')
        );
    },

    getGpsProblems(ymd) {
      const rows = ymd
        ? this.getReportsByDate(ymd)
        : this.reportsEnriched();

      return rows.filter(row => {
        if (!row.tieneGps) {
          return true;
        }

        return (
          row.distancia !== null &&
          row.distancia > 80
        );
      });
    },

    getWhatsappPending(ymd) {
      const rows = ymd
        ? this.getReportsByDate(ymd)
        : this.reportsEnriched();

      return rows.filter(row =>
        row.whatsapp === 'Pendiente' ||
        row.whatsapp === 'Error' ||
        row.whatsapp === 'Sin confirmar'
      );
    },

    getIndicators() {
      const indicator =
        window.AdminDashboardIndicador || {};

      const superTotal = Number(
        indicator.superTotal ?? 0
      );

      const vrt = Number(
        indicator.vrt ?? 0
      );

      const smt = Number(
        indicator.smt ?? 0
      );

      return {
        superTotal:
          Number.isFinite(superTotal)
            ? superTotal
            : 0,

        vrt:
          Number.isFinite(vrt)
            ? vrt
            : 0,

        smt:
          Number.isFinite(smt)
            ? smt
            : 0,

        available:
          Number.isFinite(Number(indicator.smt)) ||
          Number.isFinite(Number(indicator.vrt)) ||
          Number.isFinite(Number(indicator.superTotal))
      };
    },

    getTodaySummary() {
      const reports = this.getReportsToday();
      const alarms = this.getAlarmsToday();

      const wells = [
        ...new Set(
          reports
            .map(row => row.pozo)
            .filter(Boolean)
        )
      ];

      const workers = [
        ...new Set(
          reports
            .map(row => row.recorredor)
            .filter(Boolean)
        )
      ];

      return {
        fecha: this.todayYMD(),
        reportes: reports.length,
        alarmas: alarms.length,
        pozosVisitados: wells.length,
        recorredoresActivos: workers.length,
        pozos: wells,
        recorredores: workers,
        problemasGps:
          this.getGpsProblems(this.todayYMD()).length,
        whatsappPendientes:
          this.getWhatsappPending(
            this.todayYMD()
          ).length,
        indicadores: this.getIndicators()
      };
    },

    healthCheck() {
      const errors = [];
      const warnings = [];

      if (!window.AdminFirebase) {
        errors.push(
          'window.AdminFirebase no está disponible'
        );
      }

      if (!Array.isArray(window.AdminFirebase?.reportes)) {
        errors.push(
          'AdminFirebase.reportes no es un arreglo'
        );
      }

      if (!Array.isArray(window.AdminFirebase?.alarmas)) {
        errors.push(
          'AdminFirebase.alarmas no es un arreglo'
        );
      }

      if (
        !window.AdminUtils ||
        typeof window.AdminUtils.parseMsg !== 'function'
      ) {
        warnings.push(
          'AdminUtils.parseMsg no está disponible'
        );
      }

      if (!window.AdminIAKnowledge) {
        warnings.push(
          'AdminIAKnowledge no está disponible'
        );
      }

      return {
        ok: errors.length === 0,
        version: this.version,
        errors,
        warnings,
        reportesCargados: this.getReports().length,
        alarmasCargadas: this.getAlarms().length
      };
    }
  };

  window.AdminIAEngine = Engine;

  console.info(
    '[IA Cuichapa] Motor operativo cargado:',
    Engine.version
  );
})();

(function () {
  'use strict';

  /**
   * IA CUICHAPA — PLANIFICADOR
   *
   * Responsabilidad:
   * - Recibir el análisis generado por AdminIANLU.
   * - Determinar qué operaciones debe ejecutar AdminIAEngine.
   * - Ejecutar consultas de solo lectura.
   * - Entregar resultados estructurados.
   *
   * Este módulo:
   * - No consulta Firebase directamente.
   * - No crea listeners.
   * - No modifica el DOM.
   * - No modifica reportes ni alarmas.
   */

  const Planner = {
    version: '1.0.0',

    registry: {
      help: {
        action: 'help',
        description: 'Mostrar capacidades disponibles'
      },

      daily_summary: {
        action: 'getDailySummary',
        description: 'Consultar resumen operativo'
      },

      indicators: {
        action: 'getIndicators',
        description: 'Consultar SUPER TOTAL, VRT y SMT'
      },

      alarms: {
        action: 'getAlarms',
        description: 'Consultar alarmas'
      },

      gps_issues: {
        action: 'getGpsIssues',
        description: 'Consultar problemas de ubicación'
      },

      whatsapp_status: {
        action: 'getWhatsappStatus',
        description: 'Consultar reportes pendientes de envío'
      },

      well_history: {
        action: 'getWellHistory',
        description: 'Consultar historial de un pozo'
      },

      worker_activity: {
        action: 'getWorkerActivity',
        description: 'Consultar actividad de un recorredor'
      },

      well_status: {
        action: 'getWellStatus',
        description: 'Consultar pozos por estado'
      },

      reports: {
        action: 'getReports',
        description: 'Consultar reportes operativos'
      },

      comparison: {
        action: 'compareWorkers',
        description: 'Comparar actividad de recorredores'
      },

      diagnosis: {
        action: 'getDiagnosis',
        description: 'Generar diagnóstico operativo'
      },

      trends: {
        action: 'getTrends',
        description: 'Analizar tendencias operativas'
      }
    },

    getEngine() {
      return window.AdminIAEngine || null;
    },

    getNLU() {
      return window.AdminIANLU || null;
    },

    normalize(value) {
      return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    },

    toDateRange(analysis) {
      const range =
        analysis?.entities?.dateRange || {};

      const engine = this.getEngine();

      const today =
        engine && typeof engine.todayYMD === 'function'
          ? engine.todayYMD()
          : '';

      return {
        type: range.type || 'day',
        label: range.label || 'hoy',
        from: range.from || today,
        to: range.to || today,
        inferred: Boolean(range.inferred)
      };
    },

    dateIsSingleDay(range) {
      return Boolean(
        range &&
        range.from &&
        range.to &&
        range.from === range.to
      );
    },

    reportsInRange(from, to) {
      const engine = this.getEngine();

      if (!engine) {
        return [];
      }

      return engine.reportsEnriched()
        .filter(report => {
          if (!report.ymd) {
            return false;
          }

          return (
            report.ymd >= from &&
            report.ymd <= to
          );
        });
    },

    alarmsInRange(from, to) {
      const engine = this.getEngine();

      if (!engine) {
        return [];
      }

      return engine.getAlarms()
        .filter(alarm => {
          const date = engine.getDate(alarm);
          const ymd = date
            ? engine.toYMD(date)
            : '';

          return (
            ymd &&
            ymd >= from &&
            ymd <= to
          );
        })
        .sort(
          (a, b) =>
            engine.getTime(b) -
            engine.getTime(a)
        );
    },

    filterReportsByWorker(reports, worker) {
      const target = this.normalize(worker);

      if (!target) {
        return [];
      }

      const targetParts = target
        .split(/\s+/)
        .filter(part => part.length > 2);

      return reports.filter(report => {
        const actual = this.normalize(
          report.recorredor
        );

        if (!actual) {
          return false;
        }

        if (
          actual.includes(target) ||
          target.includes(actual)
        ) {
          return true;
        }

        return targetParts.every(part =>
          actual.includes(part)
        );
      });
    },

    getUniqueWells(reports) {
      return [
        ...new Set(
          reports
            .map(report => report.pozo)
            .filter(Boolean)
        )
      ];
    },

    createPlan(analysis) {
      if (!analysis || typeof analysis !== 'object') {
        return {
          ok: false,
          intent: 'unknown',
          error: 'El análisis NLU no es válido',
          steps: []
        };
      }

      const definition =
        this.registry[analysis.intent];

      if (!definition) {
        return {
          ok: false,
          intent: analysis.intent || 'unknown',
          error:
            'No existe un plan registrado para esta intención',
          analysis,
          steps: []
        };
      }

      const range = this.toDateRange(analysis);

      const plan = {
        ok: true,
        id:
          `plan_${Date.now()}_` +
          Math.random().toString(36).slice(2, 8),

        intent: analysis.intent,
        confidence: analysis.confidence,
        score: analysis.score,
        action: definition.action,
        description: definition.description,
        analysis,
        parameters: {
          dateRange: range,
          well:
            analysis.entities?.well || '',
          workers:
            analysis.entities?.workers || [],
          status:
            analysis.entities?.status || '',
          modifiers:
            analysis.modifiers || {}
        },
        steps: []
      };

      plan.steps.push({
        order: 1,
        type: 'validate',
        operation: 'validateDependencies'
      });

      plan.steps.push({
        order: 2,
        type: 'query',
        operation: definition.action,
        parameters: plan.parameters
      });

      plan.steps.push({
        order: 3,
        type: 'response',
        operation:
          `render_${analysis.intent}`
      });

      return plan;
    },

    validateDependencies() {
      const errors = [];
      const warnings = [];

      if (!this.getEngine()) {
        errors.push(
          'AdminIAEngine no está disponible'
        );
      }

      if (!this.getNLU()) {
        errors.push(
          'AdminIANLU no está disponible'
        );
      }

      if (
        this.getEngine() &&
        typeof this.getEngine().healthCheck === 'function'
      ) {
        const health =
          this.getEngine().healthCheck();

        if (!health.ok) {
          errors.push(...health.errors);
        }

        warnings.push(...health.warnings);
      }

      return {
        ok: errors.length === 0,
        errors,
        warnings
      };
    },

    executeQuestion(question) {
      const nlu = this.getNLU();

      if (!nlu) {
        return {
          ok: false,
          error:
            'AdminIANLU no está disponible'
        };
      }

      const analysis = nlu.analyze(question);
      const plan = this.createPlan(analysis);

      return this.execute(plan);
    },

    execute(plan) {
      const validation =
        this.validateDependencies();

      if (!validation.ok) {
        return {
          ok: false,
          plan,
          error:
            validation.errors.join(' · '),
          warnings: validation.warnings
        };
      }

      if (!plan?.ok) {
        return {
          ok: false,
          plan,
          error:
            plan?.error ||
            'El plan no es válido'
        };
      }

      const action =
        this[plan.action];

      if (typeof action !== 'function') {
        return {
          ok: false,
          plan,
          error:
            `La acción ${plan.action} no está implementada`
        };
      }

      try {
        const startedAt =
          performance.now();

        const data = action.call(
          this,
          plan.parameters,
          plan
        );

        const durationMs =
          performance.now() - startedAt;

        return {
          ok: true,
          intent: plan.intent,
          plan,
          data,
          metadata: {
            durationMs:
              Number(durationMs.toFixed(2)),
            executedAt:
              new Date().toISOString(),
            source:
              'AdminIAEngine',
            readOnly: true
          },
          warnings:
            validation.warnings
        };
      } catch (error) {
        console.error(
          '[IA Planner] Error ejecutando plan:',
          error
        );

        return {
          ok: false,
          plan,
          error:
            error?.message ||
            'Error desconocido al ejecutar el plan'
        };
      }
    },

    help() {
      return {
        type: 'help',
        capabilities: [
          'Resumen operativo',
          'Indicadores SUPER TOTAL, VRT y SMT',
          'Historial por pozo',
          'Actividad por recorredor',
          'Alarmas',
          'Problemas GPS',
          'Estado de WhatsApp',
          'Pozos por estado',
          'Comparación de recorredores',
          'Diagnóstico operativo'
        ]
      };
    },

    getDailySummary(parameters) {
      const engine = this.getEngine();
      const range = parameters.dateRange;

      if (this.dateIsSingleDay(range)) {
        const reports =
          engine.getReportsByDate(range.from);

        const alarms =
          engine.getAlarmsByDate(range.from);

        const wells =
          this.getUniqueWells(reports);

        const workers = [
          ...new Set(
            reports
              .map(report => report.recorredor)
              .filter(Boolean)
          )
        ];

        return {
          type: 'daily_summary',
          range,
          reportes: reports.length,
          alarmas: alarms.length,
          pozosVisitados: wells.length,
          recorredoresActivos: workers.length,
          pozos: wells,
          recorredores: workers,
          problemasGps:
            engine.getGpsProblems(range.from).length,
          whatsappPendientes:
            engine.getWhatsappPending(range.from).length,
          indicadores:
            engine.getIndicators()
        };
      }

      const reports =
        this.reportsInRange(
          range.from,
          range.to
        );

      const alarms =
        this.alarmsInRange(
          range.from,
          range.to
        );

      const wells =
        this.getUniqueWells(reports);

      const workers = [
        ...new Set(
          reports
            .map(report => report.recorredor)
            .filter(Boolean)
        )
      ];

      return {
        type: 'range_summary',
        range,
        reportes: reports.length,
        alarmas: alarms.length,
        pozosVisitados: wells.length,
        recorredoresActivos: workers.length,
        pozos: wells,
        recorredores: workers
      };
    },

    getIndicators() {
      return {
        type: 'indicators',
        indicadores:
          this.getEngine().getIndicators()
      };
    },

    getAlarms(parameters) {
      const range = parameters.dateRange;

      return {
        type: 'alarms',
        range,
        alarms:
          this.alarmsInRange(
            range.from,
            range.to
          )
      };
    },

    getGpsIssues(parameters) {
      const engine = this.getEngine();
      const range = parameters.dateRange;

      let reports;

      if (this.dateIsSingleDay(range)) {
        reports =
          engine.getGpsProblems(range.from);
      } else {
        reports =
          this.reportsInRange(
            range.from,
            range.to
          ).filter(report => {
            if (!report.tieneGps) {
              return true;
            }

            return (
              report.distancia !== null &&
              report.distancia > 80
            );
          });
      }

      return {
        type: 'gps_issues',
        range,
        reports,
        total: reports.length,
        sinGps:
          reports.filter(report =>
            !report.tieneGps
          ).length,
        fueraDeRadio:
          reports.filter(report =>
            report.tieneGps &&
            report.distancia !== null &&
            report.distancia > 80
          ).length
      };
    },

    getWhatsappStatus(parameters) {
      const engine = this.getEngine();
      const range = parameters.dateRange;

      let reports;

      if (this.dateIsSingleDay(range)) {
        reports =
          engine.getWhatsappPending(range.from);
      } else {
        reports =
          this.reportsInRange(
            range.from,
            range.to
          ).filter(report =>
            report.whatsapp !== 'Enviado'
          );
      }

      return {
        type: 'whatsapp_status',
        range,
        reports,
        total: reports.length,
        pendientes:
          reports.filter(report =>
            report.whatsapp === 'Pendiente'
          ).length,
        errores:
          reports.filter(report =>
            report.whatsapp === 'Error'
          ).length,
        sinConfirmar:
          reports.filter(report =>
            report.whatsapp === 'Sin confirmar'
          ).length
      };
    },

    getWellHistory(parameters) {
      const engine = this.getEngine();
      const well = parameters.well;
      const range = parameters.dateRange;

      if (!well) {
        return {
          type: 'well_history',
          requiresInput: true,
          missing: 'well',
          reports: []
        };
      }

      let reports =
        engine.getWellHistory(well, 100);

      if (
        range &&
        !range.inferred &&
        range.from &&
        range.to
      ) {
        reports = reports.filter(report =>
          report.ymd >= range.from &&
          report.ymd <= range.to
        );
      }

      return {
        type: 'well_history',
        well,
        range,
        reports,
        total: reports.length,
        latest: reports[0] || null
      };
    },

    getWorkerActivity(parameters) {
      const range = parameters.dateRange;
      const workers = parameters.workers;

      if (!workers.length) {
        return {
          type: 'worker_activity',
          requiresInput: true,
          missing: 'worker',
          workers: []
        };
      }

      const reports =
        this.reportsInRange(
          range.from,
          range.to
        );

      const summaries =
        workers.map(worker => {
          const workerReports =
            this.filterReportsByWorker(
              reports,
              worker
            );

          const wells =
            this.getUniqueWells(workerReports);

          const ordered =
            [...workerReports].sort(
              (a, b) =>
                b.timestamp -
                a.timestamp
            );

          return {
            worker,
            reportes:
              workerReports.length,
            pozosVisitados:
              wells.length,
            pozos: wells,
            primerReporte:
              ordered.length
                ? ordered[ordered.length - 1]
                : null,
            ultimoReporte:
              ordered[0] || null,
            problemasGps:
              workerReports.filter(report =>
                !report.tieneGps ||
                (
                  report.distancia !== null &&
                  report.distancia > 80
                )
              ).length,
            whatsappPendientes:
              workerReports.filter(report =>
                report.whatsapp !== 'Enviado'
              ).length,
            reports: ordered
          };
        });

      return {
        type: 'worker_activity',
        range,
        workers: summaries
      };
    },

    getWellStatus(parameters) {
      const engine = this.getEngine();
      const range = parameters.dateRange;
      const status = parameters.status;

      const reports =
        this.reportsInRange(
          range.from,
          range.to
        );

      const latestByWell = new Map();

      reports
        .sort(
          (a, b) =>
            b.timestamp -
            a.timestamp
        )
        .forEach(report => {
          if (
            report.pozo &&
            !latestByWell.has(report.pozo)
          ) {
            latestByWell.set(
              report.pozo,
              report
            );
          }
        });

      let latest =
        [...latestByWell.values()];

      if (status) {
        const target =
          this.normalize(status);

        latest = latest.filter(report =>
          this.normalize(report.estatus)
            .includes(target)
        );
      }

      return {
        type: 'well_status',
        range,
        status,
        wells: latest,
        total: latest.length
      };
    },

    getReports(parameters) {
      const range = parameters.dateRange;

      const reports =
        this.reportsInRange(
          range.from,
          range.to
        );

      return {
        type: 'reports',
        range,
        reports,
        total: reports.length,
        pozos:
          this.getUniqueWells(reports)
      };
    },

    compareWorkers(parameters) {
      const workers = parameters.workers;
      const range = parameters.dateRange;

      if (workers.length < 2) {
        return {
          type: 'comparison',
          requiresInput: true,
          missing: 'two_workers',
          workers: []
        };
      }

      const activity =
        this.getWorkerActivity({
          workers,
          dateRange: range
        });

      const ranking =
        [...activity.workers].sort(
          (a, b) =>
            b.reportes -
            a.reportes
        );

      return {
        type: 'comparison',
        range,
        workers:
          activity.workers,
        ranking,
        leader:
          ranking[0] || null,
        difference:
          ranking.length >= 2
            ? ranking[0].reportes -
              ranking[1].reportes
            : 0
      };
    },

    getDiagnosis(parameters) {
      const engine = this.getEngine();
      const range = parameters.dateRange;

      const reports =
        this.reportsInRange(
          range.from,
          range.to
        );

      const alarms =
        this.alarmsInRange(
          range.from,
          range.to
        );

      const scores = new Map();

      const ensureWell = well => {
        if (!well) {
          return null;
        }

        if (!scores.has(well)) {
          scores.set(well, {
            well,
            score: 0,
            reasons: [],
            alarms: 0,
            gpsIssues: 0,
            whatsappIssues: 0,
            closed: false,
            intermittent: false,
            latest: null
          });
        }

        return scores.get(well);
      };

      reports
        .sort(
          (a, b) =>
            b.timestamp -
            a.timestamp
        )
        .forEach(report => {
          const item =
            ensureWell(report.pozo);

          if (!item) {
            return;
          }

          if (!item.latest) {
            item.latest = report;
          }

          const status =
            this.normalize(report.estatus);

          if (
            status.includes('cerrado') &&
            !item.closed
          ) {
            item.closed = true;
            item.score += 4;
            item.reasons.push(
              'Último estado reportado: cerrado'
            );
          }

          if (
            status.includes('intermitente') &&
            !item.intermittent
          ) {
            item.intermittent = true;
            item.score += 3;
            item.reasons.push(
              'Operación intermitente'
            );
          }

          if (
            !report.tieneGps ||
            (
              report.distancia !== null &&
              report.distancia > 80
            )
          ) {
            item.gpsIssues += 1;
          }

          if (report.whatsapp !== 'Enviado') {
            item.whatsappIssues += 1;
          }
        });

      scores.forEach(item => {
        if (item.gpsIssues) {
          item.score += Math.min(
            item.gpsIssues,
            3
          );

          item.reasons.push(
            `${item.gpsIssues} problema(s) GPS`
          );
        }

        if (item.whatsappIssues) {
          item.score += Math.min(
            item.whatsappIssues,
            2
          );

          item.reasons.push(
            `${item.whatsappIssues} envío(s) por revisar`
          );
        }
      });

      alarms.forEach(alarm => {
        const parsed =
          engine.parseReport(alarm);

        const well =
          engine.getWell(alarm, parsed);

        const item =
          ensureWell(well);

        if (!item) {
          return;
        }

        item.alarms += 1;
        item.score += 5;
      });

      scores.forEach(item => {
        if (item.alarms) {
          item.reasons.unshift(
            `${item.alarms} alarma(s) registrada(s)`
          );
        }

        item.priority =
          item.score >= 8
            ? 'Alta'
            : item.score >= 4
              ? 'Media'
              : 'Baja';
      });

      const priorities =
        [...scores.values()]
          .filter(item => item.score > 0)
          .sort((a, b) => {
            if (b.score !== a.score) {
              return b.score - a.score;
            }

            return (
              (b.latest?.timestamp || 0) -
              (a.latest?.timestamp || 0)
            );
          });

      return {
        type: 'diagnosis',
        range,
        priorities,
        highestPriority:
          priorities[0] || null,
        totalReviewed:
          scores.size,
        totalWithFindings:
          priorities.length
      };
    },

    getTrends(parameters) {
      const range = parameters.dateRange;

      const reports =
        this.reportsInRange(
          range.from,
          range.to
        );

      const byDay = {};

      reports.forEach(report => {
        if (!report.ymd) {
          return;
        }

        if (!byDay[report.ymd]) {
          byDay[report.ymd] = {
            date: report.ymd,
            reportes: 0,
            pozos: new Set(),
            gpsIssues: 0,
            whatsappIssues: 0
          };
        }

        const day =
          byDay[report.ymd];

        day.reportes += 1;

        if (report.pozo) {
          day.pozos.add(report.pozo);
        }

        if (
          !report.tieneGps ||
          (
            report.distancia !== null &&
            report.distancia > 80
          )
        ) {
          day.gpsIssues += 1;
        }

        if (report.whatsapp !== 'Enviado') {
          day.whatsappIssues += 1;
        }
      });

      const days =
        Object.values(byDay)
          .map(day => ({
            date: day.date,
            reportes: day.reportes,
            pozosVisitados: day.pozos.size,
            gpsIssues: day.gpsIssues,
            whatsappIssues:
              day.whatsappIssues
          }))
          .sort((a, b) =>
            a.date.localeCompare(b.date)
          );

      return {
        type: 'trends',
        range,
        days,
        totalDays: days.length,
        available:
          days.length >= 2
      };
    },

    healthCheck() {
      const dependencyCheck =
        this.validateDependencies();

      const tests = [
        {
          question:
            'Muéstrame el pozo 505',
          expected:
            'well_history'
        },
        {
          question:
            '¿Qué hizo Luis Carlos hoy?',
          expected:
            'worker_activity'
        },
        {
          question:
            '¿Qué alarmas hubo ayer?',
          expected:
            'alarms'
        },
        {
          question:
            'Pozos intermitentes',
          expected:
            'well_status'
        },
        {
          question:
            'Compara a Juan Carlos con Manrique',
          expected:
            'comparison'
        },
        {
          question:
            '¿Qué requiere atención prioritaria hoy?',
          expected:
            'diagnosis'
        }
      ];

      const results =
        tests.map(test => {
          const analysis =
            this.getNLU()?.analyze(
              test.question
            );

          const plan =
            this.createPlan(analysis);

          return {
            question:
              test.question,
            expected:
              test.expected,
            received:
              plan.intent,
            action:
              plan.action || '',
            ok:
              plan.ok &&
              plan.intent === test.expected
          };
        });

      return {
        ok:
          dependencyCheck.ok &&
          results.every(result => result.ok),

        version: this.version,
        dependencies:
          dependencyCheck,
        passed:
          results.filter(result => result.ok).length,
        total:
          results.length,
        results
      };
    }
  };

  window.AdminIAPlanner = Planner;

  console.info(
    '[IA Cuichapa] Planificador cargado:',
    Planner.version
  );
})();

(function () {
  'use strict';

  /**
   * IA CUICHAPA — CONTEXTO CONVERSACIONAL
   *
   * Funciones:
   * - Conserva el tema reciente de la conversación.
   * - Resuelve referencias como:
   *   "¿Y ayer?", "¿y él?", "compáralos", "¿y el GPS?"
   * - No consulta Firebase.
   * - No modifica el DOM.
   * - No escribe información operativa.
   * - La memoria existe únicamente durante la sesión actual.
   */

  const Context = {
    version: '1.0.0',
    maxTurns: 20,
    turns: [],
    active: {
      well: '',
      workers: [],
      status: '',
      dateRange: null,
      intent: '',
      lastQuestion: '',
      lastResolvedQuestion: ''
    },

    normalize(value) {
      return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[¿?¡!.,;:()[\]{}"'`´]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    },

    unique(values) {
      return [
        ...new Set(
          (Array.isArray(values) ? values : [])
            .filter(Boolean)
        )
      ];
    },

    getNLU() {
      return window.AdminIANLU || null;
    },

    isShortFollowUp(question) {
      const normalized = this.normalize(question);
      const words = normalized
        .split(/\s+/)
        .filter(Boolean);

      return (
        words.length <= 6 ||
        /^(y|pero|tambien|ahora|entonces)\b/.test(normalized)
      );
    },

    hasExplicitDate(analysis) {
      return Boolean(
        analysis?.entities?.dateRange &&
        !analysis.entities.dateRange.inferred
      );
    },

    hasPronounReference(question) {
      const normalized = this.normalize(question);

      return [
        'el',
        'ella',
        'ellos',
        'lo',
        'la',
        'los',
        'las',
        'ese',
        'esa',
        'esos',
        'esas',
        'este',
        'esta',
        'estos',
        'estas',
        'ambos',
        'los dos'
      ].some(term =>
        new RegExp(`(?:^|\\s)${term}(?:$|\\s)`)
          .test(normalized)
      );
    },

    datePhrase(dateRange) {
      if (!dateRange) {
        return '';
      }

      if (dateRange.label) {
        return dateRange.label;
      }

      if (
        dateRange.from &&
        dateRange.to &&
        dateRange.from === dateRange.to
      ) {
        return dateRange.from;
      }

      if (dateRange.from && dateRange.to) {
        return `del ${dateRange.from} al ${dateRange.to}`;
      }

      return '';
    },

    workerPhrase(workers) {
      const values = this.unique(workers);

      if (!values.length) {
        return '';
      }

      if (values.length === 1) {
        return values[0];
      }

      if (values.length === 2) {
        return `${values[0]} y ${values[1]}`;
      }

      return values.join(', ');
    },

    inferTopic(question, analysis) {
      const normalized = this.normalize(question);

      if (
        analysis?.entities?.well ||
        normalized.includes('pozo')
      ) {
        return 'well';
      }

      if (
        analysis?.entities?.workers?.length ||
        normalized.includes('recorredor')
      ) {
        return 'worker';
      }

      if (
        normalized.includes('gps') ||
        normalized.includes('ubicacion') ||
        normalized.includes('radio')
      ) {
        return 'gps';
      }

      if (
        normalized.includes('whatsapp') ||
        normalized.includes('envio')
      ) {
        return 'whatsapp';
      }

      if (
        normalized.includes('alarma') ||
        normalized.includes('alerta')
      ) {
        return 'alarms';
      }

      if (
        normalized.includes('indicador') ||
        normalized.includes('vrt') ||
        normalized.includes('smt')
      ) {
        return 'indicators';
      }

      return analysis?.intent || '';
    },

    buildResolvedQuestion(question, analysis) {
      const original = String(question ?? '').trim();
      const normalized = this.normalize(original);
      const additions = [];

      const currentWell =
        analysis?.entities?.well || '';

      const currentWorkers =
        analysis?.entities?.workers || [];

      const explicitDate =
        this.hasExplicitDate(analysis);

      const shortFollowUp =
        this.isShortFollowUp(original);

      const pronounReference =
        this.hasPronounReference(original);

      const asksComparison =
        Boolean(
          analysis?.modifiers?.comparison ||
          normalized.includes('compara') ||
          normalized.includes('comparalos') ||
          normalized.includes('compararlos') ||
          normalized.includes('los dos')
        );

      /*
       * Referencia al pozo anterior.
       */
      if (
        !currentWell &&
        this.active.well &&
        (
          shortFollowUp ||
          pronounReference ||
          normalized.includes('gps') ||
          normalized.includes('whatsapp') ||
          normalized.includes('estado') ||
          normalized.includes('reporte') ||
          normalized.includes('quien') ||
          normalized.includes('cuando') ||
          normalized.includes('ayer')
        )
      ) {
        additions.push(`del pozo ${this.active.well}`);
      }

      /*
       * Referencia al recorredor anterior.
       */
      if (
        !currentWorkers.length &&
        this.active.workers.length &&
        (
          shortFollowUp ||
          pronounReference ||
          normalized.includes('reportes') ||
          normalized.includes('pozos') ||
          normalized.includes('gps') ||
          normalized.includes('actividad')
        )
      ) {
        additions.push(
          `de ${this.workerPhrase(this.active.workers)}`
        );
      }

      /*
       * Comparación utilizando los dos últimos recorredores.
       */
      if (
        asksComparison &&
        currentWorkers.length < 2 &&
        this.active.workers.length >= 2
      ) {
        additions.push(
          `entre ${this.workerPhrase(this.active.workers.slice(-2))}`
        );
      }

      /*
       * Conserva la fecha anterior cuando la consulta no especifica fecha.
       */
      if (
        !explicitDate &&
        this.active.dateRange &&
        (
          shortFollowUp ||
          normalized.includes('tambien') ||
          normalized.includes('compar')
        )
      ) {
        const phrase =
          this.datePhrase(this.active.dateRange);

        if (phrase) {
          additions.push(phrase);
        }
      }

      return additions.length
        ? `${original} ${additions.join(' ')}`
        : original;
    },

    resolve(question) {
      const nlu = this.getNLU();
      const originalQuestion =
        String(question ?? '').trim();

      if (!nlu) {
        return {
          originalQuestion,
          resolvedQuestion: originalQuestion,
          originalAnalysis: null,
          resolvedAnalysis: null,
          contextApplied: false,
          additions: []
        };
      }

      const originalAnalysis =
        nlu.analyze(originalQuestion);

      const resolvedQuestion =
        this.buildResolvedQuestion(
          originalQuestion,
          originalAnalysis
        );

      const resolvedAnalysis =
        nlu.analyze(resolvedQuestion);

      return {
        originalQuestion,
        resolvedQuestion,
        originalAnalysis,
        resolvedAnalysis,
        contextApplied:
          resolvedQuestion !== originalQuestion,
        topic:
          this.inferTopic(
            resolvedQuestion,
            resolvedAnalysis
          )
      };
    },

    updateActiveContext(contextResult, plannerResult) {
      const analysis =
        contextResult?.resolvedAnalysis ||
        plannerResult?.plan?.analysis ||
        null;

      if (!analysis) {
        return;
      }

      const entities = analysis.entities || {};

      if (entities.well) {
        this.active.well = entities.well;
      }

      if (
        Array.isArray(entities.workers) &&
        entities.workers.length
      ) {
        this.active.workers = this.unique([
          ...this.active.workers,
          ...entities.workers
        ]).slice(-4);
      }

      if (entities.status) {
        this.active.status = entities.status;
      }

      if (
        entities.dateRange &&
        !entities.dateRange.inferred
      ) {
        this.active.dateRange = {
          ...entities.dateRange
        };
      } else if (
        !this.active.dateRange &&
        entities.dateRange
      ) {
        this.active.dateRange = {
          ...entities.dateRange
        };
      }

      if (analysis.intent && analysis.intent !== 'unknown') {
        this.active.intent = analysis.intent;
      }

      this.active.lastQuestion =
        contextResult.originalQuestion;

      this.active.lastResolvedQuestion =
        contextResult.resolvedQuestion;
    },

    record(contextResult, plannerResult) {
      const turn = {
        id:
          `turn_${Date.now()}_` +
          Math.random().toString(36).slice(2, 7),

        timestamp: new Date().toISOString(),

        originalQuestion:
          contextResult?.originalQuestion || '',

        resolvedQuestion:
          contextResult?.resolvedQuestion || '',

        contextApplied:
          Boolean(contextResult?.contextApplied),

        intent:
          plannerResult?.intent ||
          contextResult?.resolvedAnalysis?.intent ||
          'unknown',

        ok:
          Boolean(plannerResult?.ok),

        entities:
          contextResult?.resolvedAnalysis?.entities || {},

        resultType:
          plannerResult?.data?.type || ''
      };

      this.turns.push(turn);

      if (this.turns.length > this.maxTurns) {
        this.turns.splice(
          0,
          this.turns.length - this.maxTurns
        );
      }

      this.updateActiveContext(
        contextResult,
        plannerResult
      );

      return turn;
    },

    reset() {
      this.turns = [];

      this.active = {
        well: '',
        workers: [],
        status: '',
        dateRange: null,
        intent: '',
        lastQuestion: '',
        lastResolvedQuestion: ''
      };

      return true;
    },

    getState() {
      return {
        version: this.version,
        turns: [...this.turns],
        active: {
          ...this.active,
          workers: [...this.active.workers],
          dateRange:
            this.active.dateRange
              ? {...this.active.dateRange}
              : null
        }
      };
    },

    healthCheck() {
      const backup = this.getState();

      try {
        this.reset();

        let result = this.resolve(
          '¿Cómo anda el pozo 505?'
        );

        this.record(result, {
          ok: true,
          intent: 'well_history',
          data: {
            type: 'well_history'
          }
        });

        const followUp =
          this.resolve('¿Y ayer?');

        const wellPassed =
          followUp.resolvedQuestion
            .toLowerCase()
            .includes('pozo 505');

        this.reset();

        result = this.resolve(
          '¿Qué hizo Luis Carlos hoy?'
        );

        this.record(result, {
          ok: true,
          intent: 'worker_activity',
          data: {
            type: 'worker_activity'
          }
        });

        const workerFollowUp =
          this.resolve('¿Y sus problemas de GPS?');

        const workerPassed =
          this.normalize(
            workerFollowUp.resolvedQuestion
          ).includes('luis carlos');

        return {
          ok: wellPassed && workerPassed,
          version: this.version,
          tests: {
            wellFollowUp: {
              ok: wellPassed,
              resolved:
                followUp.resolvedQuestion
            },
            workerFollowUp: {
              ok: workerPassed,
              resolved:
                workerFollowUp.resolvedQuestion
            }
          }
        };
      } finally {
        this.turns = backup.turns;

        this.active = {
          ...backup.active,
          workers: [...backup.active.workers],
          dateRange:
            backup.active.dateRange
              ? {...backup.active.dateRange}
              : null
        };
      }
    }
  };

  window.AdminIAContext = Context;

  console.info(
    '[IA Cuichapa] Contexto conversacional cargado:',
    Context.version
  );
})();

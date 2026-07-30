(function () {
  'use strict';

  /**
   * IA CUICHAPA — PROACTIVE
   *
   * Genera una consulta operativa automática al iniciar
   * una conversación.
   *
   * No consulta Firebase directamente.
   * No modifica el DOM.
   * No escribe información.
   */

  const Proactive = {
    version: '1.0.0',

    running: false,
    lastRunAt: null,

    getQuestion() {
      return '¿Qué requiere atención prioritaria hoy?';
    },

    canRun() {
      return Boolean(
        window.AdminIAPlanner &&
        typeof window.AdminIAPlanner.executeQuestion === 'function'
      );
    },

    execute() {
      if (this.running) {
        return {
          ok: false,
          skipped: true,
          reason: 'already_running'
        };
      }

      if (!this.canRun()) {
        return {
          ok: false,
          skipped: true,
          reason: 'planner_unavailable'
        };
      }

      this.running = true;

      try {
        const question = this.getQuestion();

        let result =
          window.AdminIAPlanner.executeQuestion(question);

        if (
          window.AdminIAReasoner &&
          typeof window.AdminIAReasoner.analyze === 'function'
        ) {
          result =
            window.AdminIAReasoner.analyze(result);
        }

        this.lastRunAt =
          new Date().toISOString();

        return {
          ok: Boolean(result?.ok),
          question,
          result,
          generatedAt: this.lastRunAt,
          version: this.version
        };
      } catch (error) {
        console.error(
          '[IA Cuichapa] Error en revisión proactiva:',
          error
        );

        return {
          ok: false,
          error:
            error?.message ||
            'No fue posible generar la revisión proactiva.'
        };
      } finally {
        this.running = false;
      }
    },

    healthCheck() {
      return {
        ok: Boolean(
          this.getQuestion() &&
          typeof this.execute === 'function' &&
          typeof this.canRun === 'function'
        ),
        version: this.version,
        plannerAvailable: this.canRun(),
        question: this.getQuestion()
      };
    }
  };

  window.AdminIAProactive = Proactive;

  console.info(
    '[IA Cuichapa] Proactive cargado:',
    Proactive.version
  );
})();

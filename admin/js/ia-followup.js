(function () {
  'use strict';

  /**
   * IA CUICHAPA — FOLLOW-UP
   *
   * Responde preguntas relacionadas con el resultado anterior:
   * - ¿Por qué?
   * - Dame solo lo importante.
   * - ¿Qué recomiendas?
   * - Dame más detalles.
   * - ¿Qué te preocupa?
   *
   * No consulta Firebase.
   * No modifica el DOM.
   * No escribe información.
   */

  const Followup = {
    version: '1.0.0',

    normalize(value) {
      return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[¿?¡!.,;:()[\]{}"'`´]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    },

    includesAny(text, terms) {
      return terms.some(term =>
        text.includes(term)
      );
    },

    detect(question) {
      const text = this.normalize(question);

      if (!text) {
        return 'none';
      }

      if (
        this.includesAny(text, [
          'por que',
          'explicame',
          'explica eso',
          'como llegaste',
          'como determinaste',
          'en que te basas'
        ])
      ) {
        return 'explanation';
      }

      if (
        this.includesAny(text, [
          'solo lo importante',
          'dame lo importante',
          'resumelo',
          'resumen corto',
          'hazlo corto',
          'en pocas palabras',
          'solo lo principal'
        ])
      ) {
        return 'brief';
      }

      if (
        this.includesAny(text, [
          'que recomiendas',
          'que sugieres',
          'que debo revisar',
          'que reviso',
          'siguiente paso',
          'que hacemos',
          'que hago'
        ])
      ) {
        return 'recommendation';
      }

      if (
        this.includesAny(text, [
          'que te preocupa',
          'que preocupa',
          'cual es el riesgo',
          'que esta mal',
          'que ves mal',
          'mayor problema',
          'principal problema'
        ])
      ) {
        return 'concern';
      }

      if (
        this.includesAny(text, [
          'dame detalles',
          'mas detalles',
          'amplia',
          'amplialo',
          'muestrame la evidencia',
          'que evidencia',
          'datos que usaste'
        ])
      ) {
        return 'details';
      }

      return 'none';
    },

    canHandle(question, previousResult) {
      return Boolean(
        previousResult &&
        previousResult.ok &&
        this.detect(question) !== 'none'
      );
    },

    safeArray(value) {
      return Array.isArray(value)
        ? value.filter(Boolean)
        : [];
    },

    getReasoning(previousResult) {
      return previousResult?.reasoning || {
        attention: 'Sin clasificar',
        confidence: 'Limitada',
        score: 0,
        facts: [],
        findings: [],
        inferences: [],
        recommendations: [],
        cautions: [],
        summary: ''
      };
    },

    buildExplanation(previousResult) {
      const reasoning =
        this.getReasoning(previousResult);

      const facts =
        this.safeArray(reasoning.facts);

      const findings =
        this.safeArray(reasoning.findings);

      const inferences =
        this.safeArray(reasoning.inferences);

      return {
        ok: true,
        intent: 'followup_explanation',

        data: {
          type: 'followup_explanation',

          title:
            'Explicación del análisis anterior',

          lead:
            reasoning.summary ||
            'La conclusión se obtuvo a partir de los datos disponibles en la consulta anterior.',

          facts,
          findings,
          inferences,

          attention:
            reasoning.attention,

          confidence:
            reasoning.confidence
        },

        reasoning,

        metadata: {
          readOnly: true,
          followup: true,
          sourceIntent:
            previousResult.intent || '',
          followupVersion:
            this.version
        }
      };
    },

    buildBrief(previousResult) {
      const reasoning =
        this.getReasoning(previousResult);

      const important = [
        ...this.safeArray(reasoning.findings),
        ...this.safeArray(reasoning.inferences),
        ...this.safeArray(reasoning.facts)
      ].slice(0, 3);

      return {
        ok: true,
        intent: 'followup_brief',

        data: {
          type: 'followup_brief',

          title:
            'Lo más importante',

          lead:
            reasoning.summary ||
            'Este es el resumen principal del análisis anterior.',

          important,

          attention:
            reasoning.attention,

          confidence:
            reasoning.confidence
        },

        reasoning,

        metadata: {
          readOnly: true,
          followup: true,
          sourceIntent:
            previousResult.intent || '',
          followupVersion:
            this.version
        }
      };
    },

    buildRecommendation(previousResult) {
      const reasoning =
        this.getReasoning(previousResult);

      const recommendations =
        this.safeArray(
          reasoning.recommendations
        );

      const cautions =
        this.safeArray(reasoning.cautions);

      return {
        ok: true,
        intent: 'followup_recommendation',

        data: {
          type: 'followup_recommendation',

          title:
            'Siguiente revisión sugerida',

          lead:
            recommendations.length
              ? 'Estas acciones se derivan de los hallazgos del análisis anterior.'
              : 'El análisis anterior no generó una acción específica.',

          recommendations:
            recommendations.length
              ? recommendations
              : [
                  'Validar la información con el responsable operativo antes de tomar una decisión.'
                ],

          cautions,

          attention:
            reasoning.attention,

          confidence:
            reasoning.confidence
        },

        reasoning,

        metadata: {
          readOnly: true,
          followup: true,
          sourceIntent:
            previousResult.intent || '',
          followupVersion:
            this.version
        }
      };
    },

    buildConcern(previousResult) {
      const reasoning =
        this.getReasoning(previousResult);

      const findings =
        this.safeArray(reasoning.findings);

      const concern =
        findings[0] ||
        reasoning.summary ||
        'No se identificó una preocupación principal en el análisis anterior.';

      return {
        ok: true,
        intent: 'followup_concern',

        data: {
          type: 'followup_concern',

          title:
            'Principal punto de atención',

          lead: concern,

          findings:
            findings.slice(0, 5),

          attention:
            reasoning.attention,

          confidence:
            reasoning.confidence
        },

        reasoning,

        metadata: {
          readOnly: true,
          followup: true,
          sourceIntent:
            previousResult.intent || '',
          followupVersion:
            this.version
        }
      };
    },

    buildDetails(previousResult) {
      const reasoning =
        this.getReasoning(previousResult);

      return {
        ok: true,
        intent: 'followup_details',

        data: {
          type: 'followup_details',

          title:
            'Evidencia y detalles del análisis',

          lead:
            'Estos son los elementos utilizados para construir la respuesta anterior.',

          facts:
            this.safeArray(reasoning.facts),

          findings:
            this.safeArray(reasoning.findings),

          inferences:
            this.safeArray(reasoning.inferences),

          recommendations:
            this.safeArray(
              reasoning.recommendations
            ),

          cautions:
            this.safeArray(reasoning.cautions),

          attention:
            reasoning.attention,

          confidence:
            reasoning.confidence,

          score:
            reasoning.score || 0
        },

        reasoning,

        metadata: {
          readOnly: true,
          followup: true,
          sourceIntent:
            previousResult.intent || '',
          followupVersion:
            this.version
        }
      };
    },

    handle(question, previousResult) {
      const type = this.detect(question);

      if (
        type === 'none' ||
        !previousResult
      ) {
        return {
          handled: false,
          result: null
        };
      }

      let result;

      switch (type) {
        case 'explanation':
          result =
            this.buildExplanation(
              previousResult
            );
          break;

        case 'brief':
          result =
            this.buildBrief(
              previousResult
            );
          break;

        case 'recommendation':
          result =
            this.buildRecommendation(
              previousResult
            );
          break;

        case 'concern':
          result =
            this.buildConcern(
              previousResult
            );
          break;

        case 'details':
          result =
            this.buildDetails(
              previousResult
            );
          break;

        default:
          return {
            handled: false,
            result: null
          };
      }

      return {
        handled: true,
        type,
        result
      };
    },

    healthCheck() {
      const sample = {
        ok: true,
        intent: 'well_history',

        reasoning: {
          attention: 'Media',
          confidence: 'Alta',
          score: 5,

          facts: [
            'El último estado reportado es Cerrado.'
          ],

          findings: [
            'El envío aparece pendiente.'
          ],

          inferences: [
            'La condición requiere verificación.'
          ],

          recommendations: [
            'Revisar el reporte con el responsable.'
          ],

          cautions: [
            'No se puede confirmar la causa física.'
          ],

          summary:
            'Se detectaron hallazgos relevantes.'
        }
      };

      const tests = [
        {
          question: '¿Por qué?',
          expected: 'explanation'
        },
        {
          question: 'Dame solo lo importante',
          expected: 'brief'
        },
        {
          question: '¿Qué recomiendas?',
          expected: 'recommendation'
        },
        {
          question: '¿Qué te preocupa?',
          expected: 'concern'
        },
        {
          question: 'Dame más detalles',
          expected: 'details'
        }
      ];

      const results = tests.map(test => {
        const handled =
          this.handle(
            test.question,
            sample
          );

        return {
          question:
            test.question,

          expected:
            test.expected,

          received:
            handled.type,

          ok:
            handled.handled &&
            handled.type === test.expected
        };
      });

      return {
        ok:
          results.every(result => result.ok),

        version:
          this.version,

        passed:
          results.filter(result => result.ok)
            .length,

        total:
          results.length,

        results
      };
    }
  };

  window.AdminIAFollowup = Followup;

  console.info(
    '[IA Cuichapa] Follow-up cargado:',
    Followup.version
  );
})();

(function () {
  'use strict';

  /**
   * IA CUICHAPA — NLU
   * Natural Language Understanding
   *
   * Responsabilidad:
   * - Interpretar preguntas escritas en lenguaje natural.
   * - Detectar intención, entidades, fechas y modificadores.
   * - No consulta Firebase.
   * - No modifica el DOM.
   * - No genera respuestas.
   */

  const NLU = {
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

    tokenize(value) {
      const normalized = this.normalize(value);

      return normalized
        ? normalized.split(' ').filter(Boolean)
        : [];
    },

    today() {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      return date;
    },

    addDays(date, days) {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      result.setHours(0, 0, 0, 0);
      return result;
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

    includesAny(text, terms) {
      return terms.some(term => text.includes(term));
    },

    countMatches(text, terms) {
      return terms.reduce((total, term) => {
        return total + (text.includes(term) ? 1 : 0);
      }, 0);
    },

    extractWell(originalQuestion, normalizedQuestion) {
      const original = String(originalQuestion ?? '');

      const explicit = original.match(
        /\bpozo[\s:#-]*(\d{1,4}[a-z]?)\b/i
      );

      if (explicit) {
        return explicit[1].toUpperCase();
      }

      const contextual = original.match(
        /\b(?:ver|buscar|mostrar|muestrame|consultar|consulta|historial|estado|reporte|reportes|como anda|como esta|que paso con|del|el)\s+(?:pozo\s+)?(\d{1,4}[a-z]?)\b/i
      );

      if (contextual) {
        return contextual[1].toUpperCase();
      }

      const onlyWell = normalizedQuestion.match(
        /^(?:pozo\s*)?(\d{1,4}[a-z]?)$/
      );

      if (onlyWell) {
        return onlyWell[1].toUpperCase();
      }

      return '';
    },

    extractWorkers(normalizedQuestion) {
      const aliases = [
        {
          canonical: 'Juan Carlos Flores',
          aliases: [
            'juan carlos flores',
            'juan carlos',
            'juan',
            'flores'
          ]
        },
        {
          canonical: 'Luis Carlos Flores Cruz',
          aliases: [
            'luis carlos flores cruz',
            'luis carlos flores',
            'luis carlos',
            'luis',
            'flores cruz'
          ]
        },
        {
          canonical: 'Manrique',
          aliases: [
            'manrique'
          ]
        },
        {
          canonical: 'Cirilo Cancino Gómez',
          aliases: [
            'cirilo cancino gomez',
            'cirilo cancino',
            'cirilo'
          ]
        }
      ];

      const matches = [];

      aliases.forEach(worker => {
        const matchedAlias = worker.aliases.find(alias => {
          const escaped = alias.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          );

          return new RegExp(
            `(?:^|\\s)${escaped}(?:$|\\s)`
          ).test(normalizedQuestion);
        });

        if (matchedAlias) {
          matches.push({
            name: worker.canonical,
            alias: matchedAlias
          });
        }
      });

      const unique = [];

      matches.forEach(match => {
        if (!unique.some(item => item.name === match.name)) {
          unique.push(match);
        }
      });

      return unique;
    },

    extractDateRange(normalizedQuestion) {
      const today = this.today();

      if (normalizedQuestion.includes('anteayer')) {
        const date = this.addDays(today, -2);

        return {
          type: 'day',
          label: 'anteayer',
          from: this.toYMD(date),
          to: this.toYMD(date)
        };
      }

      if (normalizedQuestion.includes('ayer')) {
        const date = this.addDays(today, -1);

        return {
          type: 'day',
          label: 'ayer',
          from: this.toYMD(date),
          to: this.toYMD(date)
        };
      }

      if (
        normalizedQuestion.includes('hoy') ||
        normalizedQuestion.includes('este dia') ||
        normalizedQuestion.includes('dia actual')
      ) {
        return {
          type: 'day',
          label: 'hoy',
          from: this.toYMD(today),
          to: this.toYMD(today)
        };
      }

      if (
        normalizedQuestion.includes('esta semana') ||
        normalizedQuestion.includes('semana actual')
      ) {
        const day = today.getDay();
        const offset = day === 0 ? -6 : 1 - day;
        const monday = this.addDays(today, offset);

        return {
          type: 'range',
          label: 'esta semana',
          from: this.toYMD(monday),
          to: this.toYMD(today)
        };
      }

      if (
        normalizedQuestion.includes('ultimos 7 dias') ||
        normalizedQuestion.includes('últimos 7 días')
      ) {
        return {
          type: 'range',
          label: 'últimos 7 días',
          from: this.toYMD(this.addDays(today, -6)),
          to: this.toYMD(today)
        };
      }

      const isoDate = normalizedQuestion.match(
        /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/
      );

      if (isoDate) {
        const date = new Date(
          Number(isoDate[1]),
          Number(isoDate[2]) - 1,
          Number(isoDate[3])
        );

        if (!Number.isNaN(date.getTime())) {
          return {
            type: 'day',
            label: this.toYMD(date),
            from: this.toYMD(date),
            to: this.toYMD(date)
          };
        }
      }

      const dmyDate = normalizedQuestion.match(
        /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/
      );

      if (dmyDate) {
        const date = new Date(
          Number(dmyDate[3]),
          Number(dmyDate[2]) - 1,
          Number(dmyDate[1])
        );

        if (!Number.isNaN(date.getTime())) {
          return {
            type: 'day',
            label: this.toYMD(date),
            from: this.toYMD(date),
            to: this.toYMD(date)
          };
        }
      }

      return {
        type: 'day',
        label: 'hoy',
        from: this.toYMD(today),
        to: this.toYMD(today),
        inferred: true
      };
    },

    extractStatus(normalizedQuestion) {
      if (
        this.includesAny(normalizedQuestion, [
          'intermitente',
          'intermitentes'
        ])
      ) {
        return 'Intermitente';
      }

      if (
        this.includesAny(normalizedQuestion, [
          'cerrado',
          'cerrados',
          'cerrada',
          'cerradas'
        ])
      ) {
        return 'Cerrado';
      }

      if (
        this.includesAny(normalizedQuestion, [
          'abierto',
          'abiertos',
          'abierta',
          'abiertas'
        ])
      ) {
        return 'Abierto';
      }

      return '';
    },

    detectComparison(normalizedQuestion) {
      return this.includesAny(normalizedQuestion, [
        'compara',
        'comparar',
        'comparacion',
        'contra',
        'versus',
        ' vs ',
        'diferencia entre',
        'quien hizo mas',
        'quien trabajo mas',
        'cual tuvo mas'
      ]);
    },

    detectIntent(question) {
      const normalized = this.normalize(question);
      const workers = this.extractWorkers(normalized);
      const well = this.extractWell(question, normalized);
      const dateRange = this.extractDateRange(normalized);
      const status = this.extractStatus(normalized);
      const comparison = this.detectComparison(normalized);

      const scores = {
        help: this.countMatches(normalized, [
          'ayuda',
          'que puedes hacer',
          'como funciona',
          'que puedo preguntar',
          'consultas disponibles'
        ]),

        indicators: this.countMatches(normalized, [
          'indicador',
          'indicadores',
          'super total',
          'vrt',
          'smt',
          'mediciones totales'
        ]),

        alarms: this.countMatches(normalized, [
          'alarma',
          'alarmas',
          'alerta',
          'alertas',
          'emergencia',
          'incidente'
        ]),

        gps: this.countMatches(normalized, [
          'gps',
          'ubicacion',
          'coordenada',
          'coordenadas',
          'fuera de radio',
          'distancia',
          'sin ubicacion',
          'sin gps'
        ]),

        whatsapp: this.countMatches(normalized, [
          'whatsapp',
          'enviado',
          'enviados',
          'pendiente',
          'pendientes',
          'fallo de envio',
          'error de envio',
          'no llego',
          'no enviado'
        ]),

        summary: this.countMatches(normalized, [
          'resumen',
          'que paso',
          'como vamos',
          'actividad',
          'jornada',
          'panorama',
          'situacion',
          'balance',
          'resultado del dia'
        ]),

        wellHistory: this.countMatches(normalized, [
          'historial',
          'ultimo reporte',
          'ultimos reportes',
          'como esta',
          'como anda',
          'que paso con',
          'informacion del pozo',
          'ver pozo',
          'buscar pozo',
          'muestrame el pozo'
        ]),

        workerActivity: this.countMatches(normalized, [
          'que hizo',
          'actividad de',
          'reportes de',
          'trabajo de',
          'recorrido de',
          'como trabajo',
          'cuantos reportes hizo',
          'cuantos pozos visito'
        ]),

        statusWells: this.countMatches(normalized, [
          'pozos abiertos',
          'pozos cerrados',
          'pozos intermitentes',
          'estado de pozos',
          'cuales estan',
          'que pozos estan'
        ]),

        reports: this.countMatches(normalized, [
          'reporte',
          'reportes',
          'visitas',
          'registros'
        ]),

        trends: this.countMatches(normalized, [
          'tendencia',
          'tendencias',
          'evolucion',
          'cambio',
          'subio',
          'bajo',
          'aumento',
          'disminuyo'
        ]),

        diagnosis: this.countMatches(normalized, [
          'diagnostico',
          'problema',
          'problemas',
          'anomalia',
          'anomalias',
          'requiere atencion',
          'revisar primero',
          'prioridad',
          'riesgo'
        ])
      };

      if (well) {
        scores.wellHistory += 3;
      }

      if (workers.length === 1) {
        scores.workerActivity += 3;
      }

      if (workers.length > 1 || comparison) {
        scores.comparison = 5;
      } else {
        scores.comparison = 0;
      }

      if (status) {
        scores.statusWells += 3;
      }

      if (
        normalized === 'hoy' ||
        normalized === 'resumen de hoy'
      ) {
        scores.summary += 4;
      }

      let intent = 'unknown';
      let highestScore = 0;

      Object.entries(scores).forEach(([name, score]) => {
        if (score > highestScore) {
          intent = name;
          highestScore = score;
        }
      });

      const intentMap = {
        help: 'help',
        indicators: 'indicators',
        alarms: 'alarms',
        gps: 'gps_issues',
        whatsapp: 'whatsapp_status',
        summary: 'daily_summary',
        wellHistory: 'well_history',
        workerActivity: 'worker_activity',
        statusWells: 'well_status',
        reports: 'reports',
        trends: 'trends',
        diagnosis: 'diagnosis',
        comparison: 'comparison'
      };

      const confidence =
        highestScore >= 5
          ? 'high'
          : highestScore >= 3
            ? 'medium'
            : highestScore >= 1
              ? 'low'
              : 'none';

      return {
        intent: intentMap[intent] || 'unknown',
        confidence,
        score: highestScore,
        entities: {
          well,
          workers: workers.map(item => item.name),
          workerAliases: workers.map(item => item.alias),
          status,
          dateRange
        },
        modifiers: {
          comparison,
          wantsHistory: this.includesAny(normalized, [
            'historial',
            'ultimos',
            'anteriores'
          ]),
          wantsLatest: this.includesAny(normalized, [
            'ultimo',
            'ultima',
            'actual',
            'reciente'
          ]),
          wantsCount: this.includesAny(normalized, [
            'cuantos',
            'cuantas',
            'total',
            'cantidad'
          ]),
          wantsExplanation: this.includesAny(normalized, [
            'por que',
            'explica',
            'razon',
            'causa'
          ])
        },
        normalized,
        original: String(question ?? '').trim(),
        scores
      };
    },

    analyze(question) {
      return this.detectIntent(question);
    },

    analyzeMany(questions) {
      if (!Array.isArray(questions)) {
        return [];
      }

      return questions.map(question =>
        this.analyze(question)
      );
    },

    healthCheck() {
      const tests = [
        {
          question: 'Muéstrame el pozo 505',
          expected: 'well_history'
        },
        {
          question: '¿Qué hizo Luis Carlos hoy?',
          expected: 'worker_activity'
        },
        {
          question: '¿Qué alarmas hubo ayer?',
          expected: 'alarms'
        },
        {
          question: 'Reportes fuera de radio',
          expected: 'gps_issues'
        },
        {
          question: 'Pozos intermitentes',
          expected: 'well_status'
        },
        {
          question: 'Muéstrame VRT y SMT',
          expected: 'indicators'
        },
        {
          question: 'Compara a Juan Carlos con Manrique',
          expected: 'comparison'
        }
      ];

      const results = tests.map(test => {
        const analysis = this.analyze(test.question);

        return {
          question: test.question,
          expected: test.expected,
          received: analysis.intent,
          ok: analysis.intent === test.expected
        };
      });

      return {
        ok: results.every(result => result.ok),
        version: this.version,
        passed: results.filter(result => result.ok).length,
        total: results.length,
        results
      };
    }
  };

  window.AdminIANLU = NLU;

  console.info(
    '[IA Cuichapa] NLU cargado:',
    NLU.version
  );
})();

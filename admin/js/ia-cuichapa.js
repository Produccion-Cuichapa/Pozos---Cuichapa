(function () {
  'use strict';

  /**
   * IA CUICHAPA — INTERFAZ CONVERSACIONAL
   *
   * Flujo:
   * Usuario
   *   → AdminIANLU
   *   → AdminIAPlanner
   *   → AdminIAEngine
   *   → respuesta conversacional
   *
   * No crea listeners de Firebase.
   * No modifica reportes ni alarmas.
   */

  const Chat = {
    version: '2.0.0',
    initialized: false,
    busy: false,
    lastResult: null,
    proactiveShown: false,
    proactiveTimer: null,

    normalize(value) {
      return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    },

    create(tag, className, text) {
      const element = document.createElement(tag);

      if (className) {
        element.className = className;
      }

      if (text !== undefined && text !== null) {
        element.textContent = String(text);
      }

      return element;
    },

    clear(element) {
      while (element && element.firstChild) {
        element.removeChild(element.firstChild);
      }
    },

    formatDate(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return 'Sin fecha';
      }

      return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    },

    formatTime(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return 'Sin hora';
      }

      return new Intl.DateTimeFormat('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date);
    },

    formatRange(range) {
      if (!range) {
        return 'periodo consultado';
      }

      if (range.label) {
        return range.label;
      }

      if (range.from === range.to) {
        return range.from;
      }

      return `${range.from} al ${range.to}`;
    },

    getView() {
      return document.getElementById('iaView');
    },

    getMessages() {
      return document.getElementById('iaChatMessages');
    },

    getInput() {
      return document.getElementById('iaChatInput');
    },

    getSendButton() {
      return document.getElementById('iaChatSend');
    },

    scrollToBottom() {
      const messages = this.getMessages();

      if (!messages) {
        return;
      }

      window.requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
      });
    },

    autoResizeInput() {
      const input = this.getInput();

      if (!input) {
        return;
      }

      input.style.height = 'auto';
      input.style.height =
        `${Math.min(input.scrollHeight, 160)}px`;
    },

    createAvatar(type) {
      const avatar = this.create(
        'div',
        `ia-chat-avatar ia-chat-avatar-${type}`
      );

      avatar.textContent = type === 'assistant'
        ? '🤖'
        : 'TÚ';

      return avatar;
    },

    addUserMessage(question) {
      const messages = this.getMessages();

      if (!messages) {
        return;
      }

      const article = this.create(
        'article',
        'ia-chat-message ia-chat-message-user'
      );

      const body = this.create(
        'div',
        'ia-chat-message-body'
      );

      body.appendChild(
        this.create(
          'div',
          'ia-chat-message-name',
          'Tú'
        )
      );

      body.appendChild(
        this.create(
          'div',
          'ia-chat-user-bubble',
          question
        )
      );

      article.appendChild(body);
      article.appendChild(this.createAvatar('user'));

      messages.appendChild(article);
      this.scrollToBottom();
    },

    addAssistantMessage(content) {
      const messages = this.getMessages();

      if (!messages) {
        return null;
      }

      const article = this.create(
        'article',
        'ia-chat-message ia-chat-message-assistant'
      );

      article.appendChild(
        this.createAvatar('assistant')
      );

      const body = this.create(
        'div',
        'ia-chat-message-body'
      );

      const header = this.create(
        'div',
        'ia-chat-assistant-header'
      );

      header.appendChild(
        this.create(
          'strong',
          'ia-chat-message-name',
          'IA Cuichapa'
        )
      );

      header.appendChild(
        this.create(
          'span',
          'ia-chat-readonly-badge',
          'Solo lectura'
        )
      );

      body.appendChild(header);

      if (content?.title) {
        body.appendChild(
          this.create(
            'h3',
            'ia-chat-answer-title',
            content.title
          )
        );
      }

      if (content?.lead) {
        body.appendChild(
          this.create(
            'p',
            'ia-chat-answer-lead',
            content.lead
          )
        );
      }

      if (
        Array.isArray(content?.metrics) &&
        content.metrics.length
      ) {
        body.appendChild(
          this.renderMetrics(content.metrics)
        );
      }

      if (
        Array.isArray(content?.sections) &&
        content.sections.length
      ) {
        content.sections.forEach(section => {
          body.appendChild(
            this.renderSection(section)
          );
        });
      }

      if (
        Array.isArray(content?.items) &&
        content.items.length
      ) {
        body.appendChild(
          this.renderItems(content.items)
        );
      }

      if (content?.note) {
        body.appendChild(
          this.create(
            'p',
            'ia-chat-answer-note',
            content.note
          )
        );
      }

      article.appendChild(body);
      messages.appendChild(article);

      this.scrollToBottom();

      return article;
    },

    renderMetrics(metrics) {
      const grid = this.create(
        'div',
        'ia-chat-metrics'
      );

      metrics.forEach(metric => {
        const card = this.create(
          'div',
          'ia-chat-metric'
        );

        card.appendChild(
          this.create(
            'strong',
            'ia-chat-metric-value',
            metric.value
          )
        );

        card.appendChild(
          this.create(
            'span',
            'ia-chat-metric-label',
            metric.label
          )
        );

        grid.appendChild(card);
      });

      return grid;
    },

    renderSection(section) {
      const block = this.create(
        'section',
        'ia-chat-answer-section'
      );

      if (section.title) {
        block.appendChild(
          this.create(
            'h4',
            'ia-chat-answer-section-title',
            section.title
          )
        );
      }

      if (section.text) {
        block.appendChild(
          this.create(
            'p',
            'ia-chat-answer-text',
            section.text
          )
        );
      }

      if (
        Array.isArray(section.rows) &&
        section.rows.length
      ) {
        const table = this.create(
          'div',
          'ia-chat-detail-table'
        );

        section.rows.forEach(row => {
          const line = this.create(
            'div',
            'ia-chat-detail-row'
          );

          line.appendChild(
            this.create(
              'span',
              'ia-chat-detail-label',
              row.label
            )
          );

          line.appendChild(
            this.create(
              'strong',
              'ia-chat-detail-value',
              row.value || 'Sin información'
            )
          );

          table.appendChild(line);
        });

        block.appendChild(table);
      }

      if (
        Array.isArray(section.bullets) &&
        section.bullets.length
      ) {
        const list = this.create(
          'ul',
          'ia-chat-bullets'
        );

        section.bullets.forEach(item => {
          list.appendChild(
            this.create('li', '', item)
          );
        });

        block.appendChild(list);
      }

      return block;
    },

    renderItems(items) {
      const container = this.create(
        'div',
        'ia-chat-result-list'
      );

      items.forEach(item => {
        const card = this.create(
          'article',
          'ia-chat-result-item'
        );

        const header = this.create(
          'div',
          'ia-chat-result-header'
        );

        header.appendChild(
          this.create(
            'strong',
            'ia-chat-result-title',
            item.title
          )
        );

        if (item.meta) {
          header.appendChild(
            this.create(
              'span',
              'ia-chat-result-meta',
              item.meta
            )
          );
        }

        card.appendChild(header);

        if (item.description) {
          card.appendChild(
            this.create(
              'p',
              'ia-chat-result-description',
              item.description
            )
          );
        }

        container.appendChild(card);
      });

      return container;
    },

    showTyping() {
      const messages = this.getMessages();

      if (!messages) {
        return;
      }

      const article = this.create(
        'article',
        'ia-chat-message ia-chat-message-assistant'
      );

      article.id = 'iaChatTyping';

      article.appendChild(
        this.createAvatar('assistant')
      );

      const body = this.create(
        'div',
        'ia-chat-message-body'
      );

      body.appendChild(
        this.create(
          'div',
          'ia-chat-message-name',
          'IA Cuichapa'
        )
      );

      const typing = this.create(
        'div',
        'ia-chat-typing'
      );

      typing.appendChild(this.create('span'));
      typing.appendChild(this.create('span'));
      typing.appendChild(this.create('span'));

      body.appendChild(typing);
      article.appendChild(body);
      messages.appendChild(article);

      this.scrollToBottom();
    },

    hideTyping() {
      const typing =
        document.getElementById('iaChatTyping');

      if (typing) {
        typing.remove();
      }
    },

    reportDescription(report) {
      const parts = [];

      if (report.modo) {
        parts.push(report.modo);
      }

      if (report.estatus) {
        parts.push(`Estado: ${report.estatus}`);
      }

      if (report.recorredor) {
        parts.push(`Recorredor: ${report.recorredor}`);
      }

      if (report.tieneGps) {
        parts.push(
          report.distancia !== null
            ? `GPS: ${Math.round(report.distancia)} m`
            : 'GPS disponible'
        );
      } else {
        parts.push('Sin GPS');
      }

      if (report.whatsapp) {
        parts.push(`WhatsApp: ${report.whatsapp}`);
      }

      return parts.join(' · ');
    },

    reportToItem(report) {
      return {
        title: report.pozo
          ? `Pozo ${report.pozo}`
          : 'Reporte operativo',

        meta:
          `${this.formatDate(report.date)} · ` +
          `${this.formatTime(report.date)}`,

        description:
          this.reportDescription(report)
      };
    },

    alarmToItem(alarm) {
      const engine = window.AdminIAEngine;
      const parsed = engine?.parseReport(alarm) || {};
      const date = engine?.getDate(alarm);
      const well = engine?.getWell(alarm, parsed);
      const worker = engine?.getWorker(alarm, parsed);

      const message =
        alarm?.mensaje ||
        alarm?.msg ||
        parsed?.mensaje ||
        parsed?.observaciones ||
        'Alarma operativa registrada';

      return {
        title: well
          ? `Alarma en pozo ${well}`
          : 'Alarma operativa',

        meta:
          `${this.formatDate(date)} · ` +
          `${this.formatTime(date)}`,

        description:
          worker
            ? `${message} · Reportó: ${worker}`
            : message
      };
    },

    buildDailySummary(data) {
      const period = this.formatRange(data.range);

      return {
        title: `Resumen operativo de ${period}`,

        lead:
          data.reportes
            ? `Durante ${period} se registraron ${data.reportes} reportes correspondientes a ${data.pozosVisitados} pozos.`
            : `No se localizaron reportes operativos durante ${period}.`,

        metrics: [
          {
            label: 'Reportes',
            value: data.reportes
          },
          {
            label: 'Pozos visitados',
            value: data.pozosVisitados
          },
          {
            label: 'Recorredores activos',
            value: data.recorredoresActivos
          },
          {
            label: 'Alarmas',
            value: data.alarmas
          },
          {
            label: 'Problemas GPS',
            value: data.problemasGps ?? '—'
          },
          {
            label: 'Envíos por revisar',
            value: data.whatsappPendientes ?? '—'
          }
        ],

        sections: data.recorredores?.length
          ? [{
              title: 'Recorredores con actividad',
              text: data.recorredores.join(', ')
            }]
          : [],

        note:
          'Resumen generado con la información cargada actualmente en la plataforma.'
      };
    },

    buildIndicators(data) {
      const indicators = data.indicadores || {};

      return {
        title: 'Indicadores operativos',

        lead:
          indicators.available
            ? 'Estos son los valores vigentes calculados por el tablero.'
            : 'Los indicadores todavía no están disponibles en el tablero.',

        metrics: [
          {
            label: 'SUPER TOTAL',
            value: indicators.superTotal ?? 0
          },
          {
            label: 'VRT',
            value: indicators.vrt ?? 0
          },
          {
            label: 'SMT',
            value: indicators.smt ?? 0
          }
        ],

        sections: [{
          title: 'Interpretación',
          bullets: [
            'VRT corresponde a la suma de los valores VR positivos.',
            'SMT corresponde a SUPER TOTAL más VRT.'
          ]
        }]
      };
    },

    buildWellHistory(data) {
      if (data.requiresInput) {
        return {
          title: 'Necesito el número del pozo',
          lead:
            'Escribe, por ejemplo: “¿Cómo anda el pozo 505?”'
        };
      }

      if (!data.total || !data.latest) {
        return {
          title: `Pozo ${data.well}`,
          lead:
            'No encontré reportes para este pozo dentro del periodo consultado.'
        };
      }

      const latest = data.latest;
      const rows = [
        {
          label: 'Último reporte',
          value:
            `${this.formatDate(latest.date)} a las ` +
            this.formatTime(latest.date)
        },
        {
          label: 'Estado',
          value: latest.estatus
        },
        {
          label: 'Modo',
          value: latest.modo
        },
        {
          label: 'Recorredor',
          value: latest.recorredor
        },
        {
          label: 'SAP',
          value: latest.sap
        },
        {
          label: 'Ubicación',
          value:
            latest.tieneGps
              ? latest.distancia !== null
                ? `${Math.round(latest.distancia)} metros`
                : 'GPS disponible'
              : 'Sin GPS'
        },
        {
          label: 'WhatsApp',
          value: latest.whatsapp
        }
      ];

      const observation =
        String(latest.observaciones || '').trim();

      return {
        title: `Pozo ${data.well}`,

        lead:
          `El último reporte indica que el pozo está ` +
          `${latest.estatus || 'sin estado identificado'}. ` +
          `Fue reportado por ${latest.recorredor || 'un recorredor no identificado'}.`,

        sections: [
          {
            title: 'Última condición reportada',
            rows
          },
          ...(observation && observation.length < 300
            ? [{
                title: 'Observación',
                text: observation
              }]
            : [])
        ],

        items:
          data.reports
            .slice(0, 5)
            .map(report =>
              this.reportToItem(report)
            ),

        note:
          data.total > 5
            ? `Se muestran los cinco reportes más recientes de ${data.total} encontrados.`
            : ''
      };
    },

    buildWorkerActivity(data) {
      if (data.requiresInput) {
        return {
          title: 'Necesito el nombre del recorredor',
          lead:
            'Escribe, por ejemplo: “¿Qué hizo Luis Carlos hoy?”'
        };
      }

      const worker = data.workers?.[0];

      if (!worker) {
        return {
          title: 'Actividad del recorredor',
          lead:
            'No se encontraron datos para el recorredor consultado.'
        };
      }

      return {
        title: worker.worker,

        lead:
          worker.reportes
            ? `Registró ${worker.reportes} reportes y visitó ${worker.pozosVisitados} pozos durante ${this.formatRange(data.range)}.`
            : `No registró reportes durante ${this.formatRange(data.range)}.`,

        metrics: [
          {
            label: 'Reportes',
            value: worker.reportes
          },
          {
            label: 'Pozos visitados',
            value: worker.pozosVisitados
          },
          {
            label: 'Problemas GPS',
            value: worker.problemasGps
          },
          {
            label: 'Envíos por revisar',
            value: worker.whatsappPendientes
          }
        ],

        sections: worker.reportes
          ? [{
              title: 'Horario de actividad',
              rows: [
                {
                  label: 'Primer reporte',
                  value:
                    this.formatTime(
                      worker.primerReporte?.date
                    )
                },
                {
                  label: 'Último reporte',
                  value:
                    this.formatTime(
                      worker.ultimoReporte?.date
                    )
                }
              ]
            }]
          : [],

        items:
          worker.reports
            .slice(0, 8)
            .map(report =>
              this.reportToItem(report)
            )
      };
    },

    buildAlarms(data) {
      const alarms = data.alarms || [];

      return {
        title:
          alarms.length === 1
            ? '1 alarma localizada'
            : `${alarms.length} alarmas localizadas`,

        lead:
          alarms.length
            ? `Estas son las alarmas registradas durante ${this.formatRange(data.range)}.`
            : `No encontré alarmas durante ${this.formatRange(data.range)}.`,

        items:
          alarms
            .slice(0, 10)
            .map(alarm =>
              this.alarmToItem(alarm)
            )
      };
    },

    buildGps(data) {
      return {
        title:
          data.total === 1
            ? '1 reporte requiere revisión de ubicación'
            : `${data.total} reportes requieren revisión de ubicación`,

        lead:
          data.total
            ? 'Detecté reportes sin coordenadas o con una distancia mayor al radio permitido.'
            : 'No detecté problemas de ubicación durante el periodo consultado.',

        metrics: [
          {
            label: 'Total',
            value: data.total
          },
          {
            label: 'Sin GPS',
            value: data.sinGps
          },
          {
            label: 'Fuera de radio',
            value: data.fueraDeRadio
          }
        ],

        items:
          data.reports
            .slice(0, 10)
            .map(report =>
              this.reportToItem(report)
            )
      };
    },

    buildWhatsapp(data) {
      return {
        title:
          data.total === 1
            ? '1 envío requiere revisión'
            : `${data.total} envíos requieren revisión`,

        lead:
          data.total
            ? 'Estos reportes no aparecen confirmados como enviados correctamente.'
            : 'Todos los reportes del periodo aparecen enviados correctamente.',

        metrics: [
          {
            label: 'Pendientes',
            value: data.pendientes
          },
          {
            label: 'Errores',
            value: data.errores
          },
          {
            label: 'Sin confirmar',
            value: data.sinConfirmar
          }
        ],

        items:
          data.reports
            .slice(0, 10)
            .map(report =>
              this.reportToItem(report)
            )
      };
    },

    buildWellStatus(data) {
      const status = data.status || 'consultado';

      return {
        title:
          `${data.total} pozo${data.total === 1 ? '' : 's'} ` +
          `${status.toLowerCase()}${data.total === 1 ? '' : 's'}`,

        lead:
          data.total
            ? `Tomé el reporte más reciente de cada pozo durante ${this.formatRange(data.range)}.`
            : `No encontré pozos con estado ${status.toLowerCase()} durante el periodo consultado.`,

        items:
          data.wells
            .slice(0, 20)
            .map(report =>
              this.reportToItem(report)
            )
      };
    },

    buildReports(data) {
      return {
        title:
          `${data.total} reporte${data.total === 1 ? '' : 's'} localizado${data.total === 1 ? '' : 's'}`,

        lead:
          data.total
            ? `Corresponden a ${data.pozos.length} pozos durante ${this.formatRange(data.range)}.`
            : 'No encontré reportes en el periodo consultado.',

        items:
          data.reports
            .slice(0, 15)
            .map(report =>
              this.reportToItem(report)
            )
      };
    },

    buildComparison(data) {
      if (data.requiresInput) {
        return {
          title: 'Necesito dos recorredores',
          lead:
            'Escribe, por ejemplo: “Compara a Juan Carlos con Manrique esta semana”.'
        };
      }

      const metrics =
        data.ranking.map(worker => ({
          label: worker.worker,
          value: worker.reportes
        }));

      return {
        title: 'Comparación de recorredores',

        lead:
          data.leader
            ? `${data.leader.worker} registró la mayor cantidad de reportes durante ${this.formatRange(data.range)}.`
            : 'No encontré actividad suficiente para realizar la comparación.',

        metrics,

        sections: data.leader
          ? [{
              title: 'Resultado',
              bullets: [
                `${data.leader.worker}: ${data.leader.reportes} reportes y ${data.leader.pozosVisitados} pozos visitados.`,
                `Diferencia entre los primeros lugares: ${data.difference} reportes.`
              ]
            }]
          : []
      };
    },

    buildDiagnosis(data) {
      const highest = data.highestPriority;

      if (!highest) {
        return {
          title: 'Diagnóstico operativo',
          lead:
            'No detecté hallazgos prioritarios durante el periodo consultado.'
        };
      }

      return {
        title: `Prioridad principal: pozo ${highest.well}`,

        lead:
          `El pozo ${highest.well} obtuvo prioridad ${highest.priority} con una puntuación operativa de ${highest.score}.`,

        metrics: [
          {
            label: 'Pozos revisados',
            value: data.totalReviewed
          },
          {
            label: 'Con hallazgos',
            value: data.totalWithFindings
          },
          {
            label: 'Prioridad',
            value: highest.priority
          },
          {
            label: 'Puntuación',
            value: highest.score
          }
        ],

        sections: [{
          title: 'Motivos principales',
          bullets: highest.reasons
        }],

        items:
          data.priorities
            .slice(0, 8)
            .map(item => ({
              title: `Pozo ${item.well}`,
              meta: `Prioridad ${item.priority}`,
              description:
                item.reasons.join(' · ')
            })),

        note:
          'La prioridad es una orientación automática basada en alarmas, estado, GPS y envíos. Debe validarse con el criterio operativo del responsable.'
      };
    },

    buildTrends(data) {
      if (!data.available) {
        return {
          title: 'Tendencias operativas',
          lead:
            'Necesito información de al menos dos días para identificar una tendencia.'
        };
      }

      const first = data.days[0];
      const last = data.days[data.days.length - 1];

      const difference =
        last.reportes - first.reportes;

      const direction =
        difference > 0
          ? 'aumentó'
          : difference < 0
            ? 'disminuyó'
            : 'se mantuvo igual';

      return {
        title: 'Tendencia de actividad',

        lead:
          `La cantidad diaria de reportes ${direction} entre ${first.date} y ${last.date}.`,

        metrics: [
          {
            label: 'Primer día',
            value: first.reportes
          },
          {
            label: 'Último día',
            value: last.reportes
          },
          {
            label: 'Diferencia',
            value:
              difference > 0
                ? `+${difference}`
                : difference
          },
          {
            label: 'Días analizados',
            value: data.totalDays
          }
        ],

        items:
          data.days.map(day => ({
            title: day.date,
            meta: `${day.reportes} reportes`,
            description:
              `${day.pozosVisitados} pozos · ` +
              `${day.gpsIssues} problemas GPS · ` +
              `${day.whatsappIssues} envíos por revisar`
          }))
      };
    },

    buildHelp() {
      return {
        title: '¿Qué puedes preguntarme?',

        lead:
          'Puedo consultar y analizar la información operativa cargada en la plataforma.',

        sections: [{
          title: 'Ejemplos',
          bullets: [
            '¿Cómo anda el pozo 505?',
            '¿Qué hizo Luis Carlos hoy?',
            '¿Qué alarmas hubo ayer?',
            'Muéstrame los reportes fuera de radio.',
            'Compara a Juan Carlos con Manrique esta semana.',
            '¿Qué pozo requiere atención prioritaria?',
            'Muéstrame SUPER TOTAL, VRT y SMT.',
            '¿Cómo se comportaron los reportes esta semana?'
          ]
        }]
      };
    },

    buildFollowupExplanation(data) {
      return {
        title:
          data.title || 'Explicación',

        lead:
          data.lead || '',

        metrics: [
          {
            label: 'Atención',
            value:
              data.attention || 'Sin clasificar'
          },
          {
            label: 'Confianza',
            value:
              data.confidence || 'Limitada'
          }
        ],

        sections: [
          ...(data.facts?.length
            ? [{
                title: 'Datos confirmados',
                bullets: data.facts
              }]
            : []),

          ...(data.findings?.length
            ? [{
                title: 'Hallazgos',
                bullets: data.findings
              }]
            : []),

          ...(data.inferences?.length
            ? [{
                title: 'Interpretación',
                bullets: data.inferences
              }]
            : [])
        ]
      };
    },

    buildFollowupBrief(data) {
      return {
        title:
          data.title || 'Lo más importante',

        lead:
          data.lead || '',

        metrics: [
          {
            label: 'Atención',
            value:
              data.attention || 'Sin clasificar'
          }
        ],

        sections: data.important?.length
          ? [{
              title: 'Puntos principales',
              bullets: data.important
            }]
          : []
      };
    },

    buildFollowupRecommendation(data) {
      return {
        title:
          data.title ||
          'Siguiente revisión sugerida',

        lead:
          data.lead || '',

        metrics: [
          {
            label: 'Atención',
            value:
              data.attention || 'Sin clasificar'
          },
          {
            label: 'Confianza',
            value:
              data.confidence || 'Limitada'
          }
        ],

        sections: [
          ...(data.recommendations?.length
            ? [{
                title: 'Acciones sugeridas',
                bullets:
                  data.recommendations
              }]
            : []),

          ...(data.cautions?.length
            ? [{
                title: 'Precauciones',
                bullets:
                  data.cautions
              }]
            : [])
        ]
      };
    },

    buildFollowupConcern(data) {
      return {
        title:
          data.title ||
          'Principal punto de atención',

        lead:
          data.lead || '',

        metrics: [
          {
            label: 'Atención',
            value:
              data.attention || 'Sin clasificar'
          },
          {
            label: 'Confianza',
            value:
              data.confidence || 'Limitada'
          }
        ],

        sections: data.findings?.length
          ? [{
              title: 'Elementos relacionados',
              bullets: data.findings
            }]
          : []
      };
    },

    buildFollowupDetails(data) {
      return {
        title:
          data.title ||
          'Detalles del análisis',

        lead:
          data.lead || '',

        metrics: [
          {
            label: 'Atención',
            value:
              data.attention || 'Sin clasificar'
          },
          {
            label: 'Confianza',
            value:
              data.confidence || 'Limitada'
          },
          {
            label: 'Puntuación',
            value:
              data.score ?? 0
          }
        ],

        sections: [
          ...(data.facts?.length
            ? [{
                title: 'Datos confirmados',
                bullets: data.facts
              }]
            : []),

          ...(data.findings?.length
            ? [{
                title: 'Hallazgos',
                bullets: data.findings
              }]
            : []),

          ...(data.inferences?.length
            ? [{
                title: 'Interpretaciones',
                bullets: data.inferences
              }]
            : []),

          ...(data.recommendations?.length
            ? [{
                title: 'Acciones sugeridas',
                bullets:
                  data.recommendations
              }]
            : []),

          ...(data.cautions?.length
            ? [{
                title: 'Limitaciones',
                bullets: data.cautions
              }]
            : [])
        ]
      };
    },

    buildUnknown(result) {
      return {
        title: 'No pude interpretar completamente la consulta',

        lead:
          result?.error ||
          'Intenta preguntarme por un pozo, un recorredor, alarmas, GPS, WhatsApp, indicadores, comparación o diagnóstico.',

        note:
          'Ejemplo: “¿Cómo anda el pozo 505?”'
      };
    },

    buildResponse(result) {
      let content;

      if (!result?.ok) {
        content = this.buildUnknown(result);
      } else {
        const data = result.data || {};

        switch (result.intent) {
          case 'daily_summary':
            content = this.buildDailySummary(data);
            break;

          case 'indicators':
            content = this.buildIndicators(data);
            break;

          case 'well_history':
            content = this.buildWellHistory(data);
            break;

          case 'worker_activity':
            content = this.buildWorkerActivity(data);
            break;

          case 'alarms':
            content = this.buildAlarms(data);
            break;

          case 'gps_issues':
            content = this.buildGps(data);
            break;

          case 'whatsapp_status':
            content = this.buildWhatsapp(data);
            break;

          case 'well_status':
            content = this.buildWellStatus(data);
            break;

          case 'reports':
            content = this.buildReports(data);
            break;

          case 'comparison':
            content = this.buildComparison(data);
            break;

          case 'diagnosis':
            content = this.buildDiagnosis(data);
            break;

          case 'trends':
            content = this.buildTrends(data);
            break;

          case 'help':
            content = this.buildHelp();
            break;

          case 'followup_explanation':
            content =
              this.buildFollowupExplanation(data);
            break;

          case 'followup_brief':
            content =
              this.buildFollowupBrief(data);
            break;

          case 'followup_recommendation':
            content =
              this.buildFollowupRecommendation(data);
            break;

          case 'followup_concern':
            content =
              this.buildFollowupConcern(data);
            break;

          case 'followup_details':
            content =
              this.buildFollowupDetails(data);
            break;

          default:
            content = this.buildUnknown(result);
        }
      }

      const reasoning = result?.reasoning;

      if (reasoning) {
        content.sections =
          Array.isArray(content.sections)
            ? content.sections
            : [];

        if (reasoning.summary) {
          content.sections.push({
            title:
              `Análisis operativo · Atención ${reasoning.attention}`,
            text: reasoning.summary
          });
        }

        if (
          Array.isArray(reasoning.findings) &&
          reasoning.findings.length
        ) {
          content.sections.push({
            title: 'Hallazgos',
            bullets: reasoning.findings
          });
        }

        if (
          Array.isArray(reasoning.inferences) &&
          reasoning.inferences.length
        ) {
          content.sections.push({
            title: 'Interpretación',
            bullets: reasoning.inferences
          });
        }

        if (
          Array.isArray(reasoning.recommendations) &&
          reasoning.recommendations.length
        ) {
          content.sections.push({
            title: 'Siguiente revisión sugerida',
            bullets: reasoning.recommendations
          });
        }

        if (
          Array.isArray(reasoning.cautions) &&
          reasoning.cautions.length
        ) {
          const cautionText =
            reasoning.cautions.join(' ');

          content.note = content.note
            ? `${content.note} ${cautionText}`
            : cautionText;
        }

        content.metrics =
          Array.isArray(content.metrics)
            ? content.metrics
            : [];

        content.metrics.push({
          label: 'Atención',
          value: reasoning.attention
        });

        content.metrics.push({
          label: 'Confianza',
          value: reasoning.confidence
        });
      }

      return content;
    },

    runProactiveBrief() {
      if (
        this.proactiveShown ||
        this.busy ||
        !window.AdminIAProactive
      ) {
        return;
      }

      this.proactiveShown = true;
      this.showTyping();

      window.setTimeout(() => {
        try {
          const proactive =
            window.AdminIAProactive.execute();

          this.hideTyping();

          if (
            !proactive?.ok ||
            !proactive.result
          ) {
            this.proactiveShown = false;
            return;
          }

          const result = proactive.result;

          this.lastResult = result;

          if (window.AdminIAContext) {
            window.AdminIAContext.record(
              {
                originalQuestion:
                  proactive.question,

                resolvedQuestion:
                  proactive.question,

                contextApplied: false,

                resolvedAnalysis: {
                  intent:
                    result.intent || 'diagnosis',

                  entities: {},

                  modifiers: {
                    proactive: true
                  }
                }
              },
              result
            );
          }

          const response =
            this.buildResponse(result);

          response.title =
            'Situación operativa actual';

          response.lead =
            response.lead ||
            'Esta revisión se generó automáticamente con la información disponible.';

          response.note =
            response.note
              ? `${response.note} Revisión automática de solo lectura.`
              : 'Revisión automática de solo lectura.';

          this.addAssistantMessage(response);
        } catch (error) {
          this.hideTyping();
          this.proactiveShown = false;

          console.error(
            '[IA Cuichapa] Error mostrando resumen proactivo:',
            error
          );
        }
      }, 700);
    },

    scheduleProactiveBrief() {
      if (this.proactiveTimer) {
        window.clearTimeout(
          this.proactiveTimer
        );
      }

      this.proactiveTimer =
        window.setTimeout(() => {
          this.proactiveTimer = null;
          this.runProactiveBrief();
        }, 900);
    },

    ask(question) {
      const cleanQuestion =
        String(question || '').trim();

      if (!cleanQuestion || this.busy) {
        return;
      }

      const input = this.getInput();

      this.busy = true;

      if (input) {
        input.value = '';
        this.autoResizeInput();
      }

      this.addUserMessage(cleanQuestion);
      this.showTyping();

      window.setTimeout(() => {
        let result;

        try {
          if (!window.AdminIAPlanner) {
            throw new Error(
              'El planificador de IA no está disponible.'
            );
          }

          const followup =
            window.AdminIAFollowup &&
            this.lastResult
              ? window.AdminIAFollowup.handle(
                  cleanQuestion,
                  this.lastResult
                )
              : {
                  handled: false,
                  result: null
                };

          let contextResult;

          if (followup.handled) {
            result = followup.result;

            contextResult = {
              originalQuestion:
                cleanQuestion,

              resolvedQuestion:
                cleanQuestion,

              contextApplied:
                true,

              resolvedAnalysis: {
                intent:
                  result.intent,

                entities: {},

                modifiers: {
                  followup: true
                }
              }
            };
          } else {
            contextResult =
              window.AdminIAContext
                ? window.AdminIAContext.resolve(
                    cleanQuestion
                  )
                : {
                    originalQuestion:
                      cleanQuestion,

                    resolvedQuestion:
                      cleanQuestion,

                    contextApplied:
                      false
                  };

            result =
              window.AdminIAPlanner.executeQuestion(
                contextResult.resolvedQuestion
              );

            if (
              window.AdminIAReasoner &&
              typeof window.AdminIAReasoner.analyze === 'function'
            ) {
              result =
                window.AdminIAReasoner.analyze(
                  result
                );
            }
          }

          if (window.AdminIAContext) {
            window.AdminIAContext.record(
              contextResult,
              result
            );
          }

          this.lastResult = result;

          this.hideTyping();
          this.addAssistantMessage(
            this.buildResponse(result)
          );
        } catch (error) {
          console.error(
            '[IA Cuichapa] Error:',
            error
          );

          this.hideTyping();

          this.addAssistantMessage({
            title: 'No pude completar la consulta',
            lead:
              error?.message ||
              'Se produjo un error inesperado.'
          });
        } finally {
          this.busy = false;

          if (input) {
            input.focus();
          }
        }
      }, 280);
    },

    addSuggestion(container, label, prompt) {
      const button = this.create(
        'button',
        'ia-chat-suggestion',
        label
      );

      button.type = 'button';

      button.addEventListener('click', () => {
        this.ask(prompt);
      });

      container.appendChild(button);
    },

    renderWelcome() {
      const messages = this.getMessages();

      if (!messages) {
        return;
      }

      const welcome = this.create(
        'section',
        'ia-chat-welcome'
      );

      welcome.appendChild(
        this.create(
          'div',
          'ia-chat-welcome-icon',
          '🤖'
        )
      );

      welcome.appendChild(
        this.create(
          'h2',
          'ia-chat-welcome-title',
          '¿Qué deseas analizar?'
        )
      );

      welcome.appendChild(
        this.create(
          'p',
          'ia-chat-welcome-text',
          'Consulta reportes, pozos, recorridos, alarmas, indicadores y hallazgos operativos.'
        )
      );

      const suggestions = this.create(
        'div',
        'ia-chat-suggestions'
      );

      this.addSuggestion(
        suggestions,
        '📊 Resumen de hoy',
        'Dame un resumen operativo de hoy'
      );

      this.addSuggestion(
        suggestions,
        '🔎 Buscar pozo',
        '¿Cómo anda el pozo 505?'
      );

      this.addSuggestion(
        suggestions,
        '🚨 Alarmas',
        '¿Qué alarmas hay hoy?'
      );

      this.addSuggestion(
        suggestions,
        '🧠 Diagnóstico',
        '¿Qué requiere atención prioritaria hoy?'
      );

      welcome.appendChild(suggestions);
      messages.appendChild(welcome);
    },

    newChat() {
      const messages = this.getMessages();

      if (!messages) {
        return;
      }

      this.clear(messages);
      this.lastResult = null;
      this.proactiveShown = false;

      if (this.proactiveTimer) {
        window.clearTimeout(
          this.proactiveTimer
        );

        this.proactiveTimer = null;
      }

      if (
        window.AdminIAContext &&
        typeof window.AdminIAContext.reset === 'function'
      ) {
        window.AdminIAContext.reset();
      }

      this.renderWelcome();
      this.scheduleProactiveBrief();

      const input = this.getInput();

      if (input) {
        input.value = '';
        this.autoResizeInput();
        input.focus();
      }
    },

    buildInterface() {
      const view = this.getView();

      if (!view) {
        return;
      }

      this.clear(view);
      view.classList.add('ia-chat-view');

      const shell = this.create(
        'div',
        'ia-chat-shell'
      );

      const header = this.create(
        'header',
        'ia-chat-header'
      );

      const identity = this.create(
        'div',
        'ia-chat-identity'
      );

      identity.appendChild(
        this.create(
          'div',
          'ia-chat-header-avatar',
          '🤖'
        )
      );

      const identityText = this.create(
        'div',
        'ia-chat-identity-text'
      );

      identityText.appendChild(
        this.create(
          'h2',
          'ia-chat-header-title',
          'IA Cuichapa'
        )
      );

      identityText.appendChild(
        this.create(
          'p',
          'ia-chat-header-subtitle',
          'Asistente inteligente de análisis operativo'
        )
      );

      identity.appendChild(identityText);

      const newButton = this.create(
        'button',
        'ia-chat-new-button',
        '＋ Nueva conversación'
      );

      newButton.type = 'button';

      newButton.addEventListener(
        'click',
        () => this.newChat()
      );

      header.appendChild(identity);
      header.appendChild(newButton);

      const messages = this.create(
        'main',
        'ia-chat-messages'
      );

      messages.id = 'iaChatMessages';

      const composerWrap = this.create(
        'footer',
        'ia-chat-composer-wrap'
      );

      const composer = this.create(
        'div',
        'ia-chat-composer'
      );

      const input = document.createElement('textarea');

      input.id = 'iaChatInput';
      input.className = 'ia-chat-input';
      input.placeholder =
        'Pregunta algo sobre la operación...';
      input.rows = 1;
      input.setAttribute(
        'aria-label',
        'Pregunta para IA Cuichapa'
      );

      const send = this.create(
        'button',
        'ia-chat-send',
        '➤'
      );

      send.id = 'iaChatSend';
      send.type = 'button';
      send.setAttribute(
        'aria-label',
        'Enviar pregunta'
      );

      composer.appendChild(input);
      composer.appendChild(send);

      composerWrap.appendChild(composer);

      composerWrap.appendChild(
        this.create(
          'p',
          'ia-chat-disclaimer',
          'IA Cuichapa analiza datos operativos en modo de solo lectura. Verifica decisiones críticas con el responsable del área.'
        )
      );

      shell.appendChild(header);
      shell.appendChild(messages);
      shell.appendChild(composerWrap);

      view.appendChild(shell);

      input.addEventListener(
        'input',
        () => this.autoResizeInput()
      );

      input.addEventListener(
        'keydown',
        event => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey
          ) {
            event.preventDefault();
            this.ask(input.value);
          }
        }
      );

      send.addEventListener(
        'click',
        () => this.ask(input.value)
      );

      this.renderWelcome();
    },

    init() {
      if (this.initialized) {
        return;
      }

      if (!this.getView()) {
        return;
      }

      this.buildInterface();
      this.initialized = true;

      console.info(
        '[IA Cuichapa] Interfaz conversacional cargada:',
        this.version
      );
    }
  };

  window.AdminIACuichapa = Chat;

  function boot() {
    Chat.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      { once: true }
    );
  } else {
    boot();
  }
})();

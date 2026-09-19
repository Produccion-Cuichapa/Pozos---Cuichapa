(function () {
  'use strict';

  /**
   * IA CUICHAPA — REASONER
   *
   * Analiza resultados ya obtenidos por AdminIAPlanner.
   *
   * Principios:
   * - No consulta Firebase.
   * - No modifica el DOM.
   * - No escribe datos.
   * - No inventa causas.
   * - Distingue hechos, inferencias y recomendaciones.
   */

  const Reasoner = {
    version: '1.0.0',

    normalize(value) {
      return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    },

    unique(values) {
      return [
        ...new Set(
          (Array.isArray(values) ? values : [])
            .map(value => String(value || '').trim())
            .filter(Boolean)
        )
      ];
    },

    clamp(value, min, max) {
      return Math.min(
        max,
        Math.max(min, Number(value) || 0)
      );
    },

    attentionFromScore(score) {
      if (score >= 8) {
        return 'Alta';
      }

      if (score >= 4) {
        return 'Media';
      }

      if (score >= 1) {
        return 'Baja';
      }

      return 'Normal';
    },

    confidenceFromEvidence(count) {
      if (count >= 5) {
        return 'Alta';
      }

      if (count >= 2) {
        return 'Media';
      }

      return 'Limitada';
    },

    baseResult(plannerResult) {
      return {
        score: 0,
        attention: 'Normal',
        confidence: 'Limitada',
        evidenceCount: 0,
        facts: [],
        findings: [],
        inferences: [],
        cautions: [],
        recommendations: [],
        summary: ''
      };
    },

    addFact(reasoning, text) {
      if (!text) {
        return;
      }

      reasoning.facts.push(text);
      reasoning.evidenceCount += 1;
    },

    addFinding(reasoning, text, score) {
      if (!text) {
        return;
      }

      reasoning.findings.push(text);
      reasoning.score += Number(score) || 0;
    },

    addInference(reasoning, text) {
      if (text) {
        reasoning.inferences.push(text);
      }
    },

    addCaution(reasoning, text) {
      if (text) {
        reasoning.cautions.push(text);
      }
    },

    addRecommendation(reasoning, text) {
      if (text) {
        reasoning.recommendations.push(text);
      }
    },

    finalize(reasoning) {
      reasoning.score = this.clamp(
        reasoning.score,
        0,
        20
      );

      reasoning.attention =
        this.attentionFromScore(reasoning.score);

      reasoning.confidence =
        this.confidenceFromEvidence(
          reasoning.evidenceCount
        );

      reasoning.facts =
        this.unique(reasoning.facts);

      reasoning.findings =
        this.unique(reasoning.findings);

      reasoning.inferences =
        this.unique(reasoning.inferences);

      reasoning.cautions =
        this.unique(reasoning.cautions);

      reasoning.recommendations =
        this.unique(reasoning.recommendations);

      return reasoning;
    },

    analyzeWellHistory(result) {
      const reasoning = this.baseResult(result);
      const data = result.data || {};
      const reports = data.reports || [];
      const latest = data.latest;

      if (!latest) {
        this.addCaution(
          reasoning,
          'No existen reportes suficientes para evaluar la condición del pozo.'
        );

        reasoning.summary =
          'No hay evidencia operativa suficiente para generar un diagnóstico del pozo.';

        return this.finalize(reasoning);
      }

      this.addFact(
        reasoning,
        `Se analizaron ${reports.length} reportes recientes del pozo ${data.well}.`
      );

      if (latest.estatus) {
        this.addFact(
          reasoning,
          `El último estado reportado es ${latest.estatus}.`
        );
      }

      if (latest.recorredor) {
        this.addFact(
          reasoning,
          `El último reporte fue registrado por ${latest.recorredor}.`
        );
      }

      const latestStatus =
        this.normalize(latest.estatus);

      if (latestStatus.includes('cerrado')) {
        this.addFinding(
          reasoning,
          'El último reporte mantiene al pozo en condición de cerrado.',
          4
        );
      }

      if (latestStatus.includes('intermitente')) {
        this.addFinding(
          reasoning,
          'El pozo presenta operación intermitente en el reporte más reciente.',
          3
        );
      }

      const recentStatuses =
        reports.slice(0, 5)
          .map(report =>
            this.normalize(report.estatus)
          )
          .filter(Boolean);

      const sameClosed =
        recentStatuses.length >= 2 &&
        recentStatuses.every(status =>
          status.includes('cerrado')
        );

      const sameIntermittent =
        recentStatuses.length >= 2 &&
        recentStatuses.every(status =>
          status.includes('intermitente')
        );

      if (sameClosed) {
        this.addFinding(
          reasoning,
          `Los últimos ${recentStatuses.length} reportes consultados mantienen la condición de cerrado.`,
          3
        );

        this.addInference(
          reasoning,
          'La condición de cierre no parece aislada dentro del historial reciente.'
        );
      }

      if (sameIntermittent) {
        this.addFinding(
          reasoning,
          `Los últimos ${recentStatuses.length} reportes mantienen una condición intermitente.`,
          2
        );
      }

      if (!latest.tieneGps) {
        this.addFinding(
          reasoning,
          'El último reporte no contiene una ubicación GPS válida.',
          2
        );
      } else if (
        latest.distancia !== null &&
        latest.distancia > 80
      ) {
        this.addFinding(
          reasoning,
          `El último reporte fue capturado a ${Math.round(latest.distancia)} metros del punto registrado.`,
          3
        );
      } else {
        this.addFact(
          reasoning,
          latest.distancia !== null
            ? `La ubicación del último reporte aparece a ${Math.round(latest.distancia)} metros del punto registrado.`
            : 'El último reporte contiene coordenadas GPS.'
        );
      }

      if (latest.whatsapp !== 'Enviado') {
        this.addFinding(
          reasoning,
          `El último reporte aparece con estado de WhatsApp: ${latest.whatsapp}.`,
          2
        );
      } else {
        this.addFact(
          reasoning,
          'El último reporte aparece confirmado como enviado a WhatsApp.'
        );
      }

      const gpsIssues =
        reports.filter(report =>
          !report.tieneGps ||
          (
            report.distancia !== null &&
            report.distancia > 80
          )
        ).length;

      const whatsappIssues =
        reports.filter(report =>
          report.whatsapp !== 'Enviado'
        ).length;

      if (gpsIssues > 1) {
        this.addFinding(
          reasoning,
          `${gpsIssues} reportes recientes requieren revisión de ubicación.`,
          Math.min(gpsIssues, 3)
        );
      }

      if (whatsappIssues > 1) {
        this.addFinding(
          reasoning,
          `${whatsappIssues} reportes recientes no aparecen confirmados como enviados.`,
          Math.min(whatsappIssues, 3)
        );
      }

      if (
        latestStatus.includes('cerrado') ||
        latestStatus.includes('intermitente')
      ) {
        this.addRecommendation(
          reasoning,
          'Verificar la condición operativa con el responsable de campo antes del siguiente recorrido.'
        );
      }

      if (latest.whatsapp !== 'Enviado') {
        this.addRecommendation(
          reasoning,
          'Revisar la confirmación de envío del último reporte sin reenviarlo automáticamente.'
        );
      }

      if (
        !latest.tieneGps ||
        (
          latest.distancia !== null &&
          latest.distancia > 80
        )
      ) {
        this.addRecommendation(
          reasoning,
          'Validar la ubicación y la precisión GPS antes de tomar una decisión basada en la distancia registrada.'
        );
      }

      this.addCaution(
        reasoning,
        'El sistema identifica patrones en los reportes, pero no determina por sí solo la causa física de la condición del pozo.'
      );

      reasoning.summary =
        reasoning.findings.length
          ? `Se identificaron ${reasoning.findings.length} hallazgos relevantes en el historial reciente del pozo ${data.well}.`
          : `No se identificaron incidencias relevantes en los reportes recientes del pozo ${data.well}.`;

      return this.finalize(reasoning);
    },

    analyzeWorkerActivity(result) {
      const reasoning = this.baseResult(result);
      const data = result.data || {};
      const workers = data.workers || [];
      const worker = workers[0];

      if (!worker) {
        this.addCaution(
          reasoning,
          'No existe información suficiente del recorredor consultado.'
        );

        reasoning.summary =
          'No fue posible evaluar la actividad del recorredor.';

        return this.finalize(reasoning);
      }

      this.addFact(
        reasoning,
        `${worker.worker} registró ${worker.reportes} reportes.`
      );

      this.addFact(
        reasoning,
        `Visitó ${worker.pozosVisitados} pozos en el periodo consultado.`
      );

      if (worker.reportes === 0) {
        this.addFinding(
          reasoning,
          'No se localizaron reportes del recorredor durante el periodo.',
          2
        );
      }

      if (worker.problemasGps > 0) {
        this.addFinding(
          reasoning,
          `${worker.problemasGps} reporte(s) requieren revisión de GPS.`,
          Math.min(worker.problemasGps, 4)
        );

        this.addRecommendation(
          reasoning,
          'Revisar los reportes sin ubicación o fuera del radio permitido.'
        );
      }

      if (worker.whatsappPendientes > 0) {
        this.addFinding(
          reasoning,
          `${worker.whatsappPendientes} envío(s) no aparecen confirmados.`,
          Math.min(worker.whatsappPendientes, 3)
        );

        this.addRecommendation(
          reasoning,
          'Verificar el estado de sincronización y envío de los reportes señalados.'
        );
      }

      if (
        worker.reportes > 0 &&
        worker.problemasGps === 0 &&
        worker.whatsappPendientes === 0
      ) {
        this.addInference(
          reasoning,
          'La actividad registrada no presenta incidencias técnicas evidentes en GPS o WhatsApp.'
        );
      }

      reasoning.summary =
        reasoning.findings.length
          ? `${worker.worker} presenta ${reasoning.findings.length} aspecto(s) que requieren revisión.`
          : `La actividad de ${worker.worker} no presenta incidencias técnicas relevantes en el periodo consultado.`;

      return this.finalize(reasoning);
    },

    analyzeGps(result) {
      const reasoning = this.baseResult(result);
      const data = result.data || {};

      this.addFact(
        reasoning,
        `Se localizaron ${data.total || 0} reportes con observaciones de ubicación.`
      );

      if (data.sinGps > 0) {
        this.addFinding(
          reasoning,
          `${data.sinGps} reporte(s) no contienen GPS válido.`,
          Math.min(data.sinGps * 2, 6)
        );
      }

      if (data.fueraDeRadio > 0) {
        this.addFinding(
          reasoning,
          `${data.fueraDeRadio} reporte(s) están fuera del radio permitido.`,
          Math.min(data.fueraDeRadio * 2, 8)
        );
      }

      if ((data.total || 0) > 0) {
        this.addRecommendation(
          reasoning,
          'Revisar primero los reportes sin GPS y después los que presentan mayor distancia.'
        );

        this.addCaution(
          reasoning,
          'Una distancia elevada puede deberse a precisión deficiente, ubicación almacenada o condiciones del dispositivo; requiere validación antes de concluir que el recorredor no estuvo en el sitio.'
        );
      }

      reasoning.summary =
        data.total
          ? 'Se detectaron incidencias de ubicación que requieren validación.'
          : 'No se detectaron incidencias GPS en el periodo consultado.';

      return this.finalize(reasoning);
    },

    analyzeWhatsapp(result) {
      const reasoning = this.baseResult(result);
      const data = result.data || {};

      this.addFact(
        reasoning,
        `Se localizaron ${data.total || 0} reportes que requieren revisión de envío.`
      );

      if (data.errores > 0) {
        this.addFinding(
          reasoning,
          `${data.errores} envío(s) aparecen con error.`,
          Math.min(data.errores * 3, 9)
        );
      }

      if (data.pendientes > 0) {
        this.addFinding(
          reasoning,
          `${data.pendientes} envío(s) permanecen pendientes.`,
          Math.min(data.pendientes * 2, 6)
        );
      }

      if (data.sinConfirmar > 0) {
        this.addFinding(
          reasoning,
          `${data.sinConfirmar} envío(s) no tienen confirmación suficiente.`,
          Math.min(data.sinConfirmar, 4)
        );
      }

      if ((data.total || 0) > 0) {
        this.addRecommendation(
          reasoning,
          'Validar primero el registro de envío y el estado en Firebase antes de intentar reenviar un reporte.'
        );

        this.addCaution(
          reasoning,
          'Un estado pendiente no demuestra por sí solo que el mensaje no haya llegado al grupo.'
        );
      }

      reasoning.summary =
        data.total
          ? 'Existen envíos que requieren conciliación o verificación.'
          : 'No se detectaron envíos pendientes o con error.';

      return this.finalize(reasoning);
    },

    analyzeDiagnosis(result) {
      const reasoning = this.baseResult(result);
      const data = result.data || {};
      const highest = data.highestPriority;

      this.addFact(
        reasoning,
        `Se revisaron ${data.totalReviewed || 0} pozos.`
      );

      this.addFact(
        reasoning,
        `${data.totalWithFindings || 0} pozo(s) presentan hallazgos automáticos.`
      );

      if (!highest) {
        reasoning.summary =
          'No se detectaron pozos con hallazgos prioritarios.';

        return this.finalize(reasoning);
      }

      this.addFinding(
        reasoning,
        `El pozo ${highest.well} presenta la puntuación más alta: ${highest.score}.`,
        highest.score
      );

      highest.reasons?.forEach(reason => {
        this.addFact(reasoning, reason);
      });

      this.addInference(
        reasoning,
        `El pozo ${highest.well} debe revisarse antes que los demás elementos clasificados con menor puntuación.`
      );

      this.addRecommendation(
        reasoning,
        `Validar en campo y en el historial la condición actual del pozo ${highest.well}.`
      );

      this.addCaution(
        reasoning,
        'La puntuación prioriza coincidencias técnicas; no sustituye el criterio del supervisor ni confirma una falla mecánica.'
      );

      reasoning.summary =
        `El pozo ${highest.well} encabeza la revisión automática con prioridad ${highest.priority}.`;

      return this.finalize(reasoning);
    },

    analyzeComparison(result) {
      const reasoning = this.baseResult(result);
      const data = result.data || {};
      const ranking = data.ranking || [];

      if (ranking.length < 2) {
        this.addCaution(
          reasoning,
          'No hay suficientes recorredores para realizar la comparación.'
        );

        reasoning.summary =
          'La comparación requiere al menos dos recorredores con información.';

        return this.finalize(reasoning);
      }

      const leader = ranking[0];
      const second = ranking[1];

      this.addFact(
        reasoning,
        `${leader.worker} registró ${leader.reportes} reportes y visitó ${leader.pozosVisitados} pozos.`
      );

      this.addFact(
        reasoning,
        `${second.worker} registró ${second.reportes} reportes y visitó ${second.pozosVisitados} pozos.`
      );

      this.addInference(
        reasoning,
        `${leader.worker} tuvo mayor actividad registrada por una diferencia de ${data.difference || 0} reportes.`
      );

      if (leader.problemasGps > second.problemasGps) {
        this.addFinding(
          reasoning,
          `Aunque ${leader.worker} registró más actividad, también presentó más incidencias GPS.`,
          2
        );
      }

      if (
        leader.whatsappPendientes >
        second.whatsappPendientes
      ) {
        this.addFinding(
          reasoning,
          `${leader.worker} presenta más envíos pendientes de revisión.`,
          2
        );
      }

      this.addCaution(
        reasoning,
        'La cantidad de reportes no representa por sí sola productividad, calidad del recorrido ni dificultad de la ruta.'
      );

      reasoning.summary =
        `${leader.worker} registró la mayor actividad en el periodo consultado.`;

      return this.finalize(reasoning);
    },

    analyzeDailySummary(result) {
      const reasoning = this.baseResult(result);
      const data = result.data || {};

      this.addFact(
        reasoning,
        `Se registraron ${data.reportes || 0} reportes.`
      );

      this.addFact(
        reasoning,
        `Se visitaron ${data.pozosVisitados || 0} pozos.`
      );

      this.addFact(
        reasoning,
        `Participaron ${data.recorredoresActivos || 0} recorredores.`
      );

      if ((data.alarmas || 0) > 0) {
        this.addFinding(
          reasoning,
          `Se registraron ${data.alarmas} alarma(s).`,
          Math.min(data.alarmas * 3, 9)
        );
      }

      if ((data.problemasGps || 0) > 0) {
        this.addFinding(
          reasoning,
          `${data.problemasGps} reporte(s) presentan observaciones GPS.`,
          Math.min(data.problemasGps, 5)
        );
      }

      if ((data.whatsappPendientes || 0) > 0) {
        this.addFinding(
          reasoning,
          `${data.whatsappPendientes} reporte(s) requieren revisión de envío.`,
          Math.min(data.whatsappPendientes, 4)
        );
      }

      if (reasoning.findings.length) {
        this.addRecommendation(
          reasoning,
          'Atender primero las alarmas y después revisar incidencias GPS y estados de envío.'
        );
      }

      reasoning.summary =
        reasoning.findings.length
          ? `El periodo presenta ${reasoning.findings.length} grupo(s) de hallazgos relevantes.`
          : 'La actividad registrada no presenta hallazgos técnicos destacados.';

      return this.finalize(reasoning);
    },

    analyzeGeneric(result) {
      const reasoning = this.baseResult(result);

      reasoning.summary =
        'La consulta fue resuelta, pero todavía no cuenta con un modelo específico de razonamiento.';

      return this.finalize(reasoning);
    },

    analyze(plannerResult) {
      if (!plannerResult || typeof plannerResult !== 'object') {
        return {
          ok: false,
          error: 'El resultado del planificador no es válido'
        };
      }

      if (!plannerResult.ok) {
        return {
          ...plannerResult,
          reasoning: {
            ...this.baseResult(plannerResult),
            summary:
              'No fue posible analizar la consulta porque el planificador no produjo un resultado válido.'
          }
        };
      }

      let reasoning;

      switch (plannerResult.intent) {
        case 'well_history':
          reasoning =
            this.analyzeWellHistory(plannerResult);
          break;

        case 'worker_activity':
          reasoning =
            this.analyzeWorkerActivity(plannerResult);
          break;

        case 'gps_issues':
          reasoning =
            this.analyzeGps(plannerResult);
          break;

        case 'whatsapp_status':
          reasoning =
            this.analyzeWhatsapp(plannerResult);
          break;

        case 'diagnosis':
          reasoning =
            this.analyzeDiagnosis(plannerResult);
          break;

        case 'comparison':
          reasoning =
            this.analyzeComparison(plannerResult);
          break;

        case 'daily_summary':
          reasoning =
            this.analyzeDailySummary(plannerResult);
          break;

        default:
          reasoning =
            this.analyzeGeneric(plannerResult);
      }

      return {
        ...plannerResult,
        reasoning,
        metadata: {
          ...(plannerResult.metadata || {}),
          reasonerVersion: this.version,
          reasoningReadOnly: true
        }
      };
    },

    healthCheck() {
      const test = this.analyze({
        ok: true,
        intent: 'well_history',
        data: {
          well: '505',
          reports: [{
            estatus: 'Cerrado',
            tieneGps: true,
            distancia: 0,
            whatsapp: 'Pendiente',
            recorredor: 'Juan Carlos'
          }],
          latest: {
            estatus: 'Cerrado',
            tieneGps: true,
            distancia: 0,
            whatsapp: 'Pendiente',
            recorredor: 'Juan Carlos'
          }
        },
        metadata: {}
      });

      return {
        ok: Boolean(
          test.reasoning &&
          test.reasoning.findings.length &&
          test.reasoning.attention
        ),
        version: this.version,
        attention:
          test.reasoning?.attention || '',
        findings:
          test.reasoning?.findings || []
      };
    }
  };

  window.AdminIAReasoner = Reasoner;

  console.info(
    '[IA Cuichapa] Reasoner cargado:',
    Reasoner.version
  );
})();

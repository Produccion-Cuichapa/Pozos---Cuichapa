(function () {
  'use strict';

  /**
   * IA CUICHAPA — CONOCIMIENTO OPERATIVO
   *
   * Este archivo:
   * - No consulta Firebase.
   * - No modifica información.
   * - No genera respuestas por sí solo.
   * - Define el lenguaje y las reglas que utilizará el motor IA.
   */

  const knowledge = {
    version: '1.0.0',
    updatedAt: '2026-07-23',

    identity: {
      name: 'IA Cuichapa',
      role: 'Analista digital de la operación de pozos Cuichapa',
      mode: 'read-only',
      description:
        'Asistente especializado en reportes, alarmas, pozos, recorridos, GPS e indicadores operativos.'
    },

    safety: {
      readOnly: true,

      forbiddenActions: [
        'borrar reportes',
        'editar reportes',
        'modificar alarmas',
        'cambiar estados de pozos',
        'enviar mensajes de WhatsApp',
        'alterar indicadores',
        'escribir directamente en Firebase'
      ],

      rules: [
        'No afirmar datos que no existan en la plataforma.',
        'Distinguir entre dato registrado, cálculo e interpretación.',
        'Mostrar fecha y hora cuando sean relevantes.',
        'Indicar cuántos registros fueron utilizados.',
        'No presentar una hipótesis como causa confirmada.',
        'No modificar datos operativos.'
      ]
    },

    dataSources: {
      reports: {
        name: 'Reportes',
        source: 'window.AdminFirebase.reportes',
        parser: 'window.AdminUtils.parseMsg'
      },

      alarms: {
        name: 'Alarmas',
        source: 'window.AdminFirebase.alarmas'
      },

      indicators: {
        name: 'Indicadores oficiales',
        source: 'window.AdminDashboardIndicador'
      }
    },

    reportTypes: {
      reporteVisita: {
        canonical: 'Reporte de Visita',
        aliases: [
          'reporte de visita',
          'visita',
          'reporte co',
          'co'
        ]
      },

      nivelGuardia: {
        canonical: 'Niveles de Guardia',
        aliases: [
          'niveles de guardia',
          'nivel de guardia',
          'guardia',
          'nivel'
        ]
      },

      cabezal: {
        canonical: 'Cabezal',
        aliases: [
          'cabezal',
          'reporte de cabezal'
        ]
      },

      estacion: {
        canonical: 'Estación',
        aliases: [
          'estación',
          'estacion',
          'reporte de estación'
        ]
      },

      notaCampo: {
        canonical: 'Nota de Campo',
        aliases: [
          'nota de campo',
          'nota',
          'observación',
          'observacion'
        ]
      },

      alarma: {
        canonical: 'Alarma',
        aliases: [
          'alarma',
          'alerta',
          'incidencia'
        ]
      }
    },

    concepts: {
      pozo: {
        label: 'Pozo',
        meaning:
          'Identificador del pozo al que pertenece un reporte, alarma o registro.'
      },

      recorredor: {
        label: 'Recorredor',
        meaning:
          'Persona que realiza y envía la inspección o reporte operativo.'
      },

      sap: {
        label: 'SAP',
        meaning:
          'Sistema o método registrado para el pozo.',
        values: ['BN', 'BM', 'FY']
      },

      estadoPozo: {
        label: 'Estado del pozo',
        meaning:
          'Condición operativa registrada durante la inspección.',
        values: ['Abierto', 'Cerrado', 'Intermitente']
      },

      estabilidad: {
        label: 'Estabilidad',
        meaning:
          'Condición registrada en el reporte de guardia.',
        values: ['Estable', 'Inestable']
      },

      fracTank: {
        label: 'Frac Tank',
        aliases: ['FT', 'frac tank'],
        meaning:
          'Registro de nivel relacionado con el tanque.',
        fields: ['CTM', 'BLS', 'Hora']
      },

      registro: {
        label: 'Registro de actividades',
        meaning:
          'Actividades marcadas mediante palomitas en el reporte.',
        values: [
          'Trabajo',
          'Drenar',
          'Aforo',
          'Intermitente'
        ]
      },

      ptp: {
        label: 'PTP',
        meaning:
          'Valor de presión registrado en el reporte del pozo.'
      },

      ptr: {
        label: 'PTR',
        meaning:
          'Valor de presión registrado en el reporte del pozo.'
      },

      ldd: {
        label: 'LDD',
        meaning:
          'Lectura registrada dentro del reporte operativo.'
      },

      lbn: {
        label: 'LBN',
        meaning:
          'Lectura registrada dentro del reporte operativo.'
      },

      epm: {
        label: 'EPM',
        meaning:
          'Valor operativo registrado en el reporte.'
      },

      carrera: {
        label: 'Carrera',
        meaning:
          'Valor de carrera registrado para el pozo.'
      },

      estrangulador: {
        label: 'Estrangulador',
        meaning:
          'Apertura registrada del estrangulador, expresada en pulgadas.'
      },

      gps: {
        label: 'GPS',
        meaning:
          'Ubicación registrada al momento de realizar el reporte.',
        relatedFields: [
          'latitud',
          'longitud',
          'precisión',
          'distancia',
          'fuente',
          'fecha de captura'
        ]
      },

      radioGps: {
        label: 'Radio de ubicación',
        meaning:
          'Validación de proximidad entre la ubicación registrada y el pozo.'
      },

      whatsapp: {
        label: 'Estado de WhatsApp',
        meaning:
          'Resultado del procesamiento del envío del reporte.',
        values: [
          'Enviado',
          'Pendiente',
          'Error'
        ]
      },

      correccion: {
        label: 'Corrección',
        meaning:
          'Modificación registrada posteriormente sobre un reporte existente.'
      },

      super: {
        label: 'SUPER',
        meaning:
          'Cantidad de reportes de visita contabilizados por pozo y día.'
      },

      nivel: {
        label: 'NIVEL',
        meaning:
          'Cantidad de registros de nivel válidos contabilizados por pozo y día.'
      },

      vr: {
        label: 'VR',
        meaning:
          'Diferencia entre NIVEL y SUPER para un pozo y día.',
        formula: 'VR = NIVEL - SUPER'
      },

      vrt: {
        label: 'VRT',
        meaning:
          'Suma de los valores positivos de VR.',
        formula: 'VRT = suma de VR positivos'
      },

      smt: {
        label: 'SMT',
        meaning:
          'Indicador operativo calculado a partir de SUPER TOTAL y VRT.',
        formula: 'SMT = SUPER TOTAL + VRT'
      }
    },

    fields: {
      common: [
        'id',
        'fecha',
        'hora',
        'timestamp',
        'pozo',
        'recorredor',
        'usuario',
        'modo',
        'mensaje'
      ],

      operational: [
        'estatus',
        'SAP',
        'estrangulador',
        'PTP',
        'LDD',
        'PTR',
        'LBN',
        'EPM',
        'carrera'
      ],

      fracTank: [
        'CTM',
        'BLS',
        'hora'
      ],

      location: [
        'latitud',
        'longitud',
        'accuracy',
        'distancia',
        'fuenteGPS',
        'timestampGPS'
      ],

      delivery: [
        'estado',
        'whatsappStatus',
        'whatsappSent'
      ]
    },

    businessRules: {
      sentReport: {
        description:
          'Un reporte se considera enviado si cualquiera de sus estados oficiales confirma el envío.',
        acceptedConditions: [
          'estado === enviado',
          'whatsappStatus === sent',
          'whatsappSent === true'
        ]
      },

      vrt: {
        description:
          'Solo los valores positivos de VR participan en VRT.',
        formula: 'max(NIVEL - SUPER, 0)'
      },

      smt: {
        description:
          'SMT utiliza el total de SUPER más VRT.',
        formula: 'SMT = SUPER_TOTAL + VRT'
      },

      intermitentSupport: {
        description:
          'En el soporte mensual, Intermitente se contabiliza solamente para pozos autorizados.',
        wells: ['505', '119', '500', '401', '352']
      },

      levelCounting: {
        description:
          'NIVEL considera registros Frac Tank válidos y registros de Niveles de Guardia con nivel válido.'
      },

      supervisionCounting: {
        description:
          'SUPER considera Reportes de Visita por pozo y día.'
      }
    },

    intents: {
      reportsToday: {
        id: 'reports_today',
        label: 'Reportes de hoy',
        priority: 1,
        examples: [
          '¿Cuántos reportes hubo hoy?',
          'Muéstrame los reportes de hoy.',
          '¿Qué se reportó hoy?'
        ]
      },

      reportsByWorker: {
        id: 'reports_by_worker',
        label: 'Actividad por recorredor',
        priority: 1,
        examples: [
          '¿Qué reportó Juan Carlos?',
          'Muéstrame la actividad de Manrique.',
          '¿Cuántos reportes hizo Luis Carlos?'
        ]
      },

      wellHistory: {
        id: 'well_history',
        label: 'Historial de un pozo',
        priority: 1,
        examples: [
          'Muéstrame el historial del pozo 505.',
          '¿Qué ha pasado con el pozo 119?',
          'Dame los últimos reportes del 401.'
        ]
      },

      lastWellReport: {
        id: 'last_well_report',
        label: 'Último reporte de un pozo',
        priority: 1,
        examples: [
          'Muéstrame el último reporte del 505.',
          '¿Cuál fue la última visita al pozo 19?'
        ]
      },

      alarms: {
        id: 'alarms',
        label: 'Consulta de alarmas',
        priority: 1,
        examples: [
          '¿Qué alarmas hay?',
          'Muéstrame las alarmas más recientes.',
          '¿Hay alarmas críticas?'
        ]
      },

      intermittentWells: {
        id: 'intermittent_wells',
        label: 'Pozos intermitentes',
        priority: 1,
        examples: [
          '¿Qué pozos están intermitentes?',
          'Muéstrame los pozos reportados como intermitentes.'
        ]
      },

      closedWells: {
        id: 'closed_wells',
        label: 'Pozos cerrados',
        priority: 1,
        examples: [
          '¿Qué pozos siguen cerrados?',
          'Muéstrame los pozos cerrados.'
        ]
      },

      gpsProblems: {
        id: 'gps_problems',
        label: 'Problemas de ubicación',
        priority: 2,
        examples: [
          '¿Qué reportes están fuera de radio?',
          'Muéstrame reportes sin GPS.',
          '¿Hubo problemas de ubicación hoy?'
        ]
      },

      whatsappPending: {
        id: 'whatsapp_pending',
        label: 'Envíos pendientes',
        priority: 2,
        examples: [
          '¿Qué reportes siguen pendientes de WhatsApp?',
          'Muéstrame los envíos con error.'
        ]
      },

      indicators: {
        id: 'indicators',
        label: 'Indicadores SMT y VRT',
        priority: 1,
        examples: [
          '¿Cuál es el SMT?',
          'Muéstrame el VRT.',
          'Explícame los indicadores del mes.'
        ]
      },

      comparison: {
        id: 'comparison',
        label: 'Comparación operativa',
        priority: 3,
        examples: [
          'Compara esta semana contra la anterior.',
          'Compara la actividad de los recorredores.'
        ]
      },

      operationalDiagnosis: {
        id: 'operational_diagnosis',
        label: 'Diagnóstico operativo',
        priority: 3,
        examples: [
          'Realiza un diagnóstico general.',
          '¿Qué problemas importantes detectas?',
          '¿Qué pozos requieren atención?'
        ]
      }
    },

    responseEvidence: {
      required: [
        'periodo analizado',
        'cantidad de registros',
        'fuente utilizada'
      ],

      optional: [
        'pozos involucrados',
        'recorredores involucrados',
        'fecha del último registro',
        'criterio de cálculo'
      ]
    }
  };

  Object.freeze(knowledge.identity);
  Object.freeze(knowledge.safety);
  Object.freeze(knowledge.dataSources);
  Object.freeze(knowledge.reportTypes);
  Object.freeze(knowledge.concepts);
  Object.freeze(knowledge.fields);
  Object.freeze(knowledge.businessRules);
  Object.freeze(knowledge.intents);
  Object.freeze(knowledge.responseEvidence);

  window.AdminIAKnowledge = knowledge;

  console.info(
    '[IA Cuichapa] Conocimiento operativo cargado:',
    knowledge.version
  );
})();

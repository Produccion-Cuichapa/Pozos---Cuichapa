'use strict';

const REPORTES_PATH = '/reportes';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.floor(parsed),
    MAX_LIMIT
  );
}

function normalizeDate(value) {
  const text = cleanText(value);

  if (!text) {
    return '';
  }

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  return match ? text : '';
}

function getReportDate(report) {
  if (!report || typeof report !== 'object') {
    return '';
  }

  return cleanText(
    report.fechaISO ||
    report.fecha ||
    report.date ||
    report.createdDate
  ).slice(0, 10);
}

function getTimestamp(report) {
  if (!report || typeof report !== 'object') {
    return 0;
  }

  const candidates = [
    report.timestamp,
    report.createdAt,
    report.fechaHora,
    report.whatsappSentAt
  ];

  for (const value of candidates) {
    const numeric = Number(value);

    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }

  return 0;
}

function normalizeReport(id, report) {
  const source =
    report && typeof report === 'object'
      ? report
      : {};

  return {
    id: cleanText(id),
    fecha: getReportDate(source),
    hora: cleanText(
      source.hora ||
      source.time
    ),
    recorredor: cleanText(
      source.recorredor ||
      source.quien ||
      source.usuario
    ),
    pozo: cleanText(
      source.pozo ||
      source.well ||
      source.numeroPozo
    ),
    modo: cleanText(
      source.modo ||
      source.tipo ||
      source.reportType
    ),
    estado: cleanText(
      source.estadoPozo ||
      source.estado ||
      source.estatus
    ),
    whatsappStatus: cleanText(
      source.whatsappStatus
    ),
    gpsSource: cleanText(
      source.gpsSource
    ),
    distancia: source.distancia == null
      ? null
      : Number(source.distancia),
    observaciones: cleanText(
      source.observaciones ||
      source.observation ||
      source.nota
    ).slice(0, 500),
    timestamp: getTimestamp(source)
  };
}

function matchesText(actual, expected) {
  const filter = cleanText(expected).toLowerCase();

  if (!filter) {
    return true;
  }

  return cleanText(actual)
    .toLowerCase()
    .includes(filter);
}

function matchesFilters(report, filters) {
  const dateFrom = normalizeDate(
    filters.dateFrom
  );

  const dateTo = normalizeDate(
    filters.dateTo
  );

  if (
    dateFrom &&
    report.fecha &&
    report.fecha < dateFrom
  ) {
    return false;
  }

  if (
    dateTo &&
    report.fecha &&
    report.fecha > dateTo
  ) {
    return false;
  }

  return (
    matchesText(report.pozo, filters.pozo) &&
    matchesText(
      report.recorredor,
      filters.recorredor
    ) &&
    matchesText(report.modo, filters.modo) &&
    matchesText(
      report.whatsappStatus,
      filters.whatsappStatus
    )
  );
}

function createGetReportesTool(options) {
  const settings =
    options && typeof options === 'object'
      ? options
      : {};

  const db = settings.db;

  if (
    !db ||
    typeof db.ref !== 'function'
  ) {
    throw new Error(
      'getReportes requiere una instancia válida de Firebase Database.'
    );
  }

  return {
    name: 'getReportes',

    description:
      'Consulta reportes operativos de Campo Cuichapa almacenados en Firebase.',

    declaration: {
      name: 'getReportes',
      description:
        'Obtiene reportes operativos filtrados por fecha, pozo, recorredor, modo o estado de WhatsApp.',
      parameters: {
        type: 'OBJECT',
        properties: {
          dateFrom: {
            type: 'STRING',
            description:
              'Fecha inicial en formato YYYY-MM-DD.'
          },
          dateTo: {
            type: 'STRING',
            description:
              'Fecha final en formato YYYY-MM-DD.'
          },
          pozo: {
            type: 'STRING',
            description:
              'Número o nombre del pozo.'
          },
          recorredor: {
            type: 'STRING',
            description:
              'Nombre del recorredor.'
          },
          modo: {
            type: 'STRING',
            description:
              'Tipo o modo del reporte.'
          },
          whatsappStatus: {
            type: 'STRING',
            description:
              'Estado de envío: pending, sent o failed.'
          },
          limit: {
            type: 'NUMBER',
            description:
              'Cantidad máxima de reportes. Máximo 50.'
          }
        }
      }
    },

    async execute(args) {
      const filters =
        args && typeof args === 'object'
          ? args
          : {};

      const limit = normalizeLimit(
        filters.limit
      );

      const readLimit = Math.min(
        Math.max(limit * 5, 50),
        250
      );

      const snapshot = await db
        .ref(REPORTES_PATH)
        .limitToLast(readLimit)
        .once('value');

      const reports = [];

      if (snapshot && snapshot.exists()) {
        snapshot.forEach(function(child) {
          const normalized = normalizeReport(
            child.key,
            child.val()
          );

          if (
            matchesFilters(
              normalized,
              filters
            )
          ) {
            reports.push(normalized);
          }
        });
      }

      reports.sort(function(a, b) {
        return b.timestamp - a.timestamp;
      });

      const selected = reports.slice(
        0,
        limit
      );

      return {
        ok: true,
        count: selected.length,
        limit: limit,
        filters: {
          dateFrom: normalizeDate(
            filters.dateFrom
          ),
          dateTo: normalizeDate(
            filters.dateTo
          ),
          pozo: cleanText(filters.pozo),
          recorredor: cleanText(
            filters.recorredor
          ),
          modo: cleanText(filters.modo),
          whatsappStatus: cleanText(
            filters.whatsappStatus
          )
        },
        reports: selected
      };
    }
  };
}

module.exports = {
  REPORTES_PATH,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  normalizeLimit,
  normalizeReport,
  matchesFilters,
  createGetReportesTool
};

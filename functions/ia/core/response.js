'use strict';

const IDENTITY = require('./identity');

function success(answer, metadata) {
  return {
    ok: true,

    answer: String(answer || '').trim(),

    meta: Object.assign(
      {
        assistant: IDENTITY.assistantName,
        coreVersion: IDENTITY.version,
        timestamp: new Date().toISOString()
      },
      metadata || {}
    )
  };
}

function failure(code, message, metadata) {
  return {
    ok: false,

    error: {
      code: String(code || 'IA_CUICHAPA_ERROR'),

      message: String(
        message ||
        'IA Cuichapa no pudo completar la solicitud.'
      )
    },

    meta: Object.assign(
      {
        assistant: IDENTITY.assistantName,
        coreVersion: IDENTITY.version,
        timestamp: new Date().toISOString()
      },
      metadata || {}
    )
  };
}

module.exports = {
  success,
  failure
};

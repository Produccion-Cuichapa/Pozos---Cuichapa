'use strict';

/**
 * IA Cuichapa
 * Identidad central del sistema.
 */

const IDENTITY = Object.freeze({

  productName: 'IA Cuichapa',

  assistantName: 'IA Cuichapa',

  version: '0.1.0',

  description:
    'Asistente inteligente especializado en la plataforma Campo Cuichapa.',

  permissions: Object.freeze({

    read: true,

    write: false,

    delete: false,

    send: false

  })

});

module.exports = IDENTITY;

'use strict';

const IDENTITY = require('./identity');

const CONFIG = Object.freeze({

  assistantName: IDENTITY.assistantName,

  version: IDENTITY.version,

  provider:
    process.env.IA_CUICHAPA_PROVIDER ||
    'gemini',

  model:
    process.env.IA_CUICHAPA_MODEL ||
    'gemini-3.6-flash',

  maxInputCharacters: 12000,

  maxHistoryMessages: 20,

  maxToolIterations: 6,

  temperature: 0.25,

  maxOutputTokens: 4096,

  timeoutMs: 110000,

  permissions: IDENTITY.permissions

});

module.exports = CONFIG;

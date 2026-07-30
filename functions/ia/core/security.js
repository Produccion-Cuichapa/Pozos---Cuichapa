'use strict';

const CONFIG = require('./config');

function cleanText(value) {
  return String(value == null ? '' : value)
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function validateMessage(value) {
  const message = cleanText(value);

  if (!message) {
    throw new Error('Escribe una pregunta para IA Cuichapa.');
  }

  if (message.length > CONFIG.maxInputCharacters) {
    throw new Error(
      'La consulta supera el límite de ' +
      CONFIG.maxInputCharacters +
      ' caracteres.'
    );
  }

  return message;
}

function sanitizeSessionId(value) {
  const sessionId = cleanText(value)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 100);

  return sessionId || null;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-CONFIG.maxHistoryMessages)
    .map(function(item) {
      const source =
        item && typeof item === 'object'
          ? item
          : {};

      return {
        role:
          source.role === 'assistant'
            ? 'assistant'
            : 'user',

        text: cleanText(
          source.text ||
          source.content ||
          source.message
        ).slice(0, CONFIG.maxInputCharacters)
      };
    })
    .filter(function(item) {
      return Boolean(item.text);
    });
}

function validateRequest(data) {
  const payload =
    data && typeof data === 'object'
      ? data
      : {};

  return {
    message: validateMessage(payload.message),
    sessionId: sanitizeSessionId(payload.sessionId),
    history: sanitizeHistory(payload.history),
    metadata:
      payload.metadata &&
      typeof payload.metadata === 'object'
        ? payload.metadata
        : {}
  };
}

module.exports = {
  cleanText,
  validateMessage,
  sanitizeSessionId,
  sanitizeHistory,
  validateRequest
};

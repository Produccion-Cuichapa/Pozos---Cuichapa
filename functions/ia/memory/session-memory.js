'use strict';

const CONFIG = require('../core/config');

const sessions = new Map();

function normalize(message) {
  const source =
    message && typeof message === 'object'
      ? message
      : {};

  return {
    role:
      source.role === 'assistant'
        ? 'assistant'
        : 'user',

    text: String(source.text || '').trim(),

    timestamp:
      Number(source.timestamp) ||
      Date.now()
  };
}

function get(sessionId) {
  if (!sessionId || !sessions.has(sessionId)) {
    return [];
  }

  return sessions
    .get(sessionId)
    .slice(-CONFIG.maxHistoryMessages);
}

function set(sessionId, messages) {
  if (!sessionId) return;

  const normalized =
    (Array.isArray(messages) ? messages : [])
      .map(normalize)
      .filter(function(message) {
        return Boolean(message.text);
      })
      .slice(-CONFIG.maxHistoryMessages);

  sessions.set(sessionId, normalized);
}

function append(sessionId, message) {
  if (!sessionId) return;

  const current = get(sessionId);
  current.push(normalize(message));
  set(sessionId, current);
}

function clear(sessionId) {
  if (!sessionId) return false;
  return sessions.delete(sessionId);
}

function count() {
  return sessions.size;
}

module.exports = {
  get,
  set,
  append,
  clear,
  count
};

'use strict';

const security = require('./security');
const systemPrompt = require('./system-prompt');
const response = require('./response');
const sessionMemory = require('../memory/session-memory');
const toolRegistry = require('../tools/tool-registry');

function ensureProvider(provider) {
  if (!provider || typeof provider.generate !== 'function') {
    throw new Error(
      'El proveedor de IA debe implementar generate().'
    );
  }

  return provider;
}

function normalizeProviderResult(result) {
  if (typeof result === 'string') {
    return {
      text: result.trim(),
      toolCalls: [],
      raw: null
    };
  }

  const source =
    result && typeof result === 'object'
      ? result
      : {};

  return {
    text: String(
      source.text ||
      source.message ||
      source.content ||
      ''
    ).trim(),

    toolCalls: Array.isArray(source.toolCalls)
      ? source.toolCalls
      : [],

    raw: source.raw || null
  };
}

function readSession(sessionId) {
  if (
    !sessionId ||
    !sessionMemory ||
    typeof sessionMemory.get !== 'function'
  ) {
    return [];
  }

  const stored = sessionMemory.get(sessionId);

  return Array.isArray(stored)
    ? stored
    : [];
}

function appendSession(sessionId, item) {
  if (
    sessionId &&
    sessionMemory &&
    typeof sessionMemory.append === 'function'
  ) {
    sessionMemory.append(sessionId, item);
  }
}

function getToolDeclarations() {
  if (
    toolRegistry &&
    typeof toolRegistry.getDeclarations === 'function'
  ) {
    return toolRegistry.getDeclarations();
  }

  return [];
}

function mergeHistory(storedHistory, requestHistory) {
  const combined = []
    .concat(
      Array.isArray(storedHistory)
        ? storedHistory
        : []
    )
    .concat(
      Array.isArray(requestHistory)
        ? requestHistory
        : []
    );

  return security.sanitizeHistory(combined);
}

function success(data) {
  if (response && typeof response.success === 'function') {
    return response.success(
      data.message,
      {
        sessionId: data.sessionId,
        toolCalls: data.toolCalls,
        provider: data.provider
      }
    );
  }

  return {
    ok: true,
    data: data
  };
}

function failure(error) {
  const message =
    error && error.message
      ? error.message
      : 'No fue posible procesar la consulta.';

  if (response && typeof response.failure === 'function') {
    return response.failure(
      'IA_CUICHAPA_ERROR',
      message
    );
  }

  return {
    ok: false,
    error: message
  };
}

function createBrain(options) {
  const settings =
    options && typeof options === 'object'
      ? options
      : {};

  const provider = ensureProvider(settings.provider);

  async function chat(input) {
    try {
      const request = security.validateRequest(input);

      const history = mergeHistory(
        readSession(request.sessionId),
        request.history
      );

      const prompt = systemPrompt.buildSystemPrompt({
        now: new Date().toISOString()
      });

      const result = await provider.generate({
        systemPrompt: prompt,
        message: request.message,
        history: history,
        tools: getToolDeclarations(),
        metadata: request.metadata
      });

      const normalized =
        normalizeProviderResult(result);

      if (!normalized.text) {
        throw new Error(
          'El proveedor devolvió una respuesta vacía.'
        );
      }

      appendSession(request.sessionId, {
        role: 'user',
        text: request.message
      });

      appendSession(request.sessionId, {
        role: 'assistant',
        text: normalized.text
      });

      return success({
        message: normalized.text,
        sessionId: request.sessionId,
        toolCalls: normalized.toolCalls,
        provider: provider.name || 'unknown'
      });
    } catch (error) {
      return failure(error);
    }
  }

  return Object.freeze({
    chat: chat
  });
}

module.exports = {
  createBrain,
  ensureProvider,
  normalizeProviderResult,
  mergeHistory
};

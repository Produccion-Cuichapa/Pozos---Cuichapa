'use strict';

const { GoogleGenAI } = require('@google/genai');
const CONFIG = require('../core/config');
const providerApi = require('./provider-interface');

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function historyToContents(history, message) {
  const contents = [];

  (Array.isArray(history) ? history : []).forEach(function(item) {
    if (!item || !item.text) {
      return;
    }

    contents.push({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text: cleanText(item.text)
        }
      ]
    });
  });

  contents.push({
    role: 'user',
    parts: [
      {
        text: cleanText(message)
      }
    ]
  });

  return contents;
}

function extractResponseText(result) {
  if (!result) {
    return '';
  }

  if (typeof result.text === 'string') {
    return cleanText(result.text);
  }

  if (typeof result.text === 'function') {
    return cleanText(result.text());
  }

  return '';
}

function createOfficialClient(apiKey) {
  const key = cleanText(
    apiKey || process.env.GEMINI_API_KEY
  );

  if (!key) {
    throw new Error(
      'GEMINI_API_KEY no está configurada.'
    );
  }

  return new GoogleGenAI({
    apiKey: key
  });
}

class GeminiProvider extends providerApi.ProviderInterface {
  constructor(options) {
    super('gemini');

    const settings =
      options && typeof options === 'object'
        ? options
        : {};

    this.client = settings.client || null;
    this.apiKey = settings.apiKey || null;
    this.model = settings.model || CONFIG.model;

    this.temperature =
      settings.temperature == null
        ? CONFIG.temperature
        : settings.temperature;

    this.maxOutputTokens =
      settings.maxOutputTokens ||
      CONFIG.maxOutputTokens;
  }

  ensureClient() {
    if (!this.client) {
      this.client = createOfficialClient(
        this.apiKey
      );
    }

    if (
      !this.client.models ||
      typeof this.client.models.generateContent !== 'function'
    ) {
      throw new Error(
        'El cliente Gemini no está configurado correctamente.'
      );
    }

    return this.client;
  }

  async generate(input) {
    const request =
      input && typeof input === 'object'
        ? input
        : {};

    const message = cleanText(request.message);

    if (!message) {
      throw new Error(
        'GeminiProvider recibió un mensaje vacío.'
      );
    }

    const client = this.ensureClient();

    const result = await client.models.generateContent({
      model: this.model,

      contents: historyToContents(
        request.history,
        message
      ),

      config: {
        systemInstruction: cleanText(
          request.systemPrompt
        ),
        temperature: this.temperature,
        maxOutputTokens: this.maxOutputTokens
      }
    });

    const text = extractResponseText(result);

    if (!text) {
      throw new Error(
        'Gemini devolvió una respuesta vacía.'
      );
    }

    return {
      text: text,
      toolCalls: [],
      raw: null
    };
  }
}

module.exports = {
  GeminiProvider,
  historyToContents,
  extractResponseText,
  createOfficialClient
};

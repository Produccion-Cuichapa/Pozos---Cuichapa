'use strict';

const functions = require('firebase-functions');
const brainApi = require('./core/brain');
const {
  GeminiProvider
} = require('./providers/gemini-provider');

const geminiProvider = new GeminiProvider();

const brain = brainApi.createBrain({
  provider: geminiProvider
});

async function handleChat(data, context) {
  const payload =
    data && typeof data === 'object'
      ? data
      : {};

  const auth =
    context && context.auth
      ? {
          uid: context.auth.uid || null
        }
      : null;

  const metadata = Object.assign(
    {},
    payload.metadata || {},
    {
      authenticated: Boolean(auth),
      uid: auth ? auth.uid : null
    }
  );

  return brain.chat({
    message: payload.message,
    sessionId: payload.sessionId,
    history: payload.history,
    metadata: metadata
  });
}

const iaCuichapaChat = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '256MB',
    secrets: ['GEMINI_API_KEY']
  })
  .https.onCall(handleChat);

module.exports = {
  iaCuichapaChat,
  handleChat,
  geminiProvider
};

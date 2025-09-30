const { buildPromptPayload } = require('../prompts/builder');
const { recordPromptSession } = require('../promptSessions');
const { fetchGeminiExplanation } = require('./gemini');
const { fetchOpenAIStyleExplanation } = require('./openai');

async function resolveGeminiExplanation(
  hoveredWord,
  lineText,
  providerConfig,
  registry,
  token
) {
  const promptPayload = await buildPromptPayload(
    hoveredWord,
    lineText,
    providerConfig,
    registry
  );
  const geminiPrompt = promptPayload.systemPrompt
    ? `${promptPayload.systemPrompt}\n\n${promptPayload.userPrompt}`
    : promptPayload.userPrompt;
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: geminiPrompt }]
      }
    ]
  };

  const explanation = await fetchGeminiExplanation(
    geminiPrompt,
    providerConfig.geminiEndpoint,
    providerConfig.geminiModel,
    providerConfig.geminiApiKey,
    token
  );

  recordPromptSession({
    provider: 'gemini',
    endpoint: providerConfig.geminiEndpoint,
    model: providerConfig.geminiModel,
    hoveredWord,
    lineText,
    systemPrompt: promptPayload.systemPrompt,
    userPrompt: promptPayload.userPrompt,
    renderedPrompt: geminiPrompt,
    requestPayload: JSON.stringify(requestBody, null, 2),
    responseText: explanation.text,
    responseError: explanation.error,
    timestamp: Date.now()
  });

  return explanation;
}

async function resolveOpenAIStyleExplanation(
  hoveredWord,
  lineText,
  providerConfig,
  registry,
  endpoint,
  apiKey,
  model,
  provider,
  token
) {
  const promptPayload = await buildPromptPayload(
    hoveredWord,
    lineText,
    providerConfig,
    registry
  );
  const messages = [];

  if (promptPayload.systemPrompt) {
    messages.push({ role: 'system', content: promptPayload.systemPrompt });
  }

  messages.push({ role: 'user', content: promptPayload.userPrompt });

  const explanation = await fetchOpenAIStyleExplanation(
    messages,
    endpoint,
    apiKey,
    model,
    token,
    provider
  );

  const renderedPrompt = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n');

  recordPromptSession({
    provider,
    endpoint,
    model,
    hoveredWord,
    lineText,
    systemPrompt: promptPayload.systemPrompt,
    userPrompt: promptPayload.userPrompt,
    renderedPrompt,
    requestPayload: JSON.stringify({ model, messages }, null, 2),
    responseText: explanation.text,
    responseError: explanation.error,
    timestamp: Date.now()
  });

  return explanation;
}

module.exports = {
  resolveGeminiExplanation,
  resolveOpenAIStyleExplanation
};

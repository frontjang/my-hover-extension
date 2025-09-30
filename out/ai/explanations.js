"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGeminiExplanation = resolveGeminiExplanation;
exports.resolveOpenAIStyleExplanation = resolveOpenAIStyleExplanation;
const builder_1 = require("../prompts/builder");
const promptSessions_1 = require("../promptSessions");
const gemini_1 = require("./gemini");
const openai_1 = require("./openai");
async function resolveGeminiExplanation(hoveredWord, lineText, providerConfig, registry, token) {
    const promptPayload = await (0, builder_1.buildPromptPayload)(hoveredWord, lineText, providerConfig, registry);
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
    const explanation = await (0, gemini_1.fetchGeminiExplanation)(geminiPrompt, providerConfig.geminiEndpoint, providerConfig.geminiModel, providerConfig.geminiApiKey, token);
    (0, promptSessions_1.recordPromptSession)({
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
async function resolveOpenAIStyleExplanation(hoveredWord, lineText, providerConfig, registry, endpoint, apiKey, model, provider, token) {
    const promptPayload = await (0, builder_1.buildPromptPayload)(hoveredWord, lineText, providerConfig, registry);
    const messages = [];
    if (promptPayload.systemPrompt) {
        messages.push({ role: 'system', content: promptPayload.systemPrompt });
    }
    messages.push({ role: 'user', content: promptPayload.userPrompt });
    const explanation = await (0, openai_1.fetchOpenAIStyleExplanation)(messages, endpoint, apiKey, model, token, provider);
    const renderedPrompt = messages
        .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
        .join('\n\n');
    (0, promptSessions_1.recordPromptSession)({
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
//# sourceMappingURL=explanations.js.map
import * as vscode from 'vscode';
import { LineProcessorRegistry } from '../prompts/registry';
import { buildPromptPayload } from '../prompts/builder';
import { recordPromptSession } from '../promptSessions';
import { ChatMessage, ProviderConfig, ProviderSelection } from './types';
import { fetchGeminiExplanation } from './gemini';
import { fetchOpenAIStyleExplanation } from './openai';

export interface ProviderExplanationResult {
  text?: string;
  error?: string;
}

export async function resolveGeminiExplanation(
  hoveredWord: string,
  lineText: string | undefined,
  providerConfig: ProviderConfig,
  registry: LineProcessorRegistry,
  token: vscode.CancellationToken
): Promise<ProviderExplanationResult> {
  const promptPayload = await buildPromptPayload(hoveredWord, lineText, providerConfig, registry);
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

export async function resolveOpenAIStyleExplanation(
  hoveredWord: string,
  lineText: string | undefined,
  providerConfig: ProviderConfig,
  registry: LineProcessorRegistry,
  endpoint: string,
  apiKey: string,
  model: string,
  provider: ProviderSelection,
  token: vscode.CancellationToken
): Promise<ProviderExplanationResult> {
  const promptPayload = await buildPromptPayload(hoveredWord, lineText, providerConfig, registry);
  const messages: ChatMessage[] = [];

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

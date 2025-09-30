import * as vscode from 'vscode';

export type ProviderSelection = 'gemini' | 'openai' | 'custom' | 'customAI';

export interface ProviderConfig {
  provider: ProviderSelection;
  geminiEndpoint: string;
  geminiModel: string;
  geminiApiKey: string;
  openAiEndpoint: string;
  openAiApiKey: string;
  openAiModel: string;
  customEndpoint: string;
  customApiKey: string;
  customModel: string;
  systemPrompt: string;
  basePromptTemplate: string;
  lineContextAugmenters: string[];
  referenceSearchRoots: string[];
}

export type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

export const PROVIDER_LABELS: Record<ProviderSelection, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  custom: 'Custom OpenAI-compatible',
  customAI: 'CustomAI (.env)'
};

export function getProviderConfig(
  config: vscode.WorkspaceConfiguration
): ProviderConfig {
  const provider = (config.get<string>('provider') ?? 'gemini') as ProviderSelection;

  const getString = (key: string) => {
    const value = config.get<string>(key);
    return value ? value.trim() : '';
  };

  return {
    provider,
    geminiEndpoint: getString('geminiEndpoint'),
    geminiModel: getString('geminiModel'),
    geminiApiKey: getString('geminiApiKey'),
    openAiEndpoint: getString('openAiEndpoint'),
    openAiApiKey: getString('openAiApiKey'),
    openAiModel: getString('openAiModel'),
    customEndpoint: getString('customEndpoint'),
    customApiKey: getString('customApiKey'),
    customModel: getString('customModel'),
    systemPrompt: config.get<string>('systemPrompt') ?? '',
    basePromptTemplate:
      config.get<string>('basePromptTemplate') ??
      "Explain the word '{{word}}' in plain language. It was in the line: '{{line}}'.",
    lineContextAugmenters: config.get<string[]>('lineContextAugmenters') ?? ['fileLineReference'],
    referenceSearchRoots: config.get<string[]>('referenceSearchRoots') ?? []
  };
}

import { ProviderConfig } from '../ai/types';
import { LineProcessorRegistry } from './registry';

export interface PromptPayload {
  systemPrompt?: string;
  userPrompt: string;
}

function applyTemplate(template: string, word: string, line: string): string {
  return template
    .replace(/\{\{\s*word\s*\}\}/gi, word)
    .replace(/\{\{\s*line\s*\}\}/gi, line);
}

export async function buildPromptPayload(
  word: string,
  lineText: string | undefined,
  config: ProviderConfig,
  registry: LineProcessorRegistry
): Promise<PromptPayload> {
  const trimmedWord = word.trim();
  const trimmedLine = (lineText ?? '').trim();
  const systemPrompt = config.systemPrompt.trim() || undefined;

  const baseTemplate = config.basePromptTemplate.trim();
  const baseInstruction = baseTemplate
    ? applyTemplate(baseTemplate, trimmedWord, trimmedLine)
    : `Explain the word "${trimmedWord}" in plain language.`;

  const promptLines: string[] = [baseInstruction];

  if (trimmedLine && config.lineContextAugmenters.length > 0) {
    const contexts = await registry.collect(
      { lineText: lineText ?? '', word: trimmedWord },
      config.lineContextAugmenters
    );

    if (contexts.length > 0) {
      promptLines.push(...contexts);
    }
  }

  const prompt = promptLines.join('\n\n');

  return {
    systemPrompt,
    userPrompt: prompt
  };
}

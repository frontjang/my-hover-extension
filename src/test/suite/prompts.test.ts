import * as assert from 'assert';
import { ProviderConfig } from '../../ai/types';
import { buildPromptPayload } from '../../prompts/builder';
import { LineProcessor, LineProcessorRegistry } from '../../prompts';

describe('Prompt builder', () => {
  const baseConfig: ProviderConfig = {
    provider: 'gemini',
    geminiEndpoint: '',
    geminiModel: '',
    geminiApiKey: '',
    openAiEndpoint: '',
    openAiApiKey: '',
    openAiModel: '',
    customEndpoint: '',
    customApiKey: '',
    customModel: '',
    systemPrompt: '',
    basePromptTemplate: "Explain '{{word}}' from '{{line}}'",
    lineContextAugmenters: ['fileLineReference'],
    referenceSearchRoots: []
  };

  it('replaces word and line placeholders in the base prompt', async () => {
    const registry = new LineProcessorRegistry();
    const payload = await buildPromptPayload(
      'identifier',
      'const identifier = value;',
      baseConfig,
      registry
    );

    assert.strictEqual(
      payload.userPrompt,
      "Explain 'identifier' from 'const identifier = value;'"
    );
  });

  it('appends supporting context from registered processors', async () => {
    const processors: LineProcessor[] = [
      {
        id: 'fileLineReference',
        async process() {
          return 'Supporting context from processor.';
        }
      }
    ];
    const registry = new LineProcessorRegistry(processors);
    const payload = await buildPromptPayload(
      'file_line',
      'file_line = "src/main.rs:42"',
      baseConfig,
      registry
    );

    assert.ok(
      payload.userPrompt.includes('Supporting context from processor.')
    );
  });

  it('falls back to default prompt when template is empty', async () => {
    const registry = new LineProcessorRegistry();
    const payload = await buildPromptPayload('word', 'line', {
      ...baseConfig,
      basePromptTemplate: '  '
    }, registry);

    assert.ok(
      payload.userPrompt.startsWith('Explain the word "word" in plain language.')
    );
  });

  it('ignores unknown processors', async () => {
    const registry = new LineProcessorRegistry();
    const payload = await buildPromptPayload('word', 'file_line = "value"', {
      ...baseConfig,
      lineContextAugmenters: ['unknownProcessor']
    }, registry);

    assert.strictEqual(
      payload.userPrompt,
      "Explain 'word' from 'file_line = \"value\"'"
    );
  });
});

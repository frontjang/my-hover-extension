"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const builder_1 = require("../../prompts/builder");
const prompts_1 = require("../../prompts");
describe('Prompt builder', () => {
    const baseConfig = {
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
        const registry = new prompts_1.LineProcessorRegistry();
        const payload = await (0, builder_1.buildPromptPayload)('identifier', 'const identifier = value;', baseConfig, registry);
        assert.strictEqual(payload.userPrompt, "Explain 'identifier' from 'const identifier = value;'");
    });
    it('appends supporting context from registered processors', async () => {
        const processors = [
            {
                id: 'fileLineReference',
                async process() {
                    return 'Supporting context from processor.';
                }
            }
        ];
        const registry = new prompts_1.LineProcessorRegistry(processors);
        const payload = await (0, builder_1.buildPromptPayload)('file_line', 'file_line = "src/main.rs:42"', baseConfig, registry);
        assert.ok(payload.userPrompt.includes('Supporting context from processor.'));
    });
    it('falls back to default prompt when template is empty', async () => {
        const registry = new prompts_1.LineProcessorRegistry();
        const payload = await (0, builder_1.buildPromptPayload)('word', 'line', {
            ...baseConfig,
            basePromptTemplate: '  '
        }, registry);
        assert.ok(payload.userPrompt.startsWith('Explain the word "word" in plain language.'));
    });
    it('ignores unknown processors', async () => {
        const registry = new prompts_1.LineProcessorRegistry();
        const payload = await (0, builder_1.buildPromptPayload)('word', 'file_line = "value"', {
            ...baseConfig,
            lineContextAugmenters: ['unknownProcessor']
        }, registry);
        assert.strictEqual(payload.userPrompt, "Explain 'word' from 'file_line = \"value\"'");
    });
});
//# sourceMappingURL=prompts.test.js.map
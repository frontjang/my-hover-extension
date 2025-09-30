"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDER_LABELS = void 0;
exports.getProviderConfig = getProviderConfig;
exports.PROVIDER_LABELS = {
    gemini: 'Gemini',
    openai: 'OpenAI',
    custom: 'Custom OpenAI-compatible'
};
function getProviderConfig(config) {
    const provider = (config.get('provider') ?? 'gemini');
    const getString = (key) => {
        const value = config.get(key);
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
        systemPrompt: config.get('systemPrompt') ?? '',
        basePromptTemplate: config.get('basePromptTemplate') ??
            "Explain the word '{{word}}' in plain language. It was in the line: '{{line}}'.",
        lineContextAugmenters: config.get('lineContextAugmenters') ?? ['fileLineReference'],
        referenceSearchRoots: config.get('referenceSearchRoots') ?? []
    };
}
//# sourceMappingURL=types.js.map
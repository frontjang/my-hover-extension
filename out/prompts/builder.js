"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPromptPayload = buildPromptPayload;
function applyTemplate(template, word, line) {
    return template
        .replace(/\{\{\s*word\s*\}\}/gi, word)
        .replace(/\{\{\s*line\s*\}\}/gi, line);
}
async function buildPromptPayload(word, lineText, config, registry) {
    const trimmedWord = word.trim();
    const trimmedLine = (lineText ?? '').trim();
    const systemPrompt = config.systemPrompt.trim() || undefined;
    const baseTemplate = config.basePromptTemplate.trim();
    const baseInstruction = baseTemplate
        ? applyTemplate(baseTemplate, trimmedWord, trimmedLine)
        : `Explain the word "${trimmedWord}" in plain language.`;
    const promptLines = [baseInstruction];
    if (trimmedLine && config.lineContextAugmenters.length > 0) {
        const contexts = await registry.collect({ lineText: lineText ?? '', word: trimmedWord }, config.lineContextAugmenters);
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
//# sourceMappingURL=builder.js.map
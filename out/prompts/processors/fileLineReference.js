"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileLineReferenceProcessor = exports.FILE_LINE_PATTERN = void 0;
exports.parseFileLineReference = parseFileLineReference;
exports.FILE_LINE_PATTERN = /file_line\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i;
function parseFileLineReference(reference) {
    const trimmed = reference.trim();
    if (!trimmed) {
        return undefined;
    }
    const normalized = trimmed.replace(/\\/g, '/');
    const parts = normalized.split(':');
    if (parts.length < 2) {
        return undefined;
    }
    const linePart = parts.pop();
    const filePath = parts.join(':');
    const parsedLine = Number.parseInt(linePart ?? '', 10);
    if (!Number.isFinite(parsedLine) || parsedLine <= 0) {
        return undefined;
    }
    return { filePath, line: parsedLine };
}
class FileLineReferenceProcessor {
    constructor(resolver) {
        this.resolver = resolver;
        this.id = 'fileLineReference';
    }
    async process({ lineText }) {
        const match = exports.FILE_LINE_PATTERN.exec(lineText);
        if (!match) {
            return undefined;
        }
        const parsed = parseFileLineReference(match[1]);
        if (!parsed) {
            console.log('[MyHoverExtension] file_line reference found but could not be parsed.');
            return undefined;
        }
        const context = await this.resolver.resolve(parsed.filePath, parsed.line);
        if (!context) {
            console.log(`[MyHoverExtension] file_line reference to ${parsed.filePath}:${parsed.line} could not be resolved.`);
            return undefined;
        }
        const header = `Supporting context from ${context.displayPath}:${parsed.line}`;
        const fenced = ['```', context.snippet.trimEnd(), '```'].join('\n');
        return `${header}\n${fenced}`;
    }
}
exports.FileLineReferenceProcessor = FileLineReferenceProcessor;
//# sourceMappingURL=fileLineReference.js.map
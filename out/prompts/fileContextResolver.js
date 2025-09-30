"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileContextResolver = void 0;
const fsPromises = require("fs/promises");
const path = require("path");
const STEM_EXTENSION_PRIORITY = [
    '.py',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.c',
    '.cc',
    '.cpp',
    '.h',
    '.hpp',
    '.java',
    '.cs',
    '.go',
    '.rs',
    '.php',
    '.rb',
    '.kt',
    '.swift',
    '.m',
    '.mm',
    '.json',
    '.yaml',
    '.yml',
    '.md',
    '.txt'
];
class FileContextResolver {
    constructor(options) {
        this.roots = options.roots.map((root) => path.resolve(root));
        this.maxSearchEntries = options.maxSearchEntries ?? 2000;
    }
    async resolve(referencePath, line) {
        if (!referencePath) {
            return undefined;
        }
        const normalizedReference = referencePath.replace(/\\/g, '/');
        const candidate = await this.findFile(normalizedReference);
        if (!candidate) {
            console.log(`[MyHoverExtension] Unable to resolve reference path "${referencePath}" using roots ${this.roots.length > 0 ? this.roots.join(', ') : '<none>'}.`);
            return undefined;
        }
        try {
            const contents = await fsPromises.readFile(candidate, 'utf8');
            const lines = contents.split(/\r?\n/);
            const zeroBasedLine = Math.max(0, line - 1);
            if (zeroBasedLine >= lines.length) {
                console.log(`[MyHoverExtension] Resolved file "${candidate}" does not contain line ${line}.`);
                return undefined;
            }
            const snippet = extractFunctionBlock(lines, zeroBasedLine, candidate);
            const displayPath = this.makeDisplayPath(candidate);
            return {
                absolutePath: candidate,
                displayPath,
                line,
                snippet
            };
        }
        catch (error) {
            console.error('[MyHoverExtension] Failed to read referenced file:', error);
            return undefined;
        }
    }
    makeDisplayPath(resolvedPath) {
        for (const root of this.roots) {
            if (resolvedPath.startsWith(root)) {
                return path.relative(root, resolvedPath) || path.basename(resolvedPath);
            }
        }
        return resolvedPath;
    }
    async findFile(referencePath) {
        if (path.isAbsolute(referencePath)) {
            if (await this.exists(referencePath)) {
                return referencePath;
            }
            return undefined;
        }
        for (const root of this.roots) {
            const joined = path.join(root, referencePath);
            if (await this.exists(joined)) {
                return joined;
            }
        }
        const filename = path.basename(referencePath);
        if (!filename) {
            return undefined;
        }
        let visited = 0;
        for (const root of this.roots) {
            const result = await this.walkForFile(root, filename, () => {
                visited += 1;
                return visited > this.maxSearchEntries;
            });
            if (result) {
                return result;
            }
        }
        const stem = path.parse(filename).name;
        if (!stem) {
            return undefined;
        }
        visited = 0;
        let bestMatch;
        for (const root of this.roots) {
            const match = await this.walkForFileByStem(root, stem, () => {
                visited += 1;
                return visited > this.maxSearchEntries;
            });
            if (match && (!bestMatch || match.score < bestMatch.score)) {
                bestMatch = match;
            }
            if (visited > this.maxSearchEntries) {
                break;
            }
        }
        if (bestMatch) {
            console.log(`[MyHoverExtension] Resolved reference "${referencePath}" using filename stem match -> "${bestMatch.path}".`);
            return bestMatch.path;
        }
        return undefined;
    }
    scoreExtension(ext) {
        const normalized = ext.toLowerCase();
        const index = STEM_EXTENSION_PRIORITY.indexOf(normalized);
        if (index >= 0) {
            return index;
        }
        return STEM_EXTENSION_PRIORITY.length + (normalized ? 1 : 0);
    }
    async walkForFileByStem(directory, stem, shouldStop) {
        if (shouldStop()) {
            return undefined;
        }
        let entries;
        try {
            entries = await fsPromises.readdir(directory, { withFileTypes: true });
        }
        catch {
            return undefined;
        }
        let bestMatch;
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                const nested = await this.walkForFileByStem(fullPath, stem, shouldStop);
                if (nested && (!bestMatch || nested.score < bestMatch.score)) {
                    bestMatch = nested;
                }
            }
            else if (entry.isFile()) {
                const entryStem = path.parse(entry.name).name;
                if (entryStem === stem) {
                    const score = this.scoreExtension(path.extname(entry.name));
                    const candidate = { path: fullPath, score };
                    if (!bestMatch || candidate.score < bestMatch.score) {
                        bestMatch = candidate;
                    }
                }
            }
            if (shouldStop()) {
                break;
            }
        }
        return bestMatch;
    }
    async walkForFile(directory, filename, shouldStop) {
        if (shouldStop()) {
            return undefined;
        }
        let entries;
        try {
            entries = await fsPromises.readdir(directory, { withFileTypes: true });
        }
        catch (error) {
            return undefined;
        }
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                const found = await this.walkForFile(fullPath, filename, shouldStop);
                if (found) {
                    return found;
                }
            }
            else if (entry.isFile() && entry.name === filename) {
                return fullPath;
            }
            if (shouldStop()) {
                return undefined;
            }
        }
        return undefined;
    }
    async exists(filePath) {
        try {
            await fsPromises.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.FileContextResolver = FileContextResolver;
const FUNCTION_HEADER_PATTERNS = [
    /^\s*(export\s+)?(async\s+)?function\s+\w+/,
    /^\s*(export\s+)?(async\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\(/,
    /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?function\b/,
    /^\s*(export\s+)?class\s+\w+/,
    /^\s*def\s+\w+\s*\(.*\)\s*:/
];
function extractFunctionBlock(lines, targetLine, filePath) {
    const headerIndex = findHeaderLine(lines, targetLine);
    const docStart = includeLeadingDocstring(lines, headerIndex);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.py') {
        const end = findPythonBlockEnd(lines, headerIndex);
        return lines.slice(docStart, end + 1).join('\n');
    }
    const end = findBraceLanguageBlockEnd(lines, headerIndex);
    return lines.slice(docStart, end + 1).join('\n');
}
function findHeaderLine(lines, start) {
    for (let index = start; index >= 0; index -= 1) {
        const text = lines[index];
        if (!text.trim()) {
            continue;
        }
        if (FUNCTION_HEADER_PATTERNS.some((pattern) => pattern.test(text))) {
            return index;
        }
    }
    return start;
}
function includeLeadingDocstring(lines, headerIndex) {
    let index = headerIndex - 1;
    let docStart = headerIndex;
    while (index >= 0) {
        const text = lines[index];
        if (!text.trim()) {
            index -= 1;
            continue;
        }
        if (/^\s*(\/\/|#)/.test(text) || /^\s*\*/.test(text) || /"""|'''/.test(text)) {
            docStart = index;
            index -= 1;
            continue;
        }
        if (/^\s*\/\*/.test(text)) {
            docStart = index;
            index -= 1;
            continue;
        }
        break;
    }
    return docStart;
}
function findBraceLanguageBlockEnd(lines, headerIndex) {
    let depth = 0;
    let end = headerIndex;
    let sawOpeningBrace = false;
    for (let index = headerIndex; index < lines.length; index += 1) {
        const text = lines[index];
        for (const char of text) {
            if (char === '{') {
                depth += 1;
                sawOpeningBrace = true;
            }
            else if (char === '}') {
                depth -= 1;
                if (sawOpeningBrace && depth <= 0) {
                    return index;
                }
            }
        }
        end = index;
    }
    return end;
}
function findPythonBlockEnd(lines, headerIndex) {
    const header = lines[headerIndex];
    const indentMatch = /^\s*/.exec(header) ?? [''];
    const headerIndent = indentMatch[0].length;
    let end = headerIndex;
    let inDocstring = false;
    let docstringDelimiter;
    for (let index = headerIndex + 1; index < lines.length; index += 1) {
        const text = lines[index];
        const trimmed = text.trim();
        if (!trimmed) {
            end = index;
            continue;
        }
        if (!inDocstring && (trimmed.startsWith('"""') || trimmed.startsWith("'''"))) {
            inDocstring = true;
            docstringDelimiter = trimmed.startsWith('"""') ? '"""' : "'''";
            end = index;
            if (trimmed.endsWith(docstringDelimiter) && trimmed.length > docstringDelimiter.length) {
                inDocstring = false;
            }
            continue;
        }
        if (inDocstring) {
            end = index;
            if (trimmed.endsWith(docstringDelimiter ?? '')) {
                inDocstring = false;
            }
            continue;
        }
        const indentLength = (/^\s*/.exec(text) ?? [''])[0].length;
        if (indentLength <= headerIndent && /^[^#]/.test(trimmed)) {
            break;
        }
        end = index;
    }
    return end;
}
//# sourceMappingURL=fileContextResolver.js.map
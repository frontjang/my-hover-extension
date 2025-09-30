"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomAILogSink = registerCustomAILogSink;
exports.redactSecret = redactSecret;
exports.sanitizeForLogging = sanitizeForLogging;
exports.logCustomAIDebug = logCustomAIDebug;
exports.logCustomAIWarning = logCustomAIWarning;
exports.logCustomAIError = logCustomAIError;
const env_1 = require("../config/env");
const SECRET_KEY_PATTERN = /(token|secret|key|authorization|password)/i;
const debugFlag = (0, env_1.getEnvVarBoolean)('CUSTOMAI_DEBUG_LOGS');
const DEBUG_ENABLED = debugFlag === undefined ? true : debugFlag;
const logSinks = new Set();
function registerCustomAILogSink(sink) {
    logSinks.add(sink);
    return () => {
        logSinks.delete(sink);
    };
}
function shouldRedact(keyPath) {
    return SECRET_KEY_PATTERN.test(keyPath);
}
function redactSecret(value) {
    if (!value) {
        return '<empty>';
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return '<empty>';
    }
    const visible = trimmed.slice(-4);
    const prefix = trimmed.length > 4 ? '…' : '';
    return `***${prefix}${visible} (len=${trimmed.length})`;
}
function sanitize(value, keyPath) {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        return shouldRedact(keyPath) ? redactSecret(value) : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((entry, idx) => sanitize(entry, `${keyPath}[${idx}]`));
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value).map(([key, entry]) => [
            key,
            sanitize(entry, keyPath ? `${keyPath}.${key}` : key)
        ]);
        return Object.fromEntries(entries);
    }
    return String(value);
}
function sanitizeForLogging(payload) {
    return sanitize(payload, '');
}
function logWith(level, message, extra) {
    if (!DEBUG_ENABLED) {
        return;
    }
    const sanitizedExtra = extra && Object.keys(extra).length > 0 ? sanitizeForLogging(extra) : undefined;
    if (sanitizedExtra) {
        // eslint-disable-next-line no-console
        console[level](`[CustomAI] ${message}`, sanitizedExtra);
    }
    else {
        // eslint-disable-next-line no-console
        console[level](`[CustomAI] ${message}`);
    }
    if (logSinks.size > 0) {
        for (const sink of logSinks) {
            try {
                sink(level, message, sanitizedExtra);
            }
            catch (error) {
                // eslint-disable-next-line no-console
                console.error('[CustomAI] Log sink error', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
}
function logCustomAIDebug(message, extra) {
    logWith('log', message, extra);
}
function logCustomAIWarning(message, extra) {
    logWith('warn', message, extra);
}
function logCustomAIError(message, extra) {
    logWith('error', message, extra);
}
//# sourceMappingURL=customAiDebug.js.map
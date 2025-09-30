import { getEnvVarBoolean } from '../config/env';

type Jsonish =
  | string
  | number
  | boolean
  | null
  | Jsonish[]
  | { [key: string]: Jsonish };

const SECRET_KEY_PATTERN = /(token|secret|key|authorization|password)/i;

const debugFlag = getEnvVarBoolean('CUSTOMAI_DEBUG_LOGS');
const DEBUG_ENABLED = debugFlag === undefined ? true : debugFlag;

function shouldRedact(keyPath: string): boolean {
  return SECRET_KEY_PATTERN.test(keyPath);
}

export function redactSecret(value: string | null | undefined): string {
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

function sanitize(value: unknown, keyPath: string): Jsonish {
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
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      sanitize(entry, keyPath ? `${keyPath}.${key}` : key)
    ]);
    return Object.fromEntries(entries);
  }

  return String(value);
}

export function sanitizeForLogging<T>(payload: T): T {
  return sanitize(payload, '') as T;
}

function logWith(level: 'log' | 'warn' | 'error', message: string, extra?: Record<string, unknown>): void {
  if (!DEBUG_ENABLED) {
    return;
  }

  if (extra && Object.keys(extra).length > 0) {
    // eslint-disable-next-line no-console
    console[level](`[CustomAI] ${message}`, sanitizeForLogging(extra));
  } else {
    // eslint-disable-next-line no-console
    console[level](`[CustomAI] ${message}`);
  }
}

export function logCustomAIDebug(message: string, extra?: Record<string, unknown>): void {
  logWith('log', message, extra);
}

export function logCustomAIWarning(message: string, extra?: Record<string, unknown>): void {
  logWith('warn', message, extra);
}

export function logCustomAIError(message: string, extra?: Record<string, unknown>): void {
  logWith('error', message, extra);
}

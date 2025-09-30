import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

let envFileLoaded = false;
const envFileValues: Record<string, string> = {};

const parseEnvValue = (rawValue: string): string => {
  const withoutCarriageReturn = rawValue.replace(/\r$/, "");
  const value = withoutCarriageReturn.trim();

  if (value.length === 0) {
    return "";
  }

  const firstChar = value[0];
  const lastChar = value[value.length - 1];

  if ((firstChar === '"' && lastChar === '"') || (firstChar === "'" && lastChar === "'")) {
    const inner = value.slice(1, -1);
    return inner.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  }

  return value;
};

const loadEnvFile = (): void => {
  if (envFileLoaded) {
    return;
  }

  envFileLoaded = true;

  const envPath = resolve(__dirname, "../../.env");

  if (!existsSync(envPath)) {
    return;
  }

  const contents = readFileSync(envPath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    if (!rawLine) {
      continue;
    }

    const trimmedLine = rawLine.trim();

    if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = rawLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    let key = rawLine.slice(0, separatorIndex).trim();

    if (key.startsWith("export ")) {
      key = key.slice("export ".length).trim();
    }

    if (!key) {
      continue;
    }

    const value = parseEnvValue(rawLine.slice(separatorIndex + 1));

    envFileValues[key] = value;

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

export const getEnvVar = (name: string, fallback?: string): string | undefined => {
  loadEnvFile();

  const envValue = process.env[name] ?? envFileValues[name];

  if (envValue === undefined || envValue === "") {
    return fallback;
  }

  return envValue;
};

export const requireEnvVar = (name: string): string => {
  const value = getEnvVar(name);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getEnvVarNumber = (name: string, fallback?: number): number | undefined => {
  const value = getEnvVar(name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getEnvVarBoolean = (name: string, fallback?: boolean): boolean | undefined => {
  const value = getEnvVar(name);
  if (value === undefined) {
    return fallback;
  }
  switch (value.toLowerCase()) {
    case "true":
    case "1":
    case "yes":
      return true;
    case "false":
    case "0":
    case "no":
      return false;
    default:
      return fallback;
  }
};

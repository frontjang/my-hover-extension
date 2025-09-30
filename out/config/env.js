"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvVarBoolean = exports.getEnvVarNumber = exports.requireEnvVar = exports.getEnvVar = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
let envFileLoaded = false;
const envFileValues = {};
const parseEnvValue = (rawValue) => {
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
const loadEnvFile = () => {
    if (envFileLoaded) {
        return;
    }
    envFileLoaded = true;
    const envPath = (0, path_1.resolve)(__dirname, "../../.env");
    if (!(0, fs_1.existsSync)(envPath)) {
        return;
    }
    const contents = (0, fs_1.readFileSync)(envPath, "utf8");
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
const getEnvVar = (name, fallback) => {
    loadEnvFile();
    const envValue = process.env[name] ?? envFileValues[name];
    if (envValue === undefined || envValue === "") {
        return fallback;
    }
    return envValue;
};
exports.getEnvVar = getEnvVar;
const requireEnvVar = (name) => {
    const value = (0, exports.getEnvVar)(name);
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};
exports.requireEnvVar = requireEnvVar;
const getEnvVarNumber = (name, fallback) => {
    const value = (0, exports.getEnvVar)(name);
    if (value === undefined) {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
exports.getEnvVarNumber = getEnvVarNumber;
const getEnvVarBoolean = (name, fallback) => {
    const value = (0, exports.getEnvVar)(name);
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
exports.getEnvVarBoolean = getEnvVarBoolean;
//# sourceMappingURL=env.js.map
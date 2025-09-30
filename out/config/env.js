"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvVarBoolean = exports.getEnvVarNumber = exports.requireEnvVar = exports.getEnvVar = void 0;
const getEnvVar = (name, fallback) => {
    const value = process.env[name];
    if (value === undefined || value === "") {
        return fallback;
    }
    return value;
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
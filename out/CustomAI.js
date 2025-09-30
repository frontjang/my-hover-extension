"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomAI = void 0;
const openai_1 = require("openai");
const model_1 = require("./model");
const env_1 = require("./config/env");
__exportStar(require("./model"), exports);
class CustomAI extends openai_1.default {
    constructor(opts = {}) {
        const globalRef = typeof globalThis === "object" ? globalThis : {};
        const isBrowser = typeof globalRef.window !== "undefined";
        const browserOptions = isBrowser
            ? {
                httpAgent: undefined,
                httpsAgent: undefined,
                fetch: typeof globalRef.fetch === "function" ? globalRef.fetch : undefined,
            }
            : {};
        const apiKey = opts.apiKey ?? (0, env_1.getEnvVar)("CUSTOMAI_API_KEY", "customai_dummy");
        const timeout = opts.timeout ?? (0, env_1.getEnvVarNumber)("CUSTOMAI_TIMEOUT", 30000);
        const maxRetries = opts.maxRetries ?? (0, env_1.getEnvVarNumber)("CUSTOMAI_MAX_RETRIES", 3);
        const baseURL = opts.baseURL ?? (0, env_1.getEnvVar)("CUSTOMAI_BASE_URL");
        const dangerouslyAllowBrowser = opts.dangerouslyAllowBrowser ?? (0, env_1.getEnvVarBoolean)("CUSTOMAI_ALLOW_BROWSER", true);
        super({
            ...opts,
            ...browserOptions,
            apiKey,
            timeout,
            maxRetries,
            baseURL,
            dangerouslyAllowBrowser,
        });
        this.azureAuthToken = null;
        const baseModels = this.models;
        Object.defineProperty(this, "models", {
            value: new model_1.CustomAIModels(baseModels),
            writable: false,
            configurable: false,
        });
    }
    setAzureAuthToken(token) {
        this.azureAuthToken = token;
    }
    authHeaders(opts) {
        if (this.azureAuthToken) {
            return { Authorization: `Bearer ${this.azureAuthToken}` };
        }
        return super.authHeaders(opts);
    }
    defaultHeaders(opts) {
        const headers = super.defaultHeaders(opts);
        if (this.azureAuthToken) {
            delete headers["OpenAI-Organization"];
            delete headers["OpenAI-Project"];
        }
        return headers;
    }
}
exports.CustomAI = CustomAI;
CustomAI.defaultScope = (0, env_1.requireEnvVar)("CUSTOMAI_DEFAULT_SCOPE");
//# sourceMappingURL=CustomAI.js.map
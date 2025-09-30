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
const model_1 = require("../model");
const env_1 = require("../config/env");
const customAiDebug_1 = require("./customAiDebug");
__exportStar(require("../model"), exports);
class CustomAI extends openai_1.default {
    constructor(opts = {}) {
        const globalRef = typeof globalThis === "object" ? globalThis : {};
        const isBrowser = typeof globalRef.window !== "undefined";
        (0, customAiDebug_1.logCustomAIDebug)("Constructing CustomAI client", {
            runtime: isBrowser ? "browser" : "node",
            hasFetch: typeof globalRef.fetch === "function",
            hasWindow: isBrowser,
        });
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
        (0, customAiDebug_1.logCustomAIDebug)("Resolved CustomAI constructor options", {
            baseURL,
            timeout,
            maxRetries,
            dangerouslyAllowBrowser,
            apiKey: (0, customAiDebug_1.redactSecret)(apiKey),
            defaultScope: CustomAI.defaultScope,
        });
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
        (0, customAiDebug_1.logCustomAIDebug)("CustomAI client initialized");
    }
    setAzureAuthToken(token) {
        this.azureAuthToken = token;
        (0, customAiDebug_1.logCustomAIDebug)("Azure auth token updated", {
            hasToken: !!token,
            tokenLength: token?.length ?? 0,
        });
    }
    authHeaders(opts) {
        if (this.azureAuthToken) {
            (0, customAiDebug_1.logCustomAIDebug)("Applying Azure auth header override", {
                path: opts.path,
                method: opts.method,
            });
            return { Authorization: `Bearer ${this.azureAuthToken}` };
        }
        const headers = super.authHeaders(opts);
        (0, customAiDebug_1.logCustomAIDebug)("Using default auth headers", {
            path: opts.path,
            method: opts.method,
        });
        return headers;
    }
    defaultHeaders(opts) {
        const headers = super.defaultHeaders(opts);
        if (this.azureAuthToken) {
            delete headers["OpenAI-Organization"];
            delete headers["OpenAI-Project"];
            (0, customAiDebug_1.logCustomAIDebug)("Removed OpenAI-specific headers due to Azure auth token", {
                path: opts.path,
                method: opts.method,
            });
        }
        (0, customAiDebug_1.logCustomAIDebug)("Computed default headers", {
            hasAzureToken: !!this.azureAuthToken,
            headerKeys: Object.keys(headers ?? {}),
        });
        return headers;
    }
}
exports.CustomAI = CustomAI;
CustomAI.defaultScope = (0, env_1.requireEnvVar)("CUSTOMAI_DEFAULT_SCOPE");
//# sourceMappingURL=CustomAI.js.map
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
const fs_1 = require("fs");
const https_1 = require("https");
const path_1 = require("path");
const openai_1 = require("openai");
const model_1 = require("../model");
const env_1 = require("../config/env");
const customAiDebug_1 = require("./customAiDebug");
const CERTIFICATE_FILE_EXTENSIONS = new Set([".crt", ".cer", ".pem", ".der", ".p7b", ".pfx"]);
const DEFAULT_CERTIFICATE_DIRECTORIES = ["EGADCerts", "EGADCerts/certs"];
const createCertificateLoadSummary = () => ({
    fileCount: 0,
    directoryCertificateCount: 0,
    directoriesSearched: [],
    directoriesWithCertificates: [],
    defaultDirectoriesApplied: [],
    envDirectoriesApplied: [],
});
const collectCertificatesFromDirectory = (directoryPath, source, certificates, summary, processedDirectories) => {
    const resolvedPath = (0, path_1.resolve)(directoryPath);
    const normalizedPath = resolvedPath.replace(/\\+/g, "/");
    if (processedDirectories.has(normalizedPath)) {
        return;
    }
    processedDirectories.add(normalizedPath);
    summary.directoriesSearched.push(normalizedPath);
    if (!(0, fs_1.existsSync)(resolvedPath)) {
        (0, customAiDebug_1.logCustomAIDebug)("CustomAI certificate directory not found", {
            directory: normalizedPath,
            source,
        });
        return;
    }
    let stats;
    try {
        stats = (0, fs_1.statSync)(resolvedPath);
    }
    catch (error) {
        (0, customAiDebug_1.logCustomAIWarning)("Failed to inspect CustomAI certificate directory", {
            directory: normalizedPath,
            source,
            error: error instanceof Error ? error.message : String(error),
        });
        return;
    }
    if (!stats.isDirectory()) {
        (0, customAiDebug_1.logCustomAIWarning)("CustomAI certificate path is not a directory", {
            directory: normalizedPath,
            source,
        });
        return;
    }
    let loadedFromDirectory = 0;
    try {
        const entries = (0, fs_1.readdirSync)(resolvedPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) {
                continue;
            }
            const extension = (0, path_1.extname)(entry.name).toLowerCase();
            if (!CERTIFICATE_FILE_EXTENSIONS.has(extension)) {
                continue;
            }
            const entryPath = (0, path_1.resolve)(resolvedPath, entry.name);
            try {
                const contents = (0, fs_1.readFileSync)(entryPath);
                certificates.push(contents);
                loadedFromDirectory += 1;
            }
            catch (error) {
                (0, customAiDebug_1.logCustomAIWarning)("Failed to read CustomAI certificate file", {
                    path: entryPath,
                    directory: normalizedPath,
                    source,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    catch (error) {
        (0, customAiDebug_1.logCustomAIWarning)("Failed to enumerate CustomAI certificate directory", {
            directory: normalizedPath,
            source,
            error: error instanceof Error ? error.message : String(error),
        });
        return;
    }
    if (loadedFromDirectory > 0) {
        summary.directoryCertificateCount += loadedFromDirectory;
        summary.fileCount += loadedFromDirectory;
        summary.directoriesWithCertificates.push(normalizedPath);
        if (source === "default") {
            summary.defaultDirectoriesApplied.push(normalizedPath);
        }
        else {
            summary.envDirectoriesApplied.push(normalizedPath);
        }
    }
    (0, customAiDebug_1.logCustomAIDebug)("Processed CustomAI certificate directory", {
        directory: normalizedPath,
        source,
        loadedCertificates: loadedFromDirectory,
    });
};
const normalizeCertificateInput = (value) => {
    if (!value) {
        return undefined;
    }
    return Array.isArray(value) ? value : [value];
};
const loadCertificatesFromEnv = () => {
    const certificates = [];
    const summary = createCertificateLoadSummary();
    const processedDirectories = new Set();
    const inlineCertificates = (0, env_1.getEnvVar)("CUSTOMAI_CA_BUNDLE");
    let hadInlineCertificates = false;
    if (inlineCertificates) {
        certificates.push(inlineCertificates);
        hadInlineCertificates = true;
    }
    const bundlePathRaw = (0, env_1.getEnvVar)("CUSTOMAI_CA_BUNDLE_PATH");
    if (bundlePathRaw) {
        const segments = bundlePathRaw
            .split(path_1.delimiter)
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
        for (const segment of segments) {
            const resolvedPath = (0, path_1.resolve)(segment);
            if (!(0, fs_1.existsSync)(resolvedPath)) {
                (0, customAiDebug_1.logCustomAIWarning)("CustomAI CA bundle path does not exist", { path: resolvedPath });
                continue;
            }
            try {
                const stats = (0, fs_1.statSync)(resolvedPath);
                if (stats.isDirectory()) {
                    collectCertificatesFromDirectory(resolvedPath, "env", certificates, summary, processedDirectories);
                }
                else {
                    const contents = (0, fs_1.readFileSync)(resolvedPath);
                    certificates.push(contents);
                    summary.fileCount += 1;
                }
            }
            catch (error) {
                (0, customAiDebug_1.logCustomAIWarning)("Failed to read CustomAI CA bundle file", {
                    path: resolvedPath,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    const directoriesFromEnv = (0, env_1.getEnvVar)("CUSTOMAI_CA_BUNDLE_DIRS");
    if (directoriesFromEnv) {
        directoriesFromEnv
            .split(path_1.delimiter)
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
            .forEach((entry) => collectCertificatesFromDirectory(entry, "env", certificates, summary, processedDirectories));
    }
    const extensionRoot = (0, path_1.resolve)(__dirname, "../../");
    const defaultDirectoryCandidates = new Set();
    for (const directory of DEFAULT_CERTIFICATE_DIRECTORIES) {
        defaultDirectoryCandidates.add((0, path_1.resolve)(extensionRoot, directory));
        defaultDirectoryCandidates.add((0, path_1.resolve)(directory));
    }
    for (const directory of defaultDirectoryCandidates) {
        collectCertificatesFromDirectory(directory, "default", certificates, summary, processedDirectories);
    }
    const finalCertificates = certificates.length > 0 ? certificates : undefined;
    return {
        certificates: finalCertificates,
        fileCount: summary.fileCount,
        directoryCertificateCount: summary.directoryCertificateCount,
        hadInlineCertificates,
        directoriesSearched: summary.directoriesSearched,
        directoriesWithCertificates: summary.directoriesWithCertificates,
        defaultDirectoriesApplied: summary.defaultDirectoriesApplied,
        envDirectoriesApplied: summary.envDirectoriesApplied,
    };
};
const configureUndiciDispatcher = (opts, context) => {
    if (context.alreadyConfigured) {
        return true;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
        const undici = require("undici");
        if (typeof undici?.setGlobalDispatcher !== "function" || typeof undici?.Agent !== "function") {
            (0, customAiDebug_1.logCustomAIWarning)("Undici dispatcher hooks unavailable for CustomAI TLS overrides");
            return false;
        }
        const connectOptions = {
            rejectUnauthorized: !opts.disableSSLVerification,
        };
        if (opts.caCertificates?.length) {
            connectOptions.ca = opts.caCertificates;
        }
        const agentOptions = {
            connect: connectOptions,
        };
        const dispatcher = new undici.Agent(agentOptions);
        undici.setGlobalDispatcher(dispatcher);
        (0, customAiDebug_1.logCustomAIDebug)("Configured undici TLS dispatcher for CustomAI", {
            rejectUnauthorized: connectOptions.rejectUnauthorized,
            hasCustomCA: !!connectOptions.ca,
        });
        return true;
    }
    catch (error) {
        (0, customAiDebug_1.logCustomAIWarning)("Failed to configure undici TLS dispatcher for CustomAI", {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
};
let undiciDispatcherConfigured = false;
const resolveNodeAgentOptions = (opts) => {
    if (opts.providedHttpsAgent) {
        (0, customAiDebug_1.logCustomAIDebug)("Using caller-provided HTTPS agent for CustomAI");
        return {};
    }
    const agentOptions = {
        rejectUnauthorized: !opts.disableSSLVerification,
    };
    if (opts.caCertificates?.length) {
        agentOptions.ca = opts.caCertificates;
    }
    const httpsAgent = new https_1.Agent(agentOptions);
    const dispatcherResult = configureUndiciDispatcher({
        disableSSLVerification: opts.disableSSLVerification,
        caCertificates: opts.caCertificates,
    }, { alreadyConfigured: undiciDispatcherConfigured });
    if (dispatcherResult) {
        undiciDispatcherConfigured = true;
    }
    (0, customAiDebug_1.logCustomAIDebug)("Constructed CustomAI HTTPS agent", {
        rejectUnauthorized: agentOptions.rejectUnauthorized,
        hasCustomCA: !!agentOptions.ca,
        undiciDispatcherConfigured: dispatcherResult,
    });
    return {
        httpAgent: httpsAgent,
        httpsAgent,
    };
};
const getRequestDebugInfo = (opts) => {
    const record = opts;
    const path = typeof record.path === "string" ? record.path : undefined;
    const method = typeof record.method === "string" ? record.method : undefined;
    return { path, method };
};
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
        const disableSSLVerificationEnv = (0, env_1.getEnvVarBoolean)("CUSTOMAI_ALLOW_SELF_SIGNED_CERTS");
        const disableAutoCertLoadingEnv = (0, env_1.getEnvVarBoolean)("CUSTOMAI_DISABLE_AUTO_CERT_LOADING");
        const disableSSLVerification = opts.disableSSLVerification ?? (disableSSLVerificationEnv ?? false);
        const disableAutoCertLoading = opts.disableAutoCertLoading ?? (disableAutoCertLoadingEnv ?? false);
        const providedCertificates = normalizeCertificateInput(opts.caCertificates);
        const providedCertificateCount = providedCertificates?.length ?? 0;
        let caCertificates = providedCertificates;
        const envCertificates = disableAutoCertLoading ? undefined : loadCertificatesFromEnv();
        if (envCertificates?.certificates?.length) {
            caCertificates = [...(caCertificates ?? []), ...envCertificates.certificates];
        }
        const usingCertificates = caCertificates?.length ?? 0;
        const nodeAgentOptions = !isBrowser
            ? resolveNodeAgentOptions({
                disableSSLVerification,
                caCertificates,
                providedHttpsAgent: opts.httpsAgent,
            })
            : {};
        (0, customAiDebug_1.logCustomAIDebug)("Resolved CustomAI TLS configuration", {
            disableSSLVerification,
            disableAutoCertLoading,
            providedCertificates: providedCertificateCount,
            envCertificateFiles: envCertificates?.fileCount ?? 0,
            envInlineCertificates: envCertificates?.hadInlineCertificates ?? false,
            envDirectoryCertificates: envCertificates?.directoryCertificateCount ?? 0,
            certificateDirectoriesSearched: envCertificates?.directoriesSearched ?? [],
            certificateDirectoriesWithCerts: envCertificates?.directoriesWithCertificates ?? [],
            defaultCertificateDirectoriesApplied: envCertificates?.defaultDirectoriesApplied ?? [],
            envCertificateDirectoriesApplied: envCertificates?.envDirectoriesApplied ?? [],
            finalCertificateCount: usingCertificates,
            usingProvidedHttpsAgent: !!opts.httpsAgent,
            applyingNodeAgentOptions: !isBrowser,
        });
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
            ...nodeAgentOptions,
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
            (0, customAiDebug_1.logCustomAIDebug)("Applying Azure auth header override", getRequestDebugInfo(opts));
            return { Authorization: `Bearer ${this.azureAuthToken}` };
        }
        const headers = super.authHeaders(opts);
        (0, customAiDebug_1.logCustomAIDebug)("Using default auth headers", getRequestDebugInfo(opts));
        return headers;
    }
    defaultHeaders(opts) {
        const headers = super.defaultHeaders(opts);
        const requestInfo = getRequestDebugInfo(opts);
        if (this.azureAuthToken) {
            delete headers["OpenAI-Organization"];
            delete headers["OpenAI-Project"];
            (0, customAiDebug_1.logCustomAIDebug)("Removed OpenAI-specific headers due to Azure auth token", requestInfo);
        }
        (0, customAiDebug_1.logCustomAIDebug)("Computed default headers", {
            hasAzureToken: !!this.azureAuthToken,
            headerKeys: Object.keys(headers ?? {}),
            ...requestInfo,
        });
        return headers;
    }
}
exports.CustomAI = CustomAI;
CustomAI.defaultScope = (0, env_1.requireEnvVar)("CUSTOMAI_DEFAULT_SCOPE");
//# sourceMappingURL=CustomAI.js.map
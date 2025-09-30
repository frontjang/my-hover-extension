"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomAIEnvironmentConfig = getCustomAIEnvironmentConfig;
exports.getCustomAIMissingParts = getCustomAIMissingParts;
exports.getCustomAIBrowserAuthConfig = getCustomAIBrowserAuthConfig;
exports.buildCustomAIAuthorizationUrl = buildCustomAIAuthorizationUrl;
const env_1 = require("../config/env");
const customAiDebug_1 = require("./customAiDebug");
const COMPLETIONS_KEYS = [
    'CUSTOMAI_CHAT_COMPLETIONS_ENDPOINT',
    'CUSTOMAI_COMPLETIONS_ENDPOINT'
];
function trim(value) {
    return value ? value.trim() : '';
}
function buildEndpointFromBase(baseUrl) {
    const base = trim(baseUrl);
    if (!base) {
        return '';
    }
    const sanitized = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${sanitized}/chat/completions`;
}
function getCustomAIEnvironmentConfig() {
    const rawValues = {};
    const captureValue = (key, value, redact = false) => {
        rawValues[key] = value ? (redact ? (0, customAiDebug_1.redactSecret)(value) : value) : '<empty>';
        return value;
    };
    const completionsValues = COMPLETIONS_KEYS.map((key) => captureValue(key, trim((0, env_1.getEnvVar)(key))));
    const baseUrl = captureValue('CUSTOMAI_BASE_URL', trim((0, env_1.getEnvVar)('CUSTOMAI_BASE_URL')));
    captureValue('CUSTOMAI_ALLOW_SELF_SIGNED_CERTS', trim((0, env_1.getEnvVar)('CUSTOMAI_ALLOW_SELF_SIGNED_CERTS')));
    captureValue('CUSTOMAI_DISABLE_AUTO_CERT_LOADING', trim((0, env_1.getEnvVar)('CUSTOMAI_DISABLE_AUTO_CERT_LOADING')));
    captureValue('CUSTOMAI_CA_BUNDLE_PATH', trim((0, env_1.getEnvVar)('CUSTOMAI_CA_BUNDLE_PATH')));
    const inlineCaBundle = (0, env_1.getEnvVar)('CUSTOMAI_CA_BUNDLE');
    captureValue('CUSTOMAI_CA_BUNDLE', inlineCaBundle ? `<inline bundle len=${inlineCaBundle.length}>` : '');
    const explicitEndpoint = completionsValues.find(Boolean);
    const endpoint = explicitEndpoint || buildEndpointFromBase(baseUrl);
    const apiKey = captureValue('CUSTOMAI_API_KEY', trim((0, env_1.getEnvVar)('CUSTOMAI_API_KEY')), true);
    const modelValue = captureValue('CUSTOMAI_MODEL', trim((0, env_1.getEnvVar)('CUSTOMAI_MODEL')));
    const deployment = captureValue('CUSTOMAI_DEPLOYMENT', trim((0, env_1.getEnvVar)('CUSTOMAI_DEPLOYMENT')));
    const deploymentName = captureValue('CUSTOMAI_DEPLOYMENT_NAME', trim((0, env_1.getEnvVar)('CUSTOMAI_DEPLOYMENT_NAME')));
    const model = modelValue || deployment || deploymentName;
    (0, customAiDebug_1.logCustomAIDebug)('Read CustomAI environment variables', rawValues);
    const config = {
        endpoint,
        apiKey,
        model,
    };
    (0, customAiDebug_1.logCustomAIDebug)('Resolved CustomAI environment configuration', {
        endpoint: config.endpoint,
        model: config.model,
        apiKey: (0, customAiDebug_1.redactSecret)(config.apiKey),
    });
    return config;
}
function getCustomAIMissingParts(config) {
    const missing = [];
    if (!config.endpoint) {
        missing.push('endpoint');
    }
    if (!config.apiKey) {
        missing.push('API key');
    }
    if (!config.model) {
        missing.push('model');
    }
    (0, customAiDebug_1.logCustomAIDebug)('Evaluated CustomAI environment requirements', {
        missing,
        isComplete: missing.length === 0,
    });
    return missing;
}
function getCustomAIBrowserAuthConfig() {
    const config = {
        clientId: trim((0, env_1.getEnvVar)('CUSTOM_CLIENT_ID')),
        tenantId: trim((0, env_1.getEnvVar)('CUSTOM_TENANT_ID')),
        authority: trim((0, env_1.getEnvVar)('CUSTOM_AUTHORITY')),
        redirectUri: trim((0, env_1.getEnvVar)('CUSTOM_REDIRECT_URI')),
        defaultScope: trim((0, env_1.getEnvVar)('CUSTOMAI_DEFAULT_SCOPE')),
    };
    (0, customAiDebug_1.logCustomAIDebug)('Loaded CustomAI browser auth configuration', {
        clientId: config.clientId,
        tenantId: config.tenantId,
        authority: config.authority,
        redirectUri: config.redirectUri,
        hasDefaultScope: !!config.defaultScope,
    });
    return config;
}
function buildCustomAIAuthorizationUrl(authConfig = getCustomAIBrowserAuthConfig()) {
    const missing = [];
    if (!authConfig.clientId) {
        missing.push('client id');
    }
    if (!authConfig.tenantId) {
        missing.push('tenant id');
    }
    if (!authConfig.redirectUri) {
        missing.push('redirect URI');
    }
    if (!authConfig.defaultScope) {
        missing.push('default scope');
    }
    if (missing.length > 0) {
        (0, customAiDebug_1.logCustomAIDebug)('Unable to build CustomAI authorization URL due to missing values', { missing });
        return { missing };
    }
    const baseAuthority = (authConfig.authority || `https://login.microsoftonline.com/${authConfig.tenantId}`).replace(/\/+$/, '');
    const params = new URLSearchParams({
        client_id: authConfig.clientId,
        response_type: 'code',
        redirect_uri: authConfig.redirectUri,
        response_mode: 'query',
        scope: authConfig.defaultScope,
        prompt: 'select_account',
    });
    const url = `${baseAuthority}/oauth2/v2.0/authorize?${params.toString()}`;
    (0, customAiDebug_1.logCustomAIDebug)('Constructed CustomAI authorization URL', {
        authority: baseAuthority,
        hasQuery: params.toString().length > 0,
    });
    return { url, missing: [] };
}
//# sourceMappingURL=customEnv.js.map
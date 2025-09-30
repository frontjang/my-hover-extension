import { getEnvVar } from '../config/env';
import { logCustomAIDebug, redactSecret } from './customAiDebug';

export interface CustomAIEnvironmentConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

const COMPLETIONS_KEYS = [
  'CUSTOMAI_CHAT_COMPLETIONS_ENDPOINT',
  'CUSTOMAI_COMPLETIONS_ENDPOINT'
];

function trim(value: string | undefined): string {
  return value ? value.trim() : '';
}

function buildEndpointFromBase(baseUrl: string | undefined): string {
  const base = trim(baseUrl);

  if (!base) {
    return '';
  }

  const sanitized = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${sanitized}/chat/completions`;
}

export function getCustomAIEnvironmentConfig(): CustomAIEnvironmentConfig {
  const rawValues: Record<string, string> = {};

  const captureValue = (key: string, value: string, redact = false): string => {
    rawValues[key] = value ? (redact ? redactSecret(value) : value) : '<empty>';
    return value;
  };

  const completionsValues = COMPLETIONS_KEYS.map((key) => captureValue(key, trim(getEnvVar(key))));
  const baseUrl = captureValue('CUSTOMAI_BASE_URL', trim(getEnvVar('CUSTOMAI_BASE_URL')));

  const explicitEndpoint = completionsValues.find(Boolean);
  const endpoint = explicitEndpoint || buildEndpointFromBase(baseUrl);

  const apiKey = captureValue('CUSTOMAI_API_KEY', trim(getEnvVar('CUSTOMAI_API_KEY')), true);
  const modelValue = captureValue('CUSTOMAI_MODEL', trim(getEnvVar('CUSTOMAI_MODEL')));
  const deployment = captureValue('CUSTOMAI_DEPLOYMENT', trim(getEnvVar('CUSTOMAI_DEPLOYMENT')));
  const deploymentName = captureValue(
    'CUSTOMAI_DEPLOYMENT_NAME',
    trim(getEnvVar('CUSTOMAI_DEPLOYMENT_NAME'))
  );
  const model = modelValue || deployment || deploymentName;

  logCustomAIDebug('Read CustomAI environment variables', rawValues);

  const config: CustomAIEnvironmentConfig = {
    endpoint,
    apiKey,
    model,
  };

  logCustomAIDebug('Resolved CustomAI environment configuration', {
    endpoint: config.endpoint,
    model: config.model,
    apiKey: redactSecret(config.apiKey),
  });

  return config;
}

export function getCustomAIMissingParts(
  config: CustomAIEnvironmentConfig
): string[] {
  const missing: string[] = [];

  if (!config.endpoint) {
    missing.push('endpoint');
  }

  if (!config.apiKey) {
    missing.push('API key');
  }

  if (!config.model) {
    missing.push('model');
  }

  logCustomAIDebug('Evaluated CustomAI environment requirements', {
    missing,
    isComplete: missing.length === 0,
  });

  return missing;
}

export interface CustomAIBrowserAuthConfig {
  clientId?: string;
  tenantId?: string;
  authority?: string;
  redirectUri?: string;
  defaultScope?: string;
}

export interface CustomAIAuthorizationDetails {
  url?: string;
  missing: string[];
}

export function getCustomAIBrowserAuthConfig(): CustomAIBrowserAuthConfig {
  const config: CustomAIBrowserAuthConfig = {
    clientId: trim(getEnvVar('CUSTOM_CLIENT_ID')),
    tenantId: trim(getEnvVar('CUSTOM_TENANT_ID')),
    authority: trim(getEnvVar('CUSTOM_AUTHORITY')),
    redirectUri: trim(getEnvVar('CUSTOM_REDIRECT_URI')),
    defaultScope: trim(getEnvVar('CUSTOMAI_DEFAULT_SCOPE')),
  };

  logCustomAIDebug('Loaded CustomAI browser auth configuration', {
    clientId: config.clientId,
    tenantId: config.tenantId,
    authority: config.authority,
    redirectUri: config.redirectUri,
    hasDefaultScope: !!config.defaultScope,
  });

  return config;
}

export function buildCustomAIAuthorizationUrl(
  authConfig: CustomAIBrowserAuthConfig = getCustomAIBrowserAuthConfig()
): CustomAIAuthorizationDetails {
  const missing: string[] = [];

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
    logCustomAIDebug('Unable to build CustomAI authorization URL due to missing values', { missing });
    return { missing };
  }

  const baseAuthority = (authConfig.authority || `https://login.microsoftonline.com/${authConfig.tenantId}`).replace(/\/+$/, '');
  const params = new URLSearchParams({
    client_id: authConfig.clientId!,
    response_type: 'code',
    redirect_uri: authConfig.redirectUri!,
    response_mode: 'query',
    scope: authConfig.defaultScope!,
    prompt: 'select_account',
  });

  const url = `${baseAuthority}/oauth2/v2.0/authorize?${params.toString()}`;
  logCustomAIDebug('Constructed CustomAI authorization URL', {
    authority: baseAuthority,
    hasQuery: params.toString().length > 0,
  });

  return { url, missing: [] };
}

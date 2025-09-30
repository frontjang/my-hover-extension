import { getEnvVar } from '../config/env';

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
  const explicitEndpoint = COMPLETIONS_KEYS.map((key) => trim(getEnvVar(key))).find(Boolean);
  const endpoint = explicitEndpoint || buildEndpointFromBase(getEnvVar('CUSTOMAI_BASE_URL'));

  return {
    endpoint,
    apiKey: trim(getEnvVar('CUSTOMAI_API_KEY')),
    model:
      trim(getEnvVar('CUSTOMAI_MODEL')) ||
      trim(getEnvVar('CUSTOMAI_DEPLOYMENT')) ||
      trim(getEnvVar('CUSTOMAI_DEPLOYMENT_NAME'))
  };
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

  return missing;
}

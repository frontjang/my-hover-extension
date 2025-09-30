const http = require('http');
const https = require('https');

function resolveOptionalModule(paths) {
  for (const candidate of paths) {
    try {
      return require(candidate);
    } catch (error) {
      const notFound = error && error.code === 'MODULE_NOT_FOUND';
      if (!notFound || !error.message.includes(candidate)) {
        throw error;
      }
    }
  }
  return null;
}

function pickExport(mod) {
  if (mod == null) {
    return mod;
  }
  if (typeof mod === 'function') {
    return mod;
  }
  if (typeof mod === 'object') {
    if ('default' in mod && mod.default) {
      return mod.default;
    }
    const entries = Object.keys(mod);
    if (entries.length === 1) {
      return mod[entries[0]];
    }
  }
  return mod;
}

function createMissingCustomAI() {
  class CustomAIPlaceholder {
    static defaultScope = 'api://custom.ai/.default';

    constructor() {
      throw new Error(
        "CustomAINode requires a CustomAI implementation. Ensure one of './CustomAI', './customAI', '../CustomAI', or '../customAI' is available."
      );
    }

    setAzureAuthToken() {
      throw new Error('CustomAI implementation missing.');
    }
  }

  return CustomAIPlaceholder;
}

function createMissingAzureAuthClient() {
  return class AzureAuthClientPlaceholder {
    constructor() {
      throw new Error(
        "CustomAINode requires an AzureAuthClient implementation. Provide one of '../azureAuthClient', './azureAuthClient', '../auth/azureAuthClient', or './auth/azureAuthClient'."
      );
    }

    async authenticateWithDeviceCode() {
      throw new Error('AzureAuthClient implementation missing.');
    }

    async acquireTokenByCode() {
      throw new Error('AzureAuthClient implementation missing.');
    }

    async getCachedAccounts() {
      throw new Error('AzureAuthClient implementation missing.');
    }

    async signOut() {
      throw new Error('AzureAuthClient implementation missing.');
    }
  };
}

const CustomAIModule =
  resolveOptionalModule([
    './CustomAI',
    './customAI',
    '../CustomAI',
    '../customAI'
  ]);
const CustomAIBase = CustomAIModule ? pickExport(CustomAIModule) : createMissingCustomAI();

const AzureAuthModule = resolveOptionalModule([
  '../azureAuthClient',
  './azureAuthClient',
  '../auth/azureAuthClient',
  './auth/azureAuthClient'
]);
const AzureAuthClient = AzureAuthModule ? pickExport(AzureAuthModule) : createMissingAzureAuthClient();

const certificatesModule = resolveOptionalModule([
  '../certificates',
  './certificates',
  '../utils/certificates',
  './utils/certificates'
]);
const loadBundledCertificates = certificatesModule ? pickExport(certificatesModule) : () => [];

const constantsModule =
  resolveOptionalModule([
    '../customaiConstants',
    './customaiConstants',
    '../constants/customai',
    './constants/customai',
    '../constants',
    './constants'
  ]) || {};

const CUSTOMAI_CLIENT_ID =
  constantsModule.CUSTOMAI_CLIENT_ID ??
  constantsModule.ERI_CLIENT_ID ??
  process.env.CUSTOMAI_CLIENT_ID ??
  process.env.ERI_CLIENT_ID ??
  '';
const CUSTOMAI_TENANT_ID =
  constantsModule.CUSTOMAI_TENANT_ID ??
  constantsModule.ERI_TENANT_ID ??
  process.env.CUSTOMAI_TENANT_ID ??
  process.env.ERI_TENANT_ID ??
  '';
const CUSTOMAI_AUTHORITY =
  constantsModule.CUSTOMAI_AUTHORITY ??
  constantsModule.ERI_AUTHORITY ??
  process.env.CUSTOMAI_AUTHORITY ??
  process.env.ERI_AUTHORITY;

class CustomAINode extends CustomAIBase {
  constructor(options = {}) {
    const {
      disableSSLVerification,
      caCertificates,
      disableAutoCertLoading,
      ...clientOptions
    } = options;

    let finalCAs;
    let httpsAgent;
    let httpAgent;

    if (caCertificates) {
      finalCAs = Array.isArray(caCertificates) ? caCertificates : [caCertificates];
    } else if (!disableAutoCertLoading) {
      const bundled = loadBundledCertificates();
      if (Array.isArray(bundled) && bundled.length) {
        finalCAs = bundled;
      }
    }

    if (disableSSLVerification || finalCAs) {
      const agentOptions = {};
      if (disableSSLVerification) {
        agentOptions.rejectUnauthorized = false;
      }
      if (finalCAs) {
        agentOptions.ca = finalCAs;
      }
      httpsAgent = new https.Agent(agentOptions);
      httpAgent = new http.Agent();
    }

    const superOptions = { ...clientOptions };

    if (httpAgent && !superOptions.httpAgent) {
      superOptions.httpAgent = httpAgent;
    }
    if (httpsAgent && !superOptions.httpsAgent) {
      superOptions.httpsAgent = httpsAgent;
    }
    if (httpsAgent && !superOptions.httpAgent) {
      superOptions.httpAgent = httpsAgent;
    }

    super(superOptions);

    const authConfig = {
      clientId: CUSTOMAI_CLIENT_ID,
      tenantId: CUSTOMAI_TENANT_ID
    };
    if (CUSTOMAI_AUTHORITY) {
      authConfig.authority = CUSTOMAI_AUTHORITY;
    }

    this.nodeAuth = new AzureAuthClient(authConfig);
  }

  async customaiAuthenticateInTerminal(scopes = [CustomAIBase.defaultScope]) {
    const effectiveScopes = scopes && scopes.length ? scopes : [CustomAIBase.defaultScope];
    const res = await this.nodeAuth.authenticateWithDeviceCode(effectiveScopes);
    if (res && res.accessToken && typeof this.setAzureAuthToken === 'function') {
      this.setAzureAuthToken(res.accessToken);
    }
    return res;
  }

  async customaiAuthenticateWithCode(
    code,
    redirectUri,
    scopes = [CustomAIBase.defaultScope]
  ) {
    const effectiveScopes = scopes && scopes.length ? scopes : [CustomAIBase.defaultScope];
    const res = await this.nodeAuth.acquireTokenByCode(code, redirectUri, effectiveScopes);
    if (res && res.accessToken && typeof this.setAzureAuthToken === 'function') {
      this.setAzureAuthToken(res.accessToken);
    }
    return res;
  }

  async customaiAuthenticatedUser() {
    const accounts = await this.nodeAuth.getCachedAccounts();
    return accounts?.[0]?.username ?? 'Unknown';
  }

  async customaiLogout() {
    await this.nodeAuth.signOut();
    if (typeof this.setAzureAuthToken === 'function') {
      this.setAzureAuthToken('');
    }
  }
}

module.exports = CustomAINode;
module.exports.default = CustomAINode;

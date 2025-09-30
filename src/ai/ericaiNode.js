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

function createMissingEricAI() {
  class EricAIPlaceholder {
    static defaultScope = 'api://eric.ai/.default';

    constructor() {
      throw new Error(
        "EricAINode requires an EricAI implementation. Ensure one of './EricAI', './ericAI', '../EricAI', or '../ericAI' is available."
      );
    }

    setAzureAuthToken() {
      throw new Error('EricAI implementation missing.');
    }
  }

  return EricAIPlaceholder;
}

function createMissingAzureAuthClient() {
  return class AzureAuthClientPlaceholder {
    constructor() {
      throw new Error(
        "EricAINode requires an AzureAuthClient implementation. Provide one of '../azureAuthClient', './azureAuthClient', '../auth/azureAuthClient', or './auth/azureAuthClient'."
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

const EricAIModule = resolveOptionalModule([
  './EricAI',
  './ericAI',
  '../EricAI',
  '../ericAI'
]);
const EricAIBase = EricAIModule ? pickExport(EricAIModule) : createMissingEricAI();

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
const loadBundledCertificates = certificatesModule
  ? pickExport(certificatesModule)
  : () => [];

const constantsModule = resolveOptionalModule([
  '../ericaiConstants',
  './ericaiConstants',
  '../constants/ericai',
  './constants/ericai',
  '../constants',
  './constants'
]) || {};

const ERI_CLIENT_ID =
  constantsModule.ERI_CLIENT_ID ?? process.env.ERI_CLIENT_ID ?? '';
const ERI_TENANT_ID =
  constantsModule.ERI_TENANT_ID ?? process.env.ERI_TENANT_ID ?? '';
const ERI_AUTHORITY =
  constantsModule.ERI_AUTHORITY ?? process.env.ERI_AUTHORITY;

class EricAINode extends EricAIBase {
  constructor(options = {}) {
    const {
      disableSSLVerification,
      caCertificates,
      disableAutoCertLoading,
      ...clientOptions
    } = options;

    let agent;
    let finalCAs;

    if (caCertificates) {
      finalCAs = Array.isArray(caCertificates)
        ? caCertificates
        : [caCertificates];
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
      agent = new https.Agent(agentOptions);
    }

    super({ httpAgent: agent, ...clientOptions });

    const authConfig = {
      clientId: ERI_CLIENT_ID,
      tenantId: ERI_TENANT_ID
    };
    if (ERI_AUTHORITY) {
      authConfig.authority = ERI_AUTHORITY;
    }

    this.nodeAuth = new AzureAuthClient(authConfig);
  }

  async ericaiAuthenticateInTerminal(scopes = [EricAIBase.defaultScope]) {
    const effectiveScopes = scopes && scopes.length ? scopes : [EricAIBase.defaultScope];
    const res = await this.nodeAuth.authenticateWithDeviceCode(effectiveScopes);
    if (res && res.accessToken) {
      this.setAzureAuthToken(res.accessToken);
    }
    return res;
  }

  async ericaiAuthenticateWithCode(
    code,
    redirectUri,
    scopes = [EricAIBase.defaultScope]
  ) {
    const effectiveScopes = scopes && scopes.length ? scopes : [EricAIBase.defaultScope];
    const res = await this.nodeAuth.acquireTokenByCode(code, redirectUri, effectiveScopes);
    if (res && res.accessToken) {
      this.setAzureAuthToken(res.accessToken);
    }
    return res;
  }

  async ericaiAuthenticatedUser() {
    const accounts = await this.nodeAuth.getCachedAccounts();
    return accounts?.[0]?.username ?? 'Unknown';
  }

  async ericaiLogout() {
    await this.nodeAuth.signOut();
    if (typeof this.setAzureAuthToken === 'function') {
      this.setAzureAuthToken('');
    }
  }
}

module.exports = EricAINode;
module.exports.default = EricAINode;

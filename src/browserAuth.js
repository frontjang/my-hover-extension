const { PublicClientApplication } = require('@azure/msal-browser');

/**
 * @typedef {('popup'|'redirect')} InteractionType
 */

/**
 * @typedef {Object} BrowserAuthConfig
 * @property {string} clientId
 * @property {string} tenantId
 * @property {string} [authority]
 * @property {string} redirectUri
 * @property {string} [postLogoutRedirectUri]
 * @property {'localStorage'|'sessionStorage'|'memoryStorage'} [cacheLocation]
 * @property {string[]} [defaultScopes]
 * @property {InteractionType} [interactionType]
 * @property {string} [loginHint]
 */

class BrowserAuthClient {
  /**
   * @param {BrowserAuthConfig} cfg
   */
  constructor(cfg) {
    const authority = cfg.authority ?? `https://login.microsoftonline.com/${cfg.tenantId}/v2.0`;
    /** @type {import('@azure/msal-browser').Configuration} */
    const config = {
      auth: {
        clientId: cfg.clientId,
        authority,
        redirectUri: cfg.redirectUri,
        postLogoutRedirectUri: cfg.postLogoutRedirectUri,
        // SPA-specific settings
        navigateToLoginRequestUrl: false
      },
      cache: {
        cacheLocation: cfg.cacheLocation ?? 'sessionStorage',
        storeAuthStateInCookie: false
      },
      system: {
        // Allow redirects for SPA
        allowRedirectInIframe: true,
        // Reduce iframe timeout for better SPA experience
        iframeHashTimeout: 10000
      }
    };

    this.msal = new PublicClientApplication(config);
    this.account = null;
    this.defaultScopes = cfg.defaultScopes ?? [];
    this.interactionType = cfg.interactionType ?? 'popup';
    this.loginHint = cfg.loginHint;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.msal.initialize();
      this.isInitialized = true;

      // Now we can safely get accounts
      const accounts = this.msal.getAllAccounts();
      // Note: we intentionally avoid setting the account here. Account selection
      // should happen during hydrateFromRedirect or authenticate to respect the
      // host application's initialization flow.
    } catch (error) {
      console.error('MSAL initialization failed:', error);
      throw error;
    }
  }

  async hydrateFromRedirect() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const res = await this.msal.handleRedirectPromise();
    if (res && res.account) this.account = res.account;
    if (!this.account) {
      const accounts = this.msal.getAllAccounts();
      this.account = accounts[0] ?? null;
    }
  }

  isAuthenticated() {
    return !!this.account;
  }

  getAccount() {
    return this.account;
  }

  /**
   * @param {string[]} [scopes]
   */
  async authenticate(scopes) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const eff = scopes && scopes.length ? scopes : this.defaultScopes;
    console.log('Authenticating with scopes:', eff);

    // For SPA applications, try to acquire token silently first
    if (this.account) {
      try {
        console.log('Attempting silent token acquisition for existing account');
        const req = { account: this.account, scopes: eff };
        return await this.msal.acquireTokenSilent(req);
      } catch (silentError) {
        console.warn('Silent token acquisition failed:', silentError);
        // Fall through to interactive login
      }
    }

    console.log('No account found or silent acquisition failed, initiating login');
    const req = this.loginHint ? { scopes: eff, loginHint: this.loginHint } : { scopes: eff };
    const res = this.interactionType === 'redirect'
      ? await this.loginRedirectThenAwait(req)
      : await this.msal.loginPopup(req);
    this.account = res.account ?? null;
    console.log('Login completed, account:', this.account ? this.account.username : undefined);

    return res;
  }

  /**
   * @param {string[]} [scopes]
   */
  async getAccessToken(scopes) {
    const res = await this.authenticate(scopes);
    return res.accessToken;
  }

  async logout() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.interactionType === 'redirect') {
      await this.msal.logoutRedirect({ account: this.account ?? undefined });
    } else {
      await this.msal.logoutPopup({ account: this.account ?? undefined });
    }
    this.account = null;
  }

  /**
   * @param {string[]} scopes
   */
  async acquireTokenSilentWithFallback(scopes) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const req = { account: this.account ?? undefined, scopes };
    try {
      console.log('Attempting silent token acquisition for scopes:', scopes);
      const result = await this.msal.acquireTokenSilent(req);
      console.log('Silent token acquisition successful');
      return result;
    } catch (error) {
      console.warn('Silent token acquisition failed, falling back to interactive:', error);
      const interactive = this.loginHint ? { scopes, loginHint: this.loginHint } : { scopes };
      return this.interactionType === 'redirect'
        ? this.loginRedirectThenAwait(interactive, true)
        : this.msal.acquireTokenPopup(interactive);
    }
  }

  async loginRedirectThenAwait(req, isAcquire = false) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (isAcquire) {
      await this.msal.acquireTokenRedirect(req);
    } else {
      await this.msal.loginRedirect(req);
    }
    const res = await this.msal.handleRedirectPromise();
    if (!res) throw new Error('Redirect initiated. Call hydrateFromRedirect() on startup.');
    return res;
  }
}

module.exports = {
  BrowserAuthClient
};

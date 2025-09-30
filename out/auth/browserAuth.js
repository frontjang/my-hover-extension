"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserAuthClient = void 0;
const msal_browser_1 = require("@azure/msal-browser");
class BrowserAuthClient {
    constructor(cfg) {
        this.account = null;
        this.isInitialized = false;
        const authority = cfg.authority ?? `https://login.microsoftonline.com/${cfg.tenantId}/v2.0`;
        const config = {
            auth: {
                clientId: cfg.clientId,
                authority,
                redirectUri: cfg.redirectUri,
                postLogoutRedirectUri: cfg.postLogoutRedirectUri,
                navigateToLoginRequestUrl: false,
            },
            cache: {
                cacheLocation: cfg.cacheLocation ?? "sessionStorage",
                storeAuthStateInCookie: false,
            },
            system: {
                allowRedirectInIframe: true,
                iframeHashTimeout: 10000,
            },
        };
        this.msal = new msal_browser_1.PublicClientApplication(config);
        this.defaultScopes = cfg.defaultScopes ?? [];
        this.interactionType = cfg.interactionType ?? "popup";
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            await this.msal.initialize();
            this.isInitialized = true;
            const accounts = this.msal.getAllAccounts();
            this.account = accounts[0] ?? null;
        }
        catch (error) {
            console.error("MSAL initialization failed:", error);
            throw error;
        }
    }
    async hydrateFromRedirect() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const res = await this.msal.handleRedirectPromise();
        if (res?.account) {
            this.account = res.account;
        }
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
    async authenticate(scopes) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const effectiveScopes = scopes?.length ? scopes : this.defaultScopes;
        if (this.account) {
            try {
                const req = { account: this.account, scopes: effectiveScopes };
                return await this.msal.acquireTokenSilent(req);
            }
            catch (silentError) {
                console.warn("Silent token acquisition failed:", silentError);
            }
        }
        const req = { scopes: effectiveScopes };
        const res = this.interactionType === "redirect"
            ? await this.loginRedirectThenAwait(req)
            : await this.msal.loginPopup(req);
        this.account = res.account ?? null;
        return res;
    }
    async getAccessToken(scopes) {
        const res = await this.authenticate(scopes);
        return res.accessToken;
    }
    async logout() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (this.interactionType === "redirect") {
            await this.msal.logoutRedirect();
        }
        else {
            await this.msal.logoutPopup();
        }
        this.account = null;
    }
    async loginRedirectThenAwait(req, isAcquire = false) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (isAcquire) {
            await this.msal.acquireTokenRedirect(req);
        }
        else {
            await this.msal.loginRedirect(req);
        }
        const res = await this.msal.handleRedirectPromise();
        if (!res) {
            throw new Error("Redirect initiated. Call hydrateFromRedirect() on startup.");
        }
        return res;
    }
}
exports.BrowserAuthClient = BrowserAuthClient;
//# sourceMappingURL=browserAuth.js.map
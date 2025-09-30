"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserAuthClient = void 0;
const msal_browser_1 = require("@azure/msal-browser");
const customAiDebug_1 = require("./customAiDebug");
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
        (0, customAiDebug_1.logCustomAIDebug)("Initialized BrowserAuthClient", {
            authority: authority.replace(/\/+$/, ""),
            redirectUri: cfg.redirectUri,
            cacheLocation: config.cache.cacheLocation,
            defaultScopes: this.defaultScopes,
            interactionType: this.interactionType,
        });
    }
    async initialize() {
        if (this.isInitialized) {
            (0, customAiDebug_1.logCustomAIDebug)("BrowserAuthClient already initialized");
            return;
        }
        try {
            (0, customAiDebug_1.logCustomAIDebug)("Initializing MSAL PublicClientApplication");
            await this.msal.initialize();
            this.isInitialized = true;
            const accounts = this.msal.getAllAccounts();
            this.account = accounts[0] ?? null;
            (0, customAiDebug_1.logCustomAIDebug)("MSAL initialization complete", {
                accountCount: accounts.length,
                authenticatedUser: this.account?.username,
            });
        }
        catch (error) {
            (0, customAiDebug_1.logCustomAIWarning)("MSAL initialization failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async hydrateFromRedirect() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        (0, customAiDebug_1.logCustomAIDebug)("Hydrating CustomAI auth from redirect");
        const res = await this.msal.handleRedirectPromise();
        if (res?.account) {
            this.account = res.account;
            (0, customAiDebug_1.logCustomAIDebug)("Redirect hydration found account", {
                username: this.account.username,
            });
        }
        if (!this.account) {
            const accounts = this.msal.getAllAccounts();
            this.account = accounts[0] ?? null;
            (0, customAiDebug_1.logCustomAIDebug)("Fallback account lookup after redirect", {
                accountCount: accounts.length,
                username: this.account?.username,
            });
        }
    }
    isAuthenticated() {
        (0, customAiDebug_1.logCustomAIDebug)("Checking CustomAI authentication state", {
            isAuthenticated: !!this.account,
        });
        return !!this.account;
    }
    getAccount() {
        (0, customAiDebug_1.logCustomAIDebug)("Retrieving CustomAI account details", {
            username: this.account?.username,
        });
        return this.account;
    }
    async authenticate(scopes) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const effectiveScopes = scopes?.length ? scopes : this.defaultScopes;
        (0, customAiDebug_1.logCustomAIDebug)("Authenticating with CustomAI", {
            scopes: effectiveScopes,
            hasCachedAccount: !!this.account,
            interactionType: this.interactionType,
        });
        if (this.account) {
            try {
                const req = { account: this.account, scopes: effectiveScopes };
                const silentResult = await this.msal.acquireTokenSilent(req);
                (0, customAiDebug_1.logCustomAIDebug)("Silent token acquisition succeeded", {
                    username: silentResult.account?.username,
                    expiresOn: silentResult.expiresOn?.toISOString(),
                });
                return silentResult;
            }
            catch (silentError) {
                (0, customAiDebug_1.logCustomAIWarning)("Silent token acquisition failed", {
                    error: silentError instanceof Error ? silentError.message : String(silentError),
                });
            }
        }
        const req = { scopes: effectiveScopes };
        let res;
        if (this.interactionType === "redirect") {
            (0, customAiDebug_1.logCustomAIDebug)("Starting redirect-based CustomAI authentication");
            res = await this.loginRedirectThenAwait(req);
        }
        else {
            (0, customAiDebug_1.logCustomAIDebug)("Starting popup-based CustomAI authentication");
            res = await this.msal.loginPopup(req);
        }
        this.account = res.account ?? null;
        (0, customAiDebug_1.logCustomAIDebug)("Interactive CustomAI authentication completed", {
            username: this.account?.username,
            hasAccount: !!this.account,
        });
        return res;
    }
    async getAccessToken(scopes) {
        (0, customAiDebug_1.logCustomAIDebug)("Requesting CustomAI access token", {
            scopes: scopes ?? this.defaultScopes,
        });
        const res = await this.authenticate(scopes);
        (0, customAiDebug_1.logCustomAIDebug)("Access token retrieved for CustomAI", {
            hasToken: !!res.accessToken,
            expiresOn: res.expiresOn?.toISOString(),
        });
        return res.accessToken;
    }
    async logout() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        (0, customAiDebug_1.logCustomAIDebug)("Logging out of CustomAI");
        if (this.interactionType === "redirect") {
            await this.msal.logoutRedirect();
        }
        else {
            await this.msal.logoutPopup();
        }
        this.account = null;
        (0, customAiDebug_1.logCustomAIDebug)("CustomAI logout completed");
    }
    async loginRedirectThenAwait(req, isAcquire = false) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (isAcquire) {
            (0, customAiDebug_1.logCustomAIDebug)("Acquiring token via redirect flow");
            await this.msal.acquireTokenRedirect(req);
        }
        else {
            (0, customAiDebug_1.logCustomAIDebug)("Initiating login redirect flow");
            await this.msal.loginRedirect(req);
        }
        const res = await this.msal.handleRedirectPromise();
        if (!res) {
            throw new Error("Redirect initiated. Call hydrateFromRedirect() on startup.");
        }
        (0, customAiDebug_1.logCustomAIDebug)("Redirect flow returned authentication result", {
            username: res.account?.username,
        });
        return res;
    }
}
exports.BrowserAuthClient = BrowserAuthClient;
//# sourceMappingURL=browserAuth.js.map
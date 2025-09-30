"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomAIBrowser = exports._shimInitialized = void 0;
const CustomAI_1 = require("./CustomAI");
const browserAuth_1 = require("./browserAuth");
const browser_shim_1 = require("../browser-shim");
const env_1 = require("../config/env");
const customEnv_1 = require("./customEnv");
const customAiDebug_1 = require("./customAiDebug");
var browser_shim_2 = require("../browser-shim");
Object.defineProperty(exports, "_shimInitialized", { enumerable: true, get: function () { return browser_shim_2._shimInitialized; } });
class CustomAIBrowser extends CustomAI_1.CustomAI {
    constructor(...args) {
        super(...args);
        const globalRef = typeof globalThis === "object" ? globalThis : {};
        const browserWindow = globalRef.window;
        const origin = browserWindow?.location?.origin ?? "";
        const redirectUri = (0, env_1.getEnvVar)("CUSTOM_REDIRECT_URI") ?? "http://localhost:3000/auth/callback";
        const defaultScope = CustomAI_1.CustomAI.defaultScope;
        (0, customAiDebug_1.logCustomAIDebug)("Initializing CustomAIBrowser", {
            origin,
            redirectUri,
            hasDefaultScope: !!defaultScope,
        });
        this.browserAuth = new browserAuth_1.BrowserAuthClient({
            clientId: (0, env_1.requireEnvVar)("CUSTOM_CLIENT_ID"),
            tenantId: (0, env_1.requireEnvVar)("CUSTOM_TENANT_ID"),
            authority: (0, env_1.getEnvVar)("CUSTOM_AUTHORITY"),
            redirectUri,
            postLogoutRedirectUri: origin ? `${origin}/` : undefined,
            cacheLocation: "sessionStorage",
            defaultScopes: defaultScope ? [defaultScope] : [],
            interactionType: "popup",
        });
    }
    async customaiHydrateFromRedirect() {
        (0, customAiDebug_1.logCustomAIDebug)("Hydrating CustomAIBrowser from redirect");
        await this.browserAuth.hydrateFromRedirect();
        if (this.browserAuth.isAuthenticated()) {
            const scopes = CustomAI_1.CustomAI.defaultScope ? [CustomAI_1.CustomAI.defaultScope] : undefined;
            if (scopes) {
                (0, customAiDebug_1.logCustomAIDebug)("CustomAIBrowser detected authenticated session after redirect", {
                    scopes,
                });
                const accessToken = await this.browserAuth.getAccessToken(scopes);
                this.setAzureAuthToken(accessToken);
            }
        }
    }
    async customaiAuthenticateInBrowser(scopes = [CustomAI_1.CustomAI.defaultScope]) {
        const filteredScopes = scopes.filter((scope) => !!scope);
        if (filteredScopes.length === 0) {
            throw new Error("At least one scope must be provided for browser authentication.");
        }
        if (!browser_shim_1._shimInitialized) {
            const authDetails = (0, customEnv_1.buildCustomAIAuthorizationUrl)();
            if (authDetails.url) {
                try {
                    const parsed = new URL(authDetails.url);
                    (0, customAiDebug_1.logCustomAIWarning)("Browser shim is not initialized; authentication must occur in an external window.", {
                        host: parsed.origin,
                        path: parsed.pathname,
                    });
                }
                catch (error) {
                    (0, customAiDebug_1.logCustomAIWarning)("Browser shim is not initialized; authentication must occur in an external window.", {
                        url: authDetails.url,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
            else {
                (0, customAiDebug_1.logCustomAIWarning)("Browser shim is not initialized and CustomAI auth URL could not be constructed.", {
                    missing: authDetails.missing,
                });
            }
        }
        (0, customAiDebug_1.logCustomAIDebug)("Starting CustomAIBrowser interactive authentication", {
            scopes: filteredScopes,
        });
        const accessToken = await this.browserAuth.getAccessToken(filteredScopes);
        this.setAzureAuthToken(accessToken);
        (0, customAiDebug_1.logCustomAIDebug)("CustomAIBrowser authentication complete", {
            receivedToken: !!accessToken,
            tokenLength: accessToken.length,
        });
    }
    customaiIsAuthenticated() {
        const authenticated = this.browserAuth.isAuthenticated();
        (0, customAiDebug_1.logCustomAIDebug)("CustomAIBrowser authentication status queried", {
            authenticated,
        });
        return authenticated;
    }
    customaiAuthenticatedUser() {
        const username = this.browserAuth.getAccount()?.username ?? "Unknown";
        (0, customAiDebug_1.logCustomAIDebug)("CustomAIBrowser resolved authenticated user", { username });
        return username;
    }
    async customaiLogout() {
        (0, customAiDebug_1.logCustomAIDebug)("CustomAIBrowser logout requested");
        await this.browserAuth.logout();
        this.setAzureAuthToken("");
        (0, customAiDebug_1.logCustomAIDebug)("CustomAIBrowser logout complete");
    }
}
exports.CustomAIBrowser = CustomAIBrowser;
exports.default = CustomAIBrowser;
//# sourceMappingURL=index.browser.js.map
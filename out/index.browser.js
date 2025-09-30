"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomAIBrowser = exports._shimInitialized = void 0;
const CustomAI_1 = require("./CustomAI");
const browserAuth_1 = require("./auth/browserAuth");
const env_1 = require("./config/env");
var browser_shim_1 = require("./browser-shim");
Object.defineProperty(exports, "_shimInitialized", { enumerable: true, get: function () { return browser_shim_1._shimInitialized; } });
class CustomAIBrowser extends CustomAI_1.CustomAI {
    constructor(...args) {
        super(...args);
        const globalRef = typeof globalThis === "object" ? globalThis : {};
        const browserWindow = globalRef.window;
        const origin = browserWindow?.location?.origin ?? "";
        const redirectUri = (0, env_1.getEnvVar)("CUSTOM_REDIRECT_URI") ?? "http://localhost:3000/auth/callback";
        const defaultScope = CustomAI_1.CustomAI.defaultScope;
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
        await this.browserAuth.hydrateFromRedirect();
        if (this.browserAuth.isAuthenticated()) {
            const scopes = CustomAI_1.CustomAI.defaultScope ? [CustomAI_1.CustomAI.defaultScope] : undefined;
            if (scopes) {
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
        const accessToken = await this.browserAuth.getAccessToken(filteredScopes);
        this.setAzureAuthToken(accessToken);
    }
    customaiIsAuthenticated() {
        return this.browserAuth.isAuthenticated();
    }
    customaiAuthenticatedUser() {
        return this.browserAuth.getAccount()?.username ?? "Unknown";
    }
    async customaiLogout() {
        await this.browserAuth.logout();
        this.setAzureAuthToken("");
    }
}
exports.CustomAIBrowser = CustomAIBrowser;
exports.default = CustomAIBrowser;
//# sourceMappingURL=index.browser.js.map
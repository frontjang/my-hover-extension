"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicClientApplication = void 0;
const node_buffer_1 = require("node:buffer");
const memoryStorage = new Map();
const getStorage = (location) => {
    const globalRef = typeof globalThis === "object" ? globalThis : {};
    const browserWindow = globalRef.window;
    if (!browserWindow) {
        return memoryStorage;
    }
    if (location === "localStorage" && browserWindow.localStorage) {
        return browserWindow.localStorage;
    }
    if (location === "sessionStorage" && browserWindow.sessionStorage) {
        return browserWindow.sessionStorage;
    }
    return memoryStorage;
};
const tokenKey = (clientId) => `msal_token_${clientId}`;
const accountKey = (clientId) => `msal_account_${clientId}`;
const parseAccount = (raw) => {
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
};
const serializeToken = (token) => JSON.stringify({
    ...token,
    expiresOn: token.expiresOn?.toISOString(),
});
const parseToken = (raw) => {
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed.expiresOn && typeof parsed.expiresOn === "string") {
            parsed.expiresOn = new Date(parsed.expiresOn);
        }
        return parsed;
    }
    catch {
        return null;
    }
};
const generateToken = (clientId, scopes) => {
    const payload = {
        clientId,
        scopes: scopes ?? [],
        issuedAt: Date.now(),
    };
    return node_buffer_1.Buffer.from(JSON.stringify(payload)).toString("base64url");
};
class PublicClientApplication {
    constructor(configuration) {
        this.configuration = configuration;
        const store = getStorage(configuration.cache?.cacheLocation ?? "sessionStorage");
        this.storage = store;
        const accountRaw = store instanceof Map
            ? store.get(accountKey(configuration.auth.clientId)) ?? null
            : store.getItem(accountKey(configuration.auth.clientId));
        const tokenRaw = store instanceof Map
            ? store.get(tokenKey(configuration.auth.clientId)) ?? null
            : store.getItem(tokenKey(configuration.auth.clientId));
        this.account = parseAccount(accountRaw);
        this.token = parseToken(tokenRaw);
    }
    async initialize() {
        // No asynchronous setup required for the shim.
    }
    getAllAccounts() {
        return this.account ? [this.account] : [];
    }
    async handleRedirectPromise() {
        // Redirect flows are not simulated in the shim. Return the stored token if available.
        return this.token;
    }
    async loginPopup(request) {
        const account = {
            username: request.loginHint ?? this.account?.username ?? "customai-user",
        };
        const token = {
            accessToken: generateToken(this.configuration.auth.clientId, request.scopes),
            account,
            expiresOn: new Date(Date.now() + 60 * 60 * 1000),
        };
        this.persist(account, token);
        return token;
    }
    async loginRedirect(request) {
        const account = {
            username: request.loginHint ?? this.account?.username ?? "customai-user",
        };
        const token = {
            accessToken: generateToken(this.configuration.auth.clientId, request.scopes),
            account,
            expiresOn: new Date(Date.now() + 60 * 60 * 1000),
        };
        this.persist(account, token);
    }
    async acquireTokenSilent(request) {
        if (this.token && this.token.expiresOn && this.token.expiresOn.getTime() > Date.now()) {
            return this.token;
        }
        if (!this.account) {
            throw new Error("No cached account is available for silent token acquisition.");
        }
        const token = {
            accessToken: generateToken(this.configuration.auth.clientId, request.scopes),
            account: this.account,
            expiresOn: new Date(Date.now() + 60 * 60 * 1000),
        };
        this.persist(this.account, token);
        return token;
    }
    async acquireTokenPopup(request) {
        return this.loginPopup(request);
    }
    async acquireTokenRedirect(request) {
        await this.loginRedirect(request);
    }
    async logoutPopup() {
        this.persist(null, null);
    }
    async logoutRedirect() {
        this.persist(null, null);
    }
    persist(account, token) {
        const clientId = this.configuration.auth.clientId;
        if (this.storage instanceof Map) {
            if (account) {
                this.storage.set(accountKey(clientId), JSON.stringify(account));
            }
            else {
                this.storage.delete(accountKey(clientId));
            }
            if (token) {
                this.storage.set(tokenKey(clientId), serializeToken(token));
            }
            else {
                this.storage.delete(tokenKey(clientId));
            }
        }
        else {
            if (account) {
                this.storage.setItem(accountKey(clientId), JSON.stringify(account));
            }
            else {
                this.storage.removeItem(accountKey(clientId));
            }
            if (token) {
                this.storage.setItem(tokenKey(clientId), serializeToken(token));
            }
            else {
                this.storage.removeItem(tokenKey(clientId));
            }
        }
        this.account = account;
        this.token = token;
    }
}
exports.PublicClientApplication = PublicClientApplication;
//# sourceMappingURL=msal-browser.js.map
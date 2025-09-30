import { Buffer } from "node:buffer";

export type CacheLocation = "localStorage" | "sessionStorage" | "memoryStorage";

export interface AccountInfo {
  username?: string;
  [key: string]: unknown;
}

export interface AuthenticationResult {
  accessToken: string;
  account?: AccountInfo | null;
  expiresOn?: Date;
  [key: string]: unknown;
}

export interface SilentRequest {
  account?: AccountInfo | null;
  scopes?: string[];
}

export interface PopupRequest {
  scopes?: string[];
  loginHint?: string;
}

export interface RedirectRequest {
  scopes?: string[];
  loginHint?: string;
}

export interface Configuration {
  auth: {
    clientId: string;
    authority?: string;
    redirectUri: string;
    postLogoutRedirectUri?: string;
    navigateToLoginRequestUrl?: boolean;
  };
  cache?: {
    cacheLocation?: CacheLocation;
    storeAuthStateInCookie?: boolean;
  };
  system?: {
    allowRedirectInIframe?: boolean;
    iframeHashTimeout?: number;
  };
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const memoryStorage = new Map<string, string>();

const getStorage = (location: CacheLocation | undefined): StorageLike | Map<string, string> => {
  const globalRef = typeof globalThis === "object" ? (globalThis as Record<string, unknown>) : {};
  const browserWindow = globalRef.window as
    | { localStorage?: StorageLike; sessionStorage?: StorageLike }
    | undefined;

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

const tokenKey = (clientId: string) => `msal_token_${clientId}`;
const accountKey = (clientId: string) => `msal_account_${clientId}`;

const parseAccount = (raw: string | null): AccountInfo | null => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AccountInfo;
  } catch {
    return null;
  }
};

const serializeToken = (token: AuthenticationResult): string =>
  JSON.stringify({
    ...token,
    expiresOn: token.expiresOn?.toISOString(),
  });

const parseToken = (raw: string | null): AuthenticationResult | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthenticationResult;
    if (parsed.expiresOn && typeof parsed.expiresOn === "string") {
      parsed.expiresOn = new Date(parsed.expiresOn);
    }
    return parsed;
  } catch {
    return null;
  }
};

const generateToken = (clientId: string, scopes?: string[]) => {
  const payload = {
    clientId,
    scopes: scopes ?? [],
    issuedAt: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
};

export class PublicClientApplication {
  private account: AccountInfo | null;
  private token: AuthenticationResult | null;
  private readonly storage: StorageLike | Map<string, string>;

  constructor(private readonly configuration: Configuration) {
    const store = getStorage(configuration.cache?.cacheLocation ?? "sessionStorage");
    this.storage = store;
    const accountRaw =
      store instanceof Map
        ? store.get(accountKey(configuration.auth.clientId)) ?? null
        : store.getItem(accountKey(configuration.auth.clientId));
    const tokenRaw =
      store instanceof Map
        ? store.get(tokenKey(configuration.auth.clientId)) ?? null
        : store.getItem(tokenKey(configuration.auth.clientId));
    this.account = parseAccount(accountRaw);
    this.token = parseToken(tokenRaw);
  }

  async initialize(): Promise<void> {
    // No asynchronous setup required for the shim.
  }

  getAllAccounts(): AccountInfo[] {
    return this.account ? [this.account] : [];
  }

  async handleRedirectPromise(): Promise<AuthenticationResult | null> {
    // Redirect flows are not simulated in the shim. Return the stored token if available.
    return this.token;
  }

  async loginPopup(request: PopupRequest): Promise<AuthenticationResult> {
    const account: AccountInfo = {
      username: request.loginHint ?? this.account?.username ?? "customai-user",
    };
    const token: AuthenticationResult = {
      accessToken: generateToken(this.configuration.auth.clientId, request.scopes),
      account,
      expiresOn: new Date(Date.now() + 60 * 60 * 1000),
    };
    this.persist(account, token);
    return token;
  }

  async loginRedirect(request: RedirectRequest): Promise<void> {
    const account: AccountInfo = {
      username: request.loginHint ?? this.account?.username ?? "customai-user",
    };
    const token: AuthenticationResult = {
      accessToken: generateToken(this.configuration.auth.clientId, request.scopes),
      account,
      expiresOn: new Date(Date.now() + 60 * 60 * 1000),
    };
    this.persist(account, token);
  }

  async acquireTokenSilent(request: SilentRequest): Promise<AuthenticationResult> {
    if (this.token && this.token.expiresOn && this.token.expiresOn.getTime() > Date.now()) {
      return this.token;
    }

    if (!this.account) {
      throw new Error("No cached account is available for silent token acquisition.");
    }

    const token: AuthenticationResult = {
      accessToken: generateToken(this.configuration.auth.clientId, request.scopes),
      account: this.account,
      expiresOn: new Date(Date.now() + 60 * 60 * 1000),
    };
    this.persist(this.account, token);
    return token;
  }

  async acquireTokenPopup(request: PopupRequest): Promise<AuthenticationResult> {
    return this.loginPopup(request);
  }

  async acquireTokenRedirect(request: RedirectRequest): Promise<void> {
    await this.loginRedirect(request);
  }

  async logoutPopup(): Promise<void> {
    this.persist(null, null);
  }

  async logoutRedirect(): Promise<void> {
    this.persist(null, null);
  }

  private persist(account: AccountInfo | null, token: AuthenticationResult | null) {
    const clientId = this.configuration.auth.clientId;
    if (this.storage instanceof Map) {
      if (account) {
        this.storage.set(accountKey(clientId), JSON.stringify(account));
      } else {
        this.storage.delete(accountKey(clientId));
      }

      if (token) {
        this.storage.set(tokenKey(clientId), serializeToken(token));
      } else {
        this.storage.delete(tokenKey(clientId));
      }
    } else {
      if (account) {
        this.storage.setItem(accountKey(clientId), JSON.stringify(account));
      } else {
        this.storage.removeItem(accountKey(clientId));
      }

      if (token) {
        this.storage.setItem(tokenKey(clientId), serializeToken(token));
      } else {
        this.storage.removeItem(tokenKey(clientId));
      }
    }

    this.account = account;
    this.token = token;
  }
}

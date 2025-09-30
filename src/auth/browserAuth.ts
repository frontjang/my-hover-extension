import { PublicClientApplication } from "@azure/msal-browser";
import type {
  PopupRequest,
  RedirectRequest,
  SilentRequest,
  Configuration,
} from "@azure/msal-browser";
import type { AccountInfo, AuthenticationResult } from "@azure/msal-browser";

export type InteractionType = "popup" | "redirect";

export interface BrowserAuthConfig {
  clientId: string;
  tenantId: string;
  authority?: string;
  redirectUri: string;
  postLogoutRedirectUri?: string;
  cacheLocation?: "localStorage" | "sessionStorage" | "memoryStorage";
  defaultScopes?: string[];
  interactionType?: InteractionType;
  loginHint?: string;
}

export class BrowserAuthClient {
  private readonly msal: PublicClientApplication;
  private account: AccountInfo | null = null;
  private readonly defaultScopes: string[];
  private readonly interactionType: InteractionType;
  private isInitialized = false;

  constructor(cfg: BrowserAuthConfig) {
    const authority = cfg.authority ?? `https://login.microsoftonline.com/${cfg.tenantId}/v2.0`;
    const config: Configuration = {
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

    this.msal = new PublicClientApplication(config);
    this.defaultScopes = cfg.defaultScopes ?? [];
    this.interactionType = cfg.interactionType ?? "popup";
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.msal.initialize();
      this.isInitialized = true;
      const accounts = this.msal.getAllAccounts();
      this.account = accounts[0] ?? null;
    } catch (error) {
      console.error("MSAL initialization failed:", error);
      throw error;
    }
  }

  async hydrateFromRedirect(): Promise<void> {
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

  isAuthenticated(): boolean {
    return !!this.account;
  }

  getAccount(): AccountInfo | null {
    return this.account;
  }

  async authenticate(scopes?: string[]): Promise<AuthenticationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const effectiveScopes = scopes?.length ? scopes : this.defaultScopes;

    if (this.account) {
      try {
        const req: SilentRequest = { account: this.account, scopes: effectiveScopes };
        return await this.msal.acquireTokenSilent(req);
      } catch (silentError) {
        console.warn("Silent token acquisition failed:", silentError);
      }
    }

    const req: PopupRequest & RedirectRequest = { scopes: effectiveScopes };
    const res =
      this.interactionType === "redirect"
        ? await this.loginRedirectThenAwait(req)
        : await this.msal.loginPopup(req);
    this.account = res.account ?? null;
    return res;
  }

  async getAccessToken(scopes?: string[]): Promise<string> {
    const res = await this.authenticate(scopes);
    return res.accessToken;
  }

  async logout(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.interactionType === "redirect") {
      await this.msal.logoutRedirect();
    } else {
      await this.msal.logoutPopup();
    }
    this.account = null;
  }

  private async loginRedirectThenAwait(req: RedirectRequest, isAcquire = false) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (isAcquire) {
      await this.msal.acquireTokenRedirect(req);
    } else {
      await this.msal.loginRedirect(req);
    }
    const res = await this.msal.handleRedirectPromise();
    if (!res) {
      throw new Error("Redirect initiated. Call hydrateFromRedirect() on startup.");
    }
    return res;
  }
}

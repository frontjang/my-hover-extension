import { CustomAI } from "./CustomAI";
import { BrowserAuthClient } from "./auth/browserAuth";
import { _shimInitialized } from "./browser-shim";
import { getEnvVar, requireEnvVar } from "./config/env";

export { type CustomAIModel } from "./model";
export { _shimInitialized } from "./browser-shim";

export class CustomAIBrowser extends CustomAI {
  private readonly browserAuth: BrowserAuthClient;

  constructor(...args: ConstructorParameters<typeof CustomAI>) {
    super(...args);
    const globalRef = typeof globalThis === "object" ? (globalThis as Record<string, unknown>) : {};
    const browserWindow = globalRef.window as { location: { origin: string } } | undefined;
    const origin = browserWindow?.location?.origin ?? "";
    const redirectUri =
      getEnvVar("CUSTOM_REDIRECT_URI") ?? "http://localhost:3000/auth/callback";

    const defaultScope = CustomAI.defaultScope;

    this.browserAuth = new BrowserAuthClient({
      clientId: requireEnvVar("CUSTOM_CLIENT_ID"),
      tenantId: requireEnvVar("CUSTOM_TENANT_ID"),
      authority: getEnvVar("CUSTOM_AUTHORITY"),
      redirectUri,
      postLogoutRedirectUri: origin ? `${origin}/` : undefined,
      cacheLocation: "sessionStorage",
      defaultScopes: defaultScope ? [defaultScope] : [],
      interactionType: "popup",
    });
  }

  async customaiHydrateFromRedirect(): Promise<void> {
    await this.browserAuth.hydrateFromRedirect();
    if (this.browserAuth.isAuthenticated()) {
      const scopes = CustomAI.defaultScope ? [CustomAI.defaultScope] : undefined;
      if (scopes) {
        const accessToken = await this.browserAuth.getAccessToken(scopes);
        this.setAzureAuthToken(accessToken);
      }
    }
  }

  async customaiAuthenticateInBrowser(scopes = [CustomAI.defaultScope]): Promise<void> {
    const filteredScopes = scopes.filter((scope): scope is string => !!scope);
    if (filteredScopes.length === 0) {
      throw new Error("At least one scope must be provided for browser authentication.");
    }
    const accessToken = await this.browserAuth.getAccessToken(filteredScopes);
    this.setAzureAuthToken(accessToken);
  }

  customaiIsAuthenticated(): boolean {
    return this.browserAuth.isAuthenticated();
  }

  customaiAuthenticatedUser(): string {
    return this.browserAuth.getAccount()?.username ?? "Unknown";
  }

  async customaiLogout(): Promise<void> {
    await this.browserAuth.logout();
    this.setAzureAuthToken("");
  }
}

export default CustomAIBrowser;

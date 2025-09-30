import { CustomAI } from "./CustomAI";
import { BrowserAuthClient } from "./browserAuth";
import { _shimInitialized } from "../browser-shim";
import { getEnvVar, requireEnvVar } from "../config/env";
import { buildCustomAIAuthorizationUrl } from "./customEnv";
import { logCustomAIDebug, logCustomAIWarning } from "./customAiDebug";

export { type CustomAIModel } from "../model";
export { _shimInitialized } from "../browser-shim";

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

    logCustomAIDebug("Initializing CustomAIBrowser", {
      origin,
      redirectUri,
      hasDefaultScope: !!defaultScope,
    });

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
    logCustomAIDebug("Hydrating CustomAIBrowser from redirect");
    await this.browserAuth.hydrateFromRedirect();
    if (this.browserAuth.isAuthenticated()) {
      const scopes = CustomAI.defaultScope ? [CustomAI.defaultScope] : undefined;
      if (scopes) {
        logCustomAIDebug("CustomAIBrowser detected authenticated session after redirect", {
          scopes,
        });
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
    if (!_shimInitialized) {
      const authDetails = buildCustomAIAuthorizationUrl();
      if (authDetails.url) {
        try {
          const parsed = new URL(authDetails.url);
          logCustomAIWarning(
            "Browser shim is not initialized; authentication must occur in an external window.",
            {
              host: parsed.origin,
              path: parsed.pathname,
            }
          );
        } catch (error) {
          logCustomAIWarning(
            "Browser shim is not initialized; authentication must occur in an external window.",
            {
              url: authDetails.url,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      } else {
        logCustomAIWarning(
          "Browser shim is not initialized and CustomAI auth URL could not be constructed.",
          {
            missing: authDetails.missing,
          }
        );
      }
    }
    logCustomAIDebug("Starting CustomAIBrowser interactive authentication", {
      scopes: filteredScopes,
    });
    const accessToken = await this.browserAuth.getAccessToken(filteredScopes);
    this.setAzureAuthToken(accessToken);
    logCustomAIDebug("CustomAIBrowser authentication complete", {
      receivedToken: !!accessToken,
      tokenLength: accessToken.length,
    });
  }

  customaiIsAuthenticated(): boolean {
    const authenticated = this.browserAuth.isAuthenticated();
    logCustomAIDebug("CustomAIBrowser authentication status queried", {
      authenticated,
    });
    return authenticated;
  }

  customaiAuthenticatedUser(): string {
    const username = this.browserAuth.getAccount()?.username ?? "Unknown";
    logCustomAIDebug("CustomAIBrowser resolved authenticated user", { username });
    return username;
  }

  async customaiLogout(): Promise<void> {
    logCustomAIDebug("CustomAIBrowser logout requested");
    await this.browserAuth.logout();
    this.setAzureAuthToken("");
    logCustomAIDebug("CustomAIBrowser logout complete");
  }

  async ericaiHydrateFromRedirect(): Promise<void> {
    logCustomAIDebug("Legacy EricAI hydrate invoked");
    await this.customaiHydrateFromRedirect();
  }

  async ericaiAuthenticateInBrowser(scopes?: Array<string | undefined>): Promise<void> {
    logCustomAIDebug("Legacy EricAI authenticate invoked", { scopes });
    if (!scopes) {
      await this.customaiAuthenticateInBrowser();
      return;
    }
    const filteredScopes = scopes.filter((scope): scope is string => !!scope);
    await this.customaiAuthenticateInBrowser(filteredScopes.length ? filteredScopes : undefined);
  }

  ericaiIsAuthenticated(): boolean {
    logCustomAIDebug("Legacy EricAI auth status check");
    return this.customaiIsAuthenticated();
  }

  ericaiAuthenticatedUser(): string {
    logCustomAIDebug("Legacy EricAI user lookup");
    return this.customaiAuthenticatedUser();
  }

  async ericaiLogout(): Promise<void> {
    logCustomAIDebug("Legacy EricAI logout invoked");
    await this.customaiLogout();
  }
}

export { CustomAIBrowser as EricAIBrowser };
export const EricAI: typeof CustomAIBrowser = CustomAIBrowser;

export default CustomAIBrowser;

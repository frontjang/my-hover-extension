import OpenAI from "openai";
import type { Buffer } from "node:buffer";
import type { ClientOptions } from "openai";
import type { FinalRequestOptions } from "openai/core";

import { CustomAIModels } from "../model";
import { getEnvVar, getEnvVarBoolean, getEnvVarNumber, requireEnvVar } from "../config/env";

export interface CustomAIOptions extends ClientOptions {
  disableSSLVerification?: boolean;
  caCertificates?: string | Buffer | Array<string | Buffer>;
  disableAutoCertLoading?: boolean;
}

export * from "../model";

export class CustomAI extends OpenAI {
  protected azureAuthToken: string | null = null;
  public static readonly defaultScope = requireEnvVar("CUSTOMAI_DEFAULT_SCOPE");

  public declare models: CustomAIModels;

  constructor(opts: CustomAIOptions = {}) {
    const globalRef = typeof globalThis === "object" ? (globalThis as Record<string, unknown>) : {};
    const isBrowser = typeof globalRef.window !== "undefined";
    const browserOptions = isBrowser
      ? {
          httpAgent: undefined,
          httpsAgent: undefined,
          fetch: typeof globalRef.fetch === "function" ? (globalRef.fetch as typeof fetch) : undefined,
        }
      : {};

    const apiKey = opts.apiKey ?? getEnvVar("CUSTOMAI_API_KEY", "customai_dummy");
    const timeout = opts.timeout ?? getEnvVarNumber("CUSTOMAI_TIMEOUT", 30000);
    const maxRetries = opts.maxRetries ?? getEnvVarNumber("CUSTOMAI_MAX_RETRIES", 3);
    const baseURL = opts.baseURL ?? getEnvVar("CUSTOMAI_BASE_URL");
    const dangerouslyAllowBrowser =
      opts.dangerouslyAllowBrowser ?? getEnvVarBoolean("CUSTOMAI_ALLOW_BROWSER", true);

    super({
      ...opts,
      ...browserOptions,
      apiKey,
      timeout,
      maxRetries,
      baseURL,
      dangerouslyAllowBrowser,
    });

    const baseModels = (this as OpenAI).models;

    Object.defineProperty(this, "models", {
      value: new CustomAIModels(baseModels),
      writable: false,
      configurable: false,
    });
  }

  setAzureAuthToken(token: string) {
    this.azureAuthToken = token;
  }

  protected override authHeaders(opts: FinalRequestOptions): Record<string, string | null | undefined> {
    if (this.azureAuthToken) {
      return { Authorization: `Bearer ${this.azureAuthToken}` };
    }
    return super.authHeaders(opts);
  }

  protected override defaultHeaders(opts: FinalRequestOptions): Record<string, string | null | undefined> {
    const headers = super.defaultHeaders(opts) as Record<string, string | null | undefined>;
    if (this.azureAuthToken) {
      delete headers["OpenAI-Organization"];
      delete headers["OpenAI-Project"];
    }
    return headers;
  }
}

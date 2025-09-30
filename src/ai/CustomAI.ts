import { readFileSync, existsSync } from "fs";
import { Agent as HttpsAgent } from "https";
import { resolve, delimiter } from "path";
import OpenAI from "openai";
import type { Buffer } from "node:buffer";
import type { ClientOptions } from "openai";
import type { FinalRequestOptions } from "openai/core";

import { CustomAIModels } from "../model";
import { getEnvVar, getEnvVarBoolean, getEnvVarNumber, requireEnvVar } from "../config/env";
import { logCustomAIDebug, logCustomAIWarning, redactSecret } from "./customAiDebug";

export interface CustomAIOptions extends ClientOptions {
  disableSSLVerification?: boolean;
  caCertificates?: string | Buffer | Array<string | Buffer>;
  disableAutoCertLoading?: boolean;
}

type CertificateInput = string | Buffer | Array<string | Buffer> | undefined;

interface CertificateLoadResult {
  certificates?: Array<string | Buffer>;
  fileCount: number;
  hadInlineCertificates: boolean;
}

const normalizeCertificateInput = (
  value: CertificateInput,
): Array<string | Buffer> | undefined => {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value : [value];
};

const loadCertificatesFromEnv = (): CertificateLoadResult => {
  const certificates: Array<string | Buffer> = [];
  const inlineCertificates = getEnvVar("CUSTOMAI_CA_BUNDLE");
  let hadInlineCertificates = false;

  if (inlineCertificates) {
    certificates.push(inlineCertificates);
    hadInlineCertificates = true;
  }

  const bundlePathRaw = getEnvVar("CUSTOMAI_CA_BUNDLE_PATH");
  let fileCount = 0;

  if (bundlePathRaw) {
    const segments = bundlePathRaw
      .split(delimiter)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    for (const segment of segments) {
      const resolvedPath = resolve(segment);
      if (!existsSync(resolvedPath)) {
        logCustomAIWarning("CustomAI CA bundle path does not exist", { path: resolvedPath });
        continue;
      }

      try {
        const contents = readFileSync(resolvedPath);
        certificates.push(contents);
        fileCount += 1;
      } catch (error) {
        logCustomAIWarning("Failed to read CustomAI CA bundle file", {
          path: resolvedPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    certificates: certificates.length > 0 ? certificates : undefined,
    fileCount,
    hadInlineCertificates,
  };
};

const resolveNodeAgentOptions = (opts: {
  disableSSLVerification: boolean;
  caCertificates?: Array<string | Buffer>;
  providedHttpsAgent?: ClientOptions["httpsAgent"];
}): { httpsAgent?: ClientOptions["httpsAgent"] } => {
  if (opts.providedHttpsAgent) {
    logCustomAIDebug("Using caller-provided HTTPS agent for CustomAI");
    return {};
  }

  const agentOptions: ConstructorParameters<typeof HttpsAgent>[0] = {
    rejectUnauthorized: !opts.disableSSLVerification,
  };

  if (opts.caCertificates?.length) {
    agentOptions.ca = opts.caCertificates;
  }

  const httpsAgent = new HttpsAgent(agentOptions);

  logCustomAIDebug("Constructed CustomAI HTTPS agent", {
    rejectUnauthorized: agentOptions.rejectUnauthorized,
    hasCustomCA: !!agentOptions.ca,
  });

  return {
    httpsAgent,
  };
};

export * from "../model";

export class CustomAI extends OpenAI {
  protected azureAuthToken: string | null = null;
  public static readonly defaultScope = requireEnvVar("CUSTOMAI_DEFAULT_SCOPE");

  public declare models: CustomAIModels;

  constructor(opts: CustomAIOptions = {}) {
    const globalRef = typeof globalThis === "object" ? (globalThis as Record<string, unknown>) : {};
    const isBrowser = typeof globalRef.window !== "undefined";
    logCustomAIDebug("Constructing CustomAI client", {
      runtime: isBrowser ? "browser" : "node",
      hasFetch: typeof globalRef.fetch === "function",
      hasWindow: isBrowser,
    });
    const browserOptions = isBrowser
      ? {
          httpAgent: undefined,
          httpsAgent: undefined,
          fetch: typeof globalRef.fetch === "function" ? (globalRef.fetch as typeof fetch) : undefined,
        }
      : {};

    const disableSSLVerificationEnv = getEnvVarBoolean("CUSTOMAI_ALLOW_SELF_SIGNED_CERTS");
    const disableAutoCertLoadingEnv = getEnvVarBoolean("CUSTOMAI_DISABLE_AUTO_CERT_LOADING");

    const disableSSLVerification =
      opts.disableSSLVerification ?? (disableSSLVerificationEnv ?? false);
    const disableAutoCertLoading =
      opts.disableAutoCertLoading ?? (disableAutoCertLoadingEnv ?? false);

    const providedCertificates = normalizeCertificateInput(opts.caCertificates);
    const providedCertificateCount = providedCertificates?.length ?? 0;
    let caCertificates = providedCertificates;
    const envCertificates = disableAutoCertLoading ? undefined : loadCertificatesFromEnv();

    if (envCertificates?.certificates?.length) {
      caCertificates = [...(caCertificates ?? []), ...envCertificates.certificates];
    }

    const usingCertificates = caCertificates?.length ?? 0;

    const nodeAgentOptions = !isBrowser
      ? resolveNodeAgentOptions({
          disableSSLVerification,
          caCertificates,
          providedHttpsAgent: opts.httpsAgent,
        })
      : {};

    logCustomAIDebug("Resolved CustomAI TLS configuration", {
      disableSSLVerification,
      disableAutoCertLoading,
      providedCertificates: providedCertificateCount,
      envCertificateFiles: envCertificates?.fileCount ?? 0,
      envInlineCertificates: envCertificates?.hadInlineCertificates ?? false,
      finalCertificateCount: usingCertificates,
      usingProvidedHttpsAgent: !!opts.httpsAgent,
      applyingNodeAgentOptions: !isBrowser,
    });

    const apiKey = opts.apiKey ?? getEnvVar("CUSTOMAI_API_KEY", "customai_dummy");
    const timeout = opts.timeout ?? getEnvVarNumber("CUSTOMAI_TIMEOUT", 30000);
    const maxRetries = opts.maxRetries ?? getEnvVarNumber("CUSTOMAI_MAX_RETRIES", 3);
    const baseURL = opts.baseURL ?? getEnvVar("CUSTOMAI_BASE_URL");
    const dangerouslyAllowBrowser =
      opts.dangerouslyAllowBrowser ?? getEnvVarBoolean("CUSTOMAI_ALLOW_BROWSER", true);

    logCustomAIDebug("Resolved CustomAI constructor options", {
      baseURL,
      timeout,
      maxRetries,
      dangerouslyAllowBrowser,
      apiKey: redactSecret(apiKey),
      defaultScope: CustomAI.defaultScope,
    });

    super({
      ...opts,
      ...browserOptions,
      ...nodeAgentOptions,
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

    logCustomAIDebug("CustomAI client initialized");
  }

  setAzureAuthToken(token: string) {
    this.azureAuthToken = token;
    logCustomAIDebug("Azure auth token updated", {
      hasToken: !!token,
      tokenLength: token?.length ?? 0,
    });
  }

  protected override authHeaders(opts: FinalRequestOptions): Record<string, string | null | undefined> {
    if (this.azureAuthToken) {
      logCustomAIDebug("Applying Azure auth header override", {
        path: opts.path,
        method: opts.method,
      });
      return { Authorization: `Bearer ${this.azureAuthToken}` };
    }
    const headers = super.authHeaders(opts);
    logCustomAIDebug("Using default auth headers", {
      path: opts.path,
      method: opts.method,
    });
    return headers;
  }

  protected override defaultHeaders(opts: FinalRequestOptions): Record<string, string | null | undefined> {
    const headers = super.defaultHeaders(opts) as Record<string, string | null | undefined>;
    if (this.azureAuthToken) {
      delete headers["OpenAI-Organization"];
      delete headers["OpenAI-Project"];
      logCustomAIDebug("Removed OpenAI-specific headers due to Azure auth token", {
        path: opts.path,
        method: opts.method,
      });
    }
    logCustomAIDebug("Computed default headers", {
      hasAzureToken: !!this.azureAuthToken,
      headerKeys: Object.keys(headers ?? {}),
    });
    return headers;
  }
}

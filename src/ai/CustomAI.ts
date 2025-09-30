import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { Agent as HttpsAgent } from "https";
import { resolve, delimiter, extname } from "path";
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
  directoryCertificateCount: number;
  hadInlineCertificates: boolean;
  directoriesSearched: string[];
  directoriesWithCertificates: string[];
  defaultDirectoriesApplied: string[];
  envDirectoriesApplied: string[];
}

interface CertificateLoadSummary {
  fileCount: number;
  directoryCertificateCount: number;
  directoriesSearched: string[];
  directoriesWithCertificates: string[];
  defaultDirectoriesApplied: string[];
  envDirectoriesApplied: string[];
}

const CERTIFICATE_FILE_EXTENSIONS = new Set([".crt", ".cer", ".pem", ".der", ".p7b", ".pfx"]);
const DEFAULT_CERTIFICATE_DIRECTORIES = ["EGADCerts", "EGADCerts/certs"];

const createCertificateLoadSummary = (): CertificateLoadSummary => ({
  fileCount: 0,
  directoryCertificateCount: 0,
  directoriesSearched: [],
  directoriesWithCertificates: [],
  defaultDirectoriesApplied: [],
  envDirectoriesApplied: [],
});

const collectCertificatesFromDirectory = (
  directoryPath: string,
  source: "env" | "default",
  certificates: Array<string | Buffer>,
  summary: CertificateLoadSummary,
  processedDirectories: Set<string>,
): void => {
  const resolvedPath = resolve(directoryPath);
  const normalizedPath = resolvedPath.replace(/\\+/g, "/");

  if (processedDirectories.has(normalizedPath)) {
    return;
  }

  processedDirectories.add(normalizedPath);
  summary.directoriesSearched.push(normalizedPath);

  if (!existsSync(resolvedPath)) {
    logCustomAIDebug("CustomAI certificate directory not found", {
      directory: normalizedPath,
      source,
    });
    return;
  }

  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(resolvedPath);
  } catch (error) {
    logCustomAIWarning("Failed to inspect CustomAI certificate directory", {
      directory: normalizedPath,
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  if (!stats.isDirectory()) {
    logCustomAIWarning("CustomAI certificate path is not a directory", {
      directory: normalizedPath,
      source,
    });
    return;
  }

  let loadedFromDirectory = 0;
  try {
    const entries = readdirSync(resolvedPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (!CERTIFICATE_FILE_EXTENSIONS.has(extension)) {
        continue;
      }

      const entryPath = resolve(resolvedPath, entry.name);
      try {
        const contents = readFileSync(entryPath);
        certificates.push(contents);
        loadedFromDirectory += 1;
      } catch (error) {
        logCustomAIWarning("Failed to read CustomAI certificate file", {
          path: entryPath,
          directory: normalizedPath,
          source,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    logCustomAIWarning("Failed to enumerate CustomAI certificate directory", {
      directory: normalizedPath,
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  if (loadedFromDirectory > 0) {
    summary.directoryCertificateCount += loadedFromDirectory;
    summary.fileCount += loadedFromDirectory;
    summary.directoriesWithCertificates.push(normalizedPath);
    if (source === "default") {
      summary.defaultDirectoriesApplied.push(normalizedPath);
    } else {
      summary.envDirectoriesApplied.push(normalizedPath);
    }
  }

  logCustomAIDebug("Processed CustomAI certificate directory", {
    directory: normalizedPath,
    source,
    loadedCertificates: loadedFromDirectory,
  });
};

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
  const summary = createCertificateLoadSummary();
  const processedDirectories = new Set<string>();
  const inlineCertificates = getEnvVar("CUSTOMAI_CA_BUNDLE");
  let hadInlineCertificates = false;

  if (inlineCertificates) {
    certificates.push(inlineCertificates);
    hadInlineCertificates = true;
  }

  const bundlePathRaw = getEnvVar("CUSTOMAI_CA_BUNDLE_PATH");

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
        const stats = statSync(resolvedPath);
        if (stats.isDirectory()) {
          collectCertificatesFromDirectory(resolvedPath, "env", certificates, summary, processedDirectories);
        } else {
          const contents = readFileSync(resolvedPath);
          certificates.push(contents);
          summary.fileCount += 1;
        }
      } catch (error) {
        logCustomAIWarning("Failed to read CustomAI CA bundle file", {
          path: resolvedPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const directoriesFromEnv = getEnvVar("CUSTOMAI_CA_BUNDLE_DIRS");
  if (directoriesFromEnv) {
    directoriesFromEnv
      .split(delimiter)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .forEach((entry) =>
        collectCertificatesFromDirectory(entry, "env", certificates, summary, processedDirectories),
      );
  }

  const extensionRoot = resolve(__dirname, "../../");
  const defaultDirectoryCandidates = new Set<string>();
  for (const directory of DEFAULT_CERTIFICATE_DIRECTORIES) {
    defaultDirectoryCandidates.add(resolve(extensionRoot, directory));
    defaultDirectoryCandidates.add(resolve(directory));
  }

  for (const directory of defaultDirectoryCandidates) {
    collectCertificatesFromDirectory(directory, "default", certificates, summary, processedDirectories);
  }

  const finalCertificates = certificates.length > 0 ? certificates : undefined;

  return {
    certificates: finalCertificates,
    fileCount: summary.fileCount,
    directoryCertificateCount: summary.directoryCertificateCount,
    hadInlineCertificates,
    directoriesSearched: summary.directoriesSearched,
    directoriesWithCertificates: summary.directoriesWithCertificates,
    defaultDirectoriesApplied: summary.defaultDirectoriesApplied,
    envDirectoriesApplied: summary.envDirectoriesApplied,
  };
};

const configureUndiciDispatcher = (
  opts: {
    disableSSLVerification: boolean;
    caCertificates?: Array<string | Buffer>;
  },
  context: { alreadyConfigured: boolean },
): boolean => {
  if (context.alreadyConfigured) {
    return true;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    const undici: typeof import("undici") = require("undici");
    if (typeof undici?.setGlobalDispatcher !== "function" || typeof undici?.Agent !== "function") {
      logCustomAIWarning("Undici dispatcher hooks unavailable for CustomAI TLS overrides");
      return false;
    }

    type UndiciAgent = typeof undici.Agent;
    type UndiciAgentOptions = NonNullable<ConstructorParameters<UndiciAgent>[0]>;

    const connectOptions: NonNullable<UndiciAgentOptions["connect"]> = {
      rejectUnauthorized: !opts.disableSSLVerification,
    };

    if (opts.caCertificates?.length) {
      type ConnectOptions = NonNullable<UndiciAgentOptions["connect"]>;
      connectOptions.ca = opts.caCertificates as NonNullable<ConnectOptions["ca"]>;
    }

    const agentOptions: UndiciAgentOptions = {
      connect: connectOptions,
    };

    const dispatcher = new undici.Agent(agentOptions);
    undici.setGlobalDispatcher(dispatcher);

    logCustomAIDebug("Configured undici TLS dispatcher for CustomAI", {
      rejectUnauthorized: connectOptions.rejectUnauthorized,
      hasCustomCA: !!connectOptions.ca,
    });

    return true;
  } catch (error) {
    logCustomAIWarning("Failed to configure undici TLS dispatcher for CustomAI", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

let undiciDispatcherConfigured = false;

const resolveNodeAgentOptions = (opts: {
  disableSSLVerification: boolean;
  caCertificates?: Array<string | Buffer>;
  providedHttpsAgent?: ClientOptions["httpsAgent"];
}): { httpAgent?: ClientOptions["httpAgent"]; httpsAgent?: ClientOptions["httpsAgent"] } => {
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

  const dispatcherResult = configureUndiciDispatcher(
    {
      disableSSLVerification: opts.disableSSLVerification,
      caCertificates: opts.caCertificates,
    },
    { alreadyConfigured: undiciDispatcherConfigured },
  );

  if (dispatcherResult) {
    undiciDispatcherConfigured = true;
  }

  logCustomAIDebug("Constructed CustomAI HTTPS agent", {
    rejectUnauthorized: agentOptions.rejectUnauthorized,
    hasCustomCA: !!agentOptions.ca,
    undiciDispatcherConfigured: dispatcherResult,
  });

  return {
    httpAgent: httpsAgent,
    httpsAgent,
  };
};

const getRequestDebugInfo = (
  opts: FinalRequestOptions,
): { path?: string; method?: string } => {
  const record = opts as Record<string, unknown>;
  const path = typeof record.path === "string" ? record.path : undefined;
  const method = typeof record.method === "string" ? record.method : undefined;
  return { path, method };
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
      envDirectoryCertificates: envCertificates?.directoryCertificateCount ?? 0,
      certificateDirectoriesSearched: envCertificates?.directoriesSearched ?? [],
      certificateDirectoriesWithCerts: envCertificates?.directoriesWithCertificates ?? [],
      defaultCertificateDirectoriesApplied: envCertificates?.defaultDirectoriesApplied ?? [],
      envCertificateDirectoriesApplied: envCertificates?.envDirectoriesApplied ?? [],
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
      logCustomAIDebug("Applying Azure auth header override", getRequestDebugInfo(opts));
      return { Authorization: `Bearer ${this.azureAuthToken}` };
    }
    const headers = super.authHeaders(opts);
    logCustomAIDebug("Using default auth headers", getRequestDebugInfo(opts));
    return headers;
  }

  protected override defaultHeaders(opts: FinalRequestOptions): Record<string, string | null | undefined> {
    const headers = super.defaultHeaders(opts) as Record<string, string | null | undefined>;
    const requestInfo = getRequestDebugInfo(opts);
    if (this.azureAuthToken) {
      delete headers["OpenAI-Organization"];
      delete headers["OpenAI-Project"];
      logCustomAIDebug("Removed OpenAI-specific headers due to Azure auth token", requestInfo);
    }
    logCustomAIDebug("Computed default headers", {
      hasAzureToken: !!this.azureAuthToken,
      headerKeys: Object.keys(headers ?? {}),
      ...requestInfo,
    });
    return headers;
  }
}

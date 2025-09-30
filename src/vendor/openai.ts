export interface ClientOptions {
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  baseURL?: string;
  dangerouslyAllowBrowser?: boolean;
  [key: string]: unknown;
}

export interface RequestDefaults {
  headers?: Record<string, string>;
}

export class BaseOpenAIModels {
  async list(_params?: unknown): Promise<unknown> {
    throw new Error("Model listing is not implemented in the local OpenAI shim.");
  }

  async retrieve(_model: string, _params?: unknown): Promise<unknown> {
    throw new Error("Model retrieval is not implemented in the local OpenAI shim.");
  }
}

export default class OpenAI {
  public models: BaseOpenAIModels;

  constructor(protected readonly options: ClientOptions = {}) {
    this.models = new BaseOpenAIModels();
  }

  protected authHeaders(_opts: RequestDefaults): Record<string, string | null | undefined> {
    if (!this.options.apiKey) {
      return {};
    }
    return { Authorization: `Bearer ${this.options.apiKey}` };
  }

  protected defaultHeaders(_opts: RequestDefaults): Record<string, string | null | undefined> {
    return {
      "Content-Type": "application/json",
    };
  }
}

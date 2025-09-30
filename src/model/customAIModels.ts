import type { BaseOpenAIModels } from "openai";

type ListParams = Parameters<BaseOpenAIModels["list"]>[0];
type RetrieveParams = Parameters<BaseOpenAIModels["retrieve"]>[1];

type ListResponse = ReturnType<BaseOpenAIModels["list"]>;
type RetrieveResponse = ReturnType<BaseOpenAIModels["retrieve"]>;

export type CustomAIModel = Awaited<RetrieveResponse>;

export class CustomAIModels {
  constructor(private readonly baseModels: BaseOpenAIModels) {}

  list(params?: ListParams): ListResponse {
    return this.baseModels.list(params);
  }

  retrieve(model: string, params?: RetrieveParams): RetrieveResponse {
    return this.baseModels.retrieve(model, params);
  }
}

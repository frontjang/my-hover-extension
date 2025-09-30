"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseOpenAIModels = void 0;
class BaseOpenAIModels {
    async list(_params) {
        throw new Error("Model listing is not implemented in the local OpenAI shim.");
    }
    async retrieve(_model, _params) {
        throw new Error("Model retrieval is not implemented in the local OpenAI shim.");
    }
}
exports.BaseOpenAIModels = BaseOpenAIModels;
class OpenAI {
    constructor(options = {}) {
        this.options = options;
        this.models = new BaseOpenAIModels();
    }
    authHeaders(_opts) {
        if (!this.options.apiKey) {
            return {};
        }
        return { Authorization: `Bearer ${this.options.apiKey}` };
    }
    defaultHeaders(_opts) {
        return {
            "Content-Type": "application/json",
        };
    }
}
exports.default = OpenAI;
//# sourceMappingURL=openai.js.map
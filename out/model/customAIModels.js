"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomAIModels = void 0;
class CustomAIModels {
    constructor(baseModels) {
        this.baseModels = baseModels;
    }
    list(params) {
        return this.baseModels.list(params);
    }
    retrieve(model, params) {
        return this.baseModels.retrieve(model, params);
    }
}
exports.CustomAIModels = CustomAIModels;
//# sourceMappingURL=customAIModels.js.map
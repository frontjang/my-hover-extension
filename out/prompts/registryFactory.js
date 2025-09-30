"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultLineProcessorRegistry = createDefaultLineProcessorRegistry;
const fileLineReference_1 = require("./processors/fileLineReference");
const registry_1 = require("./registry");
function createDefaultLineProcessorRegistry(resolver) {
    return new registry_1.LineProcessorRegistry([new fileLineReference_1.FileLineReferenceProcessor(resolver)]);
}
//# sourceMappingURL=registryFactory.js.map
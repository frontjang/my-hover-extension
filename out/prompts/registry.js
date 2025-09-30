"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineProcessorRegistry = void 0;
class LineProcessorRegistry {
    constructor(initialProcessors = []) {
        this.processors = new Map(initialProcessors.map((processor) => [processor.id, processor]));
    }
    register(processor) {
        this.processors.set(processor.id, processor);
    }
    get(id) {
        return this.processors.get(id);
    }
    async collect(params, processorIds) {
        const contexts = [];
        for (const id of processorIds) {
            const processor = this.get(id);
            if (!processor) {
                continue;
            }
            try {
                const augmentation = await processor.process(params);
                if (augmentation) {
                    contexts.push(augmentation);
                }
            }
            catch (error) {
                console.error(`[MyHoverExtension] Line processor "${id}" failed:`, error);
            }
        }
        return contexts;
    }
}
exports.LineProcessorRegistry = LineProcessorRegistry;
//# sourceMappingURL=registry.js.map
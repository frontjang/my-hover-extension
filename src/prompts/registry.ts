import { LineProcessor, LineProcessorParams } from './types';

export class LineProcessorRegistry {
  private readonly processors: Map<string, LineProcessor>;

  constructor(initialProcessors: LineProcessor[] = []) {
    this.processors = new Map(initialProcessors.map((processor) => [processor.id, processor]));
  }

  register(processor: LineProcessor): void {
    this.processors.set(processor.id, processor);
  }

  get(id: string): LineProcessor | undefined {
    return this.processors.get(id);
  }

  async collect(
    params: LineProcessorParams,
    processorIds: readonly string[]
  ): Promise<string[]> {
    const contexts: string[] = [];

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
      } catch (error) {
        console.error(
          `[MyHoverExtension] Line processor "${id}" failed:`,
          error
        );
      }
    }

    return contexts;
  }
}

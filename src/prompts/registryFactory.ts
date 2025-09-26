import { FileContextResolver } from './fileContextResolver';
import { FileLineReferenceProcessor } from './processors/fileLineReference';
import { LineProcessorRegistry } from './registry';

export function createDefaultLineProcessorRegistry(
  resolver: FileContextResolver
): LineProcessorRegistry {
  return new LineProcessorRegistry([new FileLineReferenceProcessor(resolver)]);
}

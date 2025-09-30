const builder = require('./builder');
const fileContextResolver = require('./fileContextResolver');
const registryFactory = require('./registryFactory');
const fileLineReference = require('./processors/fileLineReference');
const registry = require('./registry');

module.exports = {
  buildPromptPayload: builder.buildPromptPayload,
  FileContextResolver: fileContextResolver.FileContextResolver,
  createDefaultLineProcessorRegistry: registryFactory.createDefaultLineProcessorRegistry,
  FileLineReferenceProcessor: fileLineReference.FileLineReferenceProcessor,
  FILE_LINE_PATTERN: fileLineReference.FILE_LINE_PATTERN,
  parseFileLineReference: fileLineReference.parseFileLineReference,
  LineProcessorRegistry: registry.LineProcessorRegistry
};

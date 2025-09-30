const { FileLineReferenceProcessor } = require('./processors/fileLineReference');
const { LineProcessorRegistry } = require('./registry');

function createDefaultLineProcessorRegistry(resolver) {
  return new LineProcessorRegistry([new FileLineReferenceProcessor(resolver)]);
}

module.exports = {
  createDefaultLineProcessorRegistry
};

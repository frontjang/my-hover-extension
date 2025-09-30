const assert = require('assert');

test('extension loads', () => {
  assert.strictEqual(typeof require('../../extension'), 'object');
});

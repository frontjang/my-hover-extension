import * as assert from 'assert';

test('extension loads', () => {
  assert.strictEqual(typeof require('../../extension'), 'object');
});

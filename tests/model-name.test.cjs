const test = require('node:test');
const assert = require('node:assert/strict');
const { modelDisplayName } = require('../.private/test-build/model-name.js');

test('z3 labels preserve the legacy API profile and unknown names', () => {
  const profile = Object.freeze({ id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B' });
  assert.equal(modelDisplayName(profile.name), 'z3-mini 4.5B');
  for (const size of ['lite', 'nano', 'mini', 'flash']) {
    assert.equal(modelDisplayName(`d3-${size}`), `z3-${size}`);
  }
  assert.equal(modelDisplayName('d3'), 'z3');
  for (const name of ['z3-mini', 'H2O 4B', 'future-model-v2', 'd3-mini-4.5b-v1', 'd3-custom']) {
    assert.equal(modelDisplayName(name), name);
  }
  assert.equal(modelDisplayName(null), '');
  assert.equal(modelDisplayName(undefined), '');
  assert.deepEqual(profile, { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B' });
});

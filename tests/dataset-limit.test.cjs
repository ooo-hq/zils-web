const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { MAX_DATASET_BYTES } = require('../.private/test-build/training.js');

test('a training split may reach 384 MiB, matching the subnet download limit', () => {
  // Claims' full eligibility train split is 281 MB.
  assert.equal(MAX_DATASET_BYTES, 384 * 1024 * 1024);
  assert.ok(280_725_482 <= MAX_DATASET_BYTES);
});

test('upload messages state the current limit', () => {
  for (const file of ['lib/training.ts', 'components/training-intake.tsx', 'components/prepared-training-preview.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /128 MiB/, file);
    assert.match(source, /384 MiB/, file);
  }
});

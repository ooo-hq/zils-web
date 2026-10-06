const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const file = name => readFileSync(join(__dirname, '../public/model', name));
const record = name => JSON.parse(file(name));
const study = record('abcd-002.json');

test('published support scores retain the frozen final and development evidence', () => {
  for (const [name, hash] of Object.entries(study.sources)) {
    assert.equal(createHash('sha256').update(file(name)).digest('hex'), hash, name);
  }
  assert.deepEqual(study.test, record('abcd-002-test-results.json'));
  assert.deepEqual(study.development, record('abcd-002-development-results.json'));
  assert.equal(study.splits.final_test_used_for_selection, false);
  assert.equal(study.test.test_used_for_selection, false);
  assert.equal(study.model.adapter_sha256, study.development.selected_adapter_sha256);
});

test('the headline uses the untouched comparison, with distinct development scores', () => {
  const { base, candidate } = study.test.metrics;
  assert.equal(base.count, 500);
  assert.equal(candidate.count, base.count);
  assert.equal(base.correct, 289);
  assert.equal(candidate.correct, 396);
  assert.equal(base.accuracy, base.correct / base.count);
  assert.equal(candidate.accuracy, candidate.correct / candidate.count);
  assert.equal(((candidate.accuracy - base.accuracy) * 100).toFixed(1), '21.4');
  assert.equal(((candidate.correct - base.correct) / (base.count - base.correct) * 100).toFixed(0), '51');
  assert.equal(study.development.baseline.accuracy, .54);
  assert.equal(study.development.candidates.at(-1).accuracy, .774);
  assert.ok(study.test.accuracy_gain_95_percent_paired_bootstrap_percentage_points[0] > 0);
  assert.ok(study.test.brier_improvement_95_percent_paired_bootstrap[0] > 0);
  assert.equal(study.test.frozen_success_gate_passed, true);
  assert.ok(candidate.mean_confidence > candidate.accuracy);
});

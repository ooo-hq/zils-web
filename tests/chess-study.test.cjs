const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const file = name => readFileSync(join(__dirname, '../public/model', name));
const record = name => JSON.parse(file(name));
const hash = name => createHash('sha256').update(file(name)).digest('hex');

test('chess publication retains the frozen protocol, data split, and complete audit', () => {
  const study = record('chess-001.json');
  const protocol = record('chess-001-protocol.json');
  const preparation = record('chess-001-preparation.json');
  assert.equal(study.protocol_sha256, hash('chess-001-protocol.json'));
  assert.equal(study.data_manifest_sha256, hash('chess-001-manifest.json'));
  assert.equal(preparation.data_manifest_sha256, study.data_manifest_sha256);
  assert.deepEqual(protocol.splits, { train: 2048, calibration: 512, test: 512 });
  assert.equal(preparation.preflight.duplicate_games, 0);
  assert.equal(preparation.preflight.duplicate_positions_including_color_mirrors, 0);
  assert.equal(study.independent_audit.all_1536_predictions_verified, true);
});

test('chess headline counts, paired differences, and stronger rules baseline agree', () => {
  const study = record('chess-001.json');
  for (const [name, correct] of Object.entries({ trained: 260, jev: 223, shared: 220 })) {
    assert.equal(study.results[name].examples, 512);
    assert.equal(study.results[name].coverage, 1);
    assert.equal(study.independent_audit.models[name].correct, correct);
    assert.equal(study.results[name].accuracy, correct / 512);
  }
  for (const name of ['shared', 'jev']) {
    const difference = study.paired_comparisons[`trained_minus_${name}`].accuracy;
    assert.equal(difference.right_minus_left, study.results.trained.accuracy - study.results[name].accuracy);
    assert.ok(difference.paired_game_bootstrap_95pct[0] > 0);
  }
  assert.equal(study.baselines.rules_oracle, 1);
  assert.ok(study.baselines.rules_oracle > study.results.trained.accuracy);
  assert.equal(study.api_reliability_and_usage.total_attempts, 518);
  assert.equal(study.api_reliability_and_usage.rejected_attempts, 6);
});

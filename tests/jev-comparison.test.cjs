const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const file = name => readFileSync(join(__dirname, '../public/model', name));
const record = name => JSON.parse(file(name));
const study = record('abcd-002-jev.json');
const original = record('abcd-002.json');
const { cases, actions } = record('abcd-002-jev-predictions.json');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('Jev comparison preserves its evidence and the original frozen training selection', () => {
  for (const [name, hash] of Object.entries(study.sources)) {
    assert.equal(createHash('sha256').update(file(name)).digest('hex'), hash, name);
    assert.doesNotMatch(file(name).toString(), /\/Users\/|\.private\/|Bearer /);
  }
  assert.deepEqual(study.test, record('abcd-002-jev-results.json'));
  assert.equal(study.comparator.model_id, 'jev-1.13.0');
  assert.equal(study.test.pinned_jev_model, study.comparator.model_id);
  assert.equal(study.model.adapter_sha256, original.model.adapter_sha256);
  assert.equal(study.artifact_hashes.frozen_inputs_sha256, record('abcd-002-test-manifest.json').files['inputs.jsonl']);
  assert.equal(study.method.test_used_for_training_or_selection, false);
  assert.equal(study.method.reused_verified_jevk5_predictions, true);
  assert.equal(study.method.jev_prompt_optimized_separately, false);
  assert.equal(study.method.timing_comparable, false);
});

test('every published comparison score can be recomputed from all 500 paired predictions', () => {
  assert.equal(cases.length, 500);
  assert.equal(new Set(cases.map(row => row.id)).size, 500);
  assert.equal(new Set(cases.map(row => row.conversation_id)).size, 500);
  assert.equal(actions.length, 30);
  for (const model of ['jev', 'trained_jevk5', 'shared_jevk5']) {
    const metrics = study.test.metrics[model];
    let correct = 0;
    let loss = 0;
    for (const row of cases) {
      assert.ok(actions.includes(row.expected_action));
      assert.deepEqual(Object.keys(row[model].probabilities).sort(), [...actions].sort());
      assert.ok(actions.includes(row[model].choice));
      const probabilities = row[model].probabilities;
      assert.ok(Object.values(probabilities).every(p => Number.isFinite(p) && p >= 0 && p <= 1));
      const sum = Object.values(probabilities).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) <= .0100000001);
      correct += row[model].choice === row.expected_action;
      loss += actions.reduce((total, action) => total + (probabilities[action] / sum - Number(action === row.expected_action)) ** 2, 0);
    }
    assert.equal(metrics.n, cases.length);
    assert.equal(metrics.correct, correct);
    close(metrics.accuracy, correct / cases.length);
    close(metrics.multiclass_brier, loss / cases.length);
    const supported = actions.filter(a => cases.some(row => row.expected_action === a));
    const f1 = supported.map(action => {
      const support = cases.filter(row => row.expected_action === action).length;
      const predicted = cases.filter(row => row[model].choice === action).length;
      const truePositive = cases.filter(row => row.expected_action === action && row[model].choice === action).length;
      return 2 * truePositive / (support + predicted);
    });
    close(metrics.macro_f1, f1.reduce((a, b) => a + b, 0) / f1.length);
    for (const coverage of metrics.coverage) {
      const selected = cases.filter(row => row[model].probabilities[row[model].choice] >= coverage.threshold);
      const wrong = selected.filter(row => row[model].choice !== row.expected_action).length;
      assert.equal(coverage.automated, selected.length);
      assert.equal(coverage.wrong, wrong);
      close(coverage.coverage, selected.length / cases.length);
      if (selected.length) close(coverage.accuracy_among_automated, (selected.length - wrong) / selected.length);
      else assert.equal(coverage.accuracy_among_automated, null);
    }
  }
  for (const [name, reference] of [['trained_jevk5', 'candidate'], ['shared_jevk5', 'base']]) {
    for (const key of ['accuracy', 'macro_f1', 'multiclass_brier']) close(study.test.metrics[name][key], original.test.metrics[reference][key]);
  }
});

test('paired outcomes, API accounting, and response irregularities remain visible', () => {
  const paired = study.test.comparisons.trained_vs_jev;
  const trainedOnly = cases.filter(row => row.trained_jevk5.choice === row.expected_action && row.jev.choice !== row.expected_action).length;
  const jevOnly = cases.filter(row => row.trained_jevk5.choice !== row.expected_action && row.jev.choice === row.expected_action).length;
  assert.equal(paired.trained_correct_other_wrong, trainedOnly);
  assert.equal(paired.other_correct_trained_wrong, jevOnly);
  close(paired.accuracy_gain_percentage_points, (trainedOnly - jevOnly) / cases.length * 100);
  assert.deepEqual(paired.accuracy_gain_95_ci_percentage_points, [4.8, 12.2]);
  assert.equal(study.test.metrics.jev.correct, 353);
  assert.equal(study.test.metrics.trained_jevk5.correct, 396);
  const tokens = cases.reduce((sum, row) => sum + row.jev.input_tokens, 0);
  assert.equal(study.test.metrics.jev.total_input_tokens, tokens);
  close(study.test.jev_api_cost_usd, tokens * .042 / 1_000_000);
  const sumFlags = cases.filter(row => Math.abs(Object.values(row.jev.probabilities).reduce((a, b) => a + b, 0) - 1) > 1e-5).length;
  const rankingFlags = cases.filter(row => row.jev.probabilities[row.jev.choice] < Math.max(...Object.values(row.jev.probabilities)) - 1e-8).length;
  assert.equal(sumFlags, 47);
  assert.equal(rankingFlags, 1);
  assert.equal(study.test.raw_validation_flags, sumFlags + rankingFlags);
  assert.equal(study.test.all_500_responses_received, true);
});

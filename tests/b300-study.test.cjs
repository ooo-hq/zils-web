const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '../public/model/b300-2026-10-10');
const file = name => readFileSync(join(root, name));
const record = name => JSON.parse(file(name));

test('B300 evidence matches the publication manifest and contains no private case records', () => {
  const manifest = record('manifest.json');
  assert.equal(manifest.aggregate_only, true);
  for (const [name, hashes] of Object.entries(manifest.files)) {
    const bytes = file(name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes.published_sha256, name);
    if (name.endsWith('.json')) assert.equal(hashes.source_sha256, hashes.published_sha256, name);
    const text = bytes.toString();
    assert.doesNotMatch(text, /\/Users\/|\/root\/|(?:\d{1,3}\.){3}\d{1,3}|ssh-rsa|PRIVATE KEY|"(?:conversation_id|case_id|prompt|messages|predictions|labels)"\s*:/, name);
    if (name.endsWith('.md')) {
      for (const [, href] of text.matchAll(/\]\(([^)]+)\)/g)) {
        if (!href.startsWith('https://')) assert.ok(existsSync(join(root, href)), `${name}: ${href}`);
      }
    }
  }
});

test('B300 tables, paired gains, and cohort status remain consistent', () => {
  const miner = record('miner-results.json');
  const original = record('results.json');
  assert.equal(miner.completed, true);
  assert.equal(original.test_used_for_selection, false);
  assert.equal(original.teacher_gate_status, 'not_evaluated');
  assert.equal(original.teacher_label_generation_gate_passed, null);
  assert.equal(miner.trials['h2o-4096-lora'].selected_epoch, 1);
  assert.equal(miner.trials['jevk5-2b-4096-lora'].selected_epoch, 2);
  for (const [name, cohort] of Object.entries(miner.cohorts)) {
    assert.equal(cohort.retrospective, true);
    assert.equal(cohort.fresh, false);
    for (const metrics of Object.values(cohort.metrics)) {
      assert.equal(metrics.count, 500);
      assert.equal(metrics.accuracy, metrics.correct / metrics.count);
      assert.ok(metrics.inference_memory.peak_cuda_bytes > 0);
      assert.equal(metrics.inference_memory.hardware, 'NVIDIA B300');
    }
    for (const [pair, result] of Object.entries(cohort.comparisons)) {
      const [left, right] = pair.split('_minus_');
      const gain = (cohort.metrics[left].accuracy - cohort.metrics[right].accuracy) * 100;
      assert.ok(Math.abs(result.accuracy_gain_pp - gain) < 1e-10, pair);
    }
    for (const model of ['4b-base', '4b-lora-4096-epoch2']) {
      for (const metric of ['correct', 'accuracy', 'multiclass_brier', 'latency_median_seconds']) {
        assert.equal(cohort.metrics[model][metric], original.cohorts[name].metrics[model][metric]);
      }
    }
  }
  const m = miner.cohorts.test.metrics;
  assert.equal((m['4b-lora-4096-epoch2'].latency_median_seconds / m['h2o-lora-4096-epoch1'].latency_median_seconds).toFixed(2), '2.99');
  assert.equal(((1 - m['2b-lora-4096-epoch2'].inference_memory.peak_cuda_bytes / m['4b-lora-4096-epoch2'].inference_memory.peak_cuda_bytes) * 100).toFixed(0), '54');
});

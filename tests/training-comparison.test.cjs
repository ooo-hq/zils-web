const { test } = require('node:test');
const assert = require('node:assert/strict');
const { trainingComparison, correctCount, validateComparisonFile } = require('../.private/test-build/training-comparison.js');
const { trainingApi, jobSchema } = require('../.private/test-build/training.js');
const id = '10000000-0000-4000-8000-000000000001';
const job = {
  id, name: 'sample', status: 'completed',
  model: { id: 'jevk5-4b-v0.3', name: 'JevK5', base: 'base', base_revision: 'a'.repeat(40) },
  dataset_counts: { train: 64, calibration: 16, test: 16 },
  result: { delivery: { status: 'accepted', uid: 1, acceptance: { min_accuracy: .5, min_brier_improvement: 0 } }, baseline: { accuracy: .8125, brier: .314, skill: .3 }, miners: [{ uid: 1, status: 'evaluated', accuracy: .8125, brier: .219 }], weights: {} },
};
test('the actual 13/16 sample reports tied accuracy and better probabilities', () => {
  const result = trainingComparison(jobSchema.parse(job));
  assert.equal(result.title, 'Same accuracy on the selection test');
  assert.equal(result.difference, 0);
  assert.equal(result.count, 16);
  assert.equal(result.baseline.name, 'JevK5');
  assert.equal(result.probabilityImproved, true);
  assert.equal(correctCount(result.selected.accuracy, result.count), '13 of 16 correct');
});
test('only the accepted candidate is compared; regressions remain visible', () => {
  const value = structuredClone(job);
  value.result.miners.unshift({ uid: 0, status: 'evaluated', accuracy: 1, brier: 0 });
  value.result.miners[1].accuracy = .75;
  value.selection = { previous: { job_id: id, model_id: 'previous', sha256: 'b'.repeat(64) } };
  const result = trainingComparison(jobSchema.parse(value));
  assert.equal(result.title, 'Lower accuracy on the selection test');
  assert.equal(result.baseline.name, 'Previous trained model');
  value.result.delivery.status = 'no_qualifying_model';
  assert.equal(trainingComparison(value), null);
});
test('old results work without inventing a sample count', () => {
  const value = structuredClone(job);
  delete value.dataset_counts;
  const result = trainingComparison(jobSchema.parse(value));
  assert.equal(result.count, undefined);
  assert.equal(correctCount(.8, undefined), null);
  assert.equal(correctCount(.8125, 10), null);
});
test('new test file validation catches empty, large, malformed and missing fields', async () => {
  for (const file of [new Blob([]), new Blob(['a'.repeat(5 * 1024 * 1024 + 1)]), new Blob(['no json']), new Blob(['{}'])]) await assert.rejects(validateComparisonFile(file));
  const row = { id: 'fresh', group_id: 'new', family: 'task', state: 'input', question: { type: 'noul', instructions: 'Yes?' }, label: 'true' };
  assert.equal(await validateComparisonFile(new Blob([JSON.stringify(row)])), 1);
});
test('comparison creation records consent and upload stays on trusted storage', async () => {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ comparison: { status: 'uploading', created_at: '2026-10-07', finished_at: null, model_id: 'model', checkpoint_sha256: 'a'.repeat(64), jev_model: 'jev-1.13.0', input_sha256: null, result: null, error: null } }), { status: 200 });
  };
  const api = trainingApi('https://training.example.com', 'https://storage.example.com', async () => 'session', request);
  await api.createComparison(id);
  assert.deepEqual(JSON.parse(calls[0].init.body), { consent_version: 'typesafe-evaluation-v1', allow_typesafe_export: true, unseen_examples: true });
  await assert.rejects(api.upload('comparison', { url: 'https://untrusted.example.com/storage/v1/object/file', method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' } }, new Blob(['x'])));
  assert.equal(calls.length, 1);
});

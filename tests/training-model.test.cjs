const test = require('node:test');
const assert = require('node:assert/strict');
const { jobSchema, downloadFiles, trainingApi } = require('../.private/test-build/training.js');

const job = { id: '3a752a1b-8857-4822-9b13-c7d283e0dd54', name: 'routing', status: 'completed', result: { delivery: { status: 'accepted', acceptance: { min_accuracy: 0.8, min_brier_improvement: 0.01 } }, baseline: { accuracy: 1, brier: 0.1, skill: 0.9 }, miners: [], weights: {} } };
const model = { id: 'jevk5-4b-v0.3', name: 'JevK5 4B', base: 'alibiserikbay/JevK5', base_revision: 'c4f7fdb3aeab5582336406e78d3bef11bf98833d' };

test('preserves per-job model identity and supports old jobs without it', () => {
  assert.deepEqual(jobSchema.parse({ ...job, model }).model, model);
  assert.ok(downloadFiles(jobSchema.parse(job)).includes('head.pt'));
  assert.ok(downloadFiles(jobSchema.parse({ ...job, model })).includes('model.json'));
  assert.equal(jobSchema.safeParse({ ...job, model: { ...model, id: 'unrecognized-model' } }).success, false);
});

test('only downloads the expected files for the job model', async () => {
  const current = { ...job, model };
  let names = downloadFiles(current);
  const api = trainingApi('https://training.example', 'https://storage.example', async () => 'fixture-token', async () => new Response(JSON.stringify({ downloads: Object.fromEntries(names.map(name => [name, { url: `https://storage.example/storage/v1/object/sign/models/${name}` }])) }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  assert.deepEqual((await api.downloads(current)).map(file => file.name), names);
  names = downloadFiles(job);
  await assert.rejects(api.downloads(current), /does not match/);
});

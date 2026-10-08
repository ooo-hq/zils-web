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

const imageModel = { ...model, id: 'imajev-4b-v1', name: 'Imajev 4B' };
const imagePolicy = { min_accuracy: .8, min_brier_improvement: .01, positive_class: 'damaged', min_positive_recall: .9, max_false_positive_rate: .1 };
const imageMetrics = { accuracy: .84, brier: .2, skill: .6, count: 100, cases: 100, nll: .4, unknown_rate: .02, unknown_count: 2, outcome_order: ['normal','damaged'], confusion: { normal:{ normal:40, damaged:8, __unknown__:2 }, damaged:{ normal:6,damaged:44,__unknown__:0 } }, per_class: { damaged: { support:50, true_positives:44, false_negatives:6, false_positives:8, negatives:50, recall:.88, false_positive_rate:.16 } } };
test('image results retain versioned aggregate metrics and frozen acceptance across activation states', () => {
  for (const state of ['activating','activation_failed','ready','needs_review']) {
    const parsed = jobSchema.parse({ ...job, model:imageModel, acceptance:imagePolicy, workflow:{state,model_id:'owned-image'}, result:{ ...job.result, image_metrics_version:'zils-image-metrics/v1', baseline:imageMetrics, miners:[{uid:1,status:'evaluated',...imageMetrics}], delivery:{status:'accepted',acceptance:imagePolicy} } });
    assert.deepEqual(parsed.acceptance, imagePolicy);
    assert.equal(parsed.result.image_metrics_version,'zils-image-metrics/v1');
    assert.equal(parsed.result.miners[0].per_class.damaged.support,50);
    assert.equal(parsed.result.baseline.count,100);
    assert.equal(parsed.result.delivery.acceptance.min_positive_recall,.9);
  }
  const negative=jobSchema.parse({...job,model:imageModel,result:{...job.result,delivery:{status:'no_qualifying_model',acceptance:imagePolicy}}});
  assert.equal(negative.result.delivery.status,'no_qualifying_model');
});
test('image downloads reject text artifact lists', async () => {
  const imageJob={...job,model:imageModel};
  const api=trainingApi('https://training.example','https://storage.example',async()=> 'token',async()=>new Response(JSON.stringify({downloads:Object.fromEntries(downloadFiles({...job,model}).map(n=>[n,{url:`https://storage.example/storage/v1/object/sign/models/${n}`}]))})));
  await assert.rejects(api.downloads(imageJob),/does not match/);
});

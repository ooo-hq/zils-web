const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newerBase } = require('../.private/test-build/base-model.js');
const { jobSchema, migrationPreviewSchema, submissionSchema, imageSubmissionSchema, trainingApi } = require('../.private/test-build/training.js');

const stock = { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B' };
const round = n => ({ id: `d3-mini-4.5b-zils-r${n}`, name: `d3-mini r${n}` });
const job = (model = stock) => ({
  id: '10000000-0000-4000-8000-000000000001', name: 'support-routing', status: 'completed',
  model: { ...model, base: 'zils-ai/fixture', base_revision: 'a'.repeat(40) },
  workflow: { state: 'ready', model_id: 'support-routing-v1' },
  result: { delivery: { status: 'accepted' }, baseline: { accuracy: .8, brier: .2, skill: .4 }, miners: [], weights: {} },
});
const catalog = (stable = stock, latest = round(5)) => ({
  model: stock, channels: { stable, latest },
  pools: { 'd3-mini': { id: 'd3-mini', enabled: true, channels: { stable, latest }, availability: {
    stable: { training_enabled: true, inputs: { text: true } },
    latest: { training_enabled: true, inputs: { text: true } },
  } } },
});

test('a newer base stays in its pool and freezes the profile, including future rounds', () => {
  const config = catalog();
  assert.deepEqual(newerBase(config, job()).selection, { pool: 'd3-mini', base_channel: 'latest', model: round(5).id });
  assert.equal(newerBase(catalog(round(5), round(6)), job(round(5))).selection.model, round(6).id);
  assert.equal(newerBase(catalog(round(6), round(6)), job(round(5))).selection.base_channel, 'stable');
  assert.equal(newerBase(catalog(round(5), round(6)), job(), round(5).id).selection.model, round(5).id);
  assert.equal(newerBase(catalog(), job(), round(6).id), null, 'missing pinned targets cannot fall back');
  assert.equal(jobSchema.parse(job(round(6))).model.id, round(6).id);
});

test('same or older bases, other pools, images and non-ready models do not offer migration', () => {
  assert.equal(newerBase(catalog(), job(round(5))), null);
  assert.equal(newerBase(catalog(round(5), round(5)), job(round(6))), null);
  assert.equal(newerBase(catalog(), job({ id: 'd3-lite-0.8b-v1' })), null);
  assert.equal(newerBase(catalog(stock, { id: 'd3-lite-0.8b-zils-r6' }), job()), null);
  assert.equal(newerBase(catalog(), { ...job(), image_intake: {} }), null);
  assert.equal(newerBase(catalog(), { ...job(), status: 'running' }), null);
  assert.equal(newerBase(catalog(), { ...job(), workflow: { state: 'activating' } }), null);
  assert.equal(newerBase(catalog(), { ...job(), model: null }), null);
});

test('disabled and unqualified pools do not offer migration; legacy mini config pins a channel', () => {
  for (const change of [
    entry => { entry.enabled = false; },
    entry => { entry.availability.latest.training_enabled = false; },
    entry => { entry.availability.latest.inputs.text = false; },
  ]) {
    const config = catalog(); change(config.pools['d3-mini']);
    assert.equal(newerBase(config, job()), null);
  }
  assert.equal(newerBase({ ...catalog(), pools: {} }, job()), null);
  const legacy = catalog(); delete legacy.pools;
  assert.deepEqual(newerBase(legacy, job()).selection, { base_channel: 'latest', model: round(5).id });
  assert.equal(newerBase({ ...legacy, channels: { stable: stock, latest: null } }, job()), null);
});

test('base-change submissions retain the predecessor and criteria through API validation', async () => {
  const acceptance = { min_accuracy: .87, min_brier_improvement: .02, previous_job_id: job().id, base_change: true };
  const input = { name: 'support-migration', acceptance, allow_training_data_export: true, ...newerBase(catalog(), job()).selection };
  let sent;
  const api = trainingApi('https://training.example', { supabase: 'https://storage.example' }, async () => 'fixture', async (_, init) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ job: { ...job(round(5)), status: 'uploading' }, uploads: Object.fromEntries(['train', 'calibration', 'test'].map(s => [s, { uploaded: true }])) }));
  });
  await api.create(input);
  assert.deepEqual(sent.acceptance, acceptance);
  assert.equal(sent.acceptance.migration, undefined, 'an ordinary base-change upgrade keeps its improvement target');
  assert.equal(submissionSchema.safeParse({ ...input, acceptance: { ...acceptance, previous_job_id: undefined } }).success, false);
  assert.equal(submissionSchema.safeParse({ ...input, acceptance: { ...acceptance, base_change: false } }).success, false);
  assert.equal(imageSubmissionSchema.safeParse({ ...input, acceptance: { ...acceptance, previous_job_id: undefined }, image_intake: { version: 'zils-image-intake/v1', seed: 'test', snapshot_sha256: 'a'.repeat(64) } }).success, false);
});

test('saved-data confirmation sends only a pinned target and retry identity', async () => {
  const requestId = '30000000-0000-4000-8000-000000000003';
  const predecessor = job();
  let sent;
  const api = trainingApi('https://training.example', { supabase: 'https://storage.example' }, async () => 'fixture', async (url, init) => {
    assert.equal(url, `https://training.example/v1/jobs/${predecessor.id}/migration`);
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ job: { ...job(round(5)), dataset_source: { job_id: predecessor.id, job_sha256: 'a'.repeat(64), request_id: requestId } } }));
  });
  await api.migrate(predecessor.id, { model: round(5).id, request_id: requestId, acceptance: { min_accuracy: 0 } });
  assert.deepEqual(sent, { model: round(5).id, request_id: requestId });
});

test('migration policy survives preview and result parsing without changing regular upgrades', () => {
  for (const migration of ['no_regression', true]) {
    const acceptance = { min_accuracy: .8, min_brier_improvement: .01, previous_job_id: job().id, base_change: true, migration };
    const parsed = jobSchema.parse({ ...job(round(5)), acceptance, result: { ...job().result, delivery: { status: 'accepted', acceptance } } });
    assert.deepEqual(parsed.acceptance, acceptance);
    assert.deepEqual(parsed.result.delivery.acceptance, acceptance);
    assert.deepEqual(migrationPreviewSchema.parse({ job: job(), counts: { train: 2, calibration: 2, test: 2 }, acceptance, allow_jev_comparison: false }).acceptance, acceptance);
    assert.equal(submissionSchema.safeParse({ name: 'upgrade', acceptance: { ...acceptance, base_change: undefined }, allow_training_data_export: true }).success, false);
  }
  const acceptance = { min_accuracy: .8, min_brier_improvement: .01, previous_job_id: job().id };
  assert.deepEqual(submissionSchema.parse({ name: 'upgrade', acceptance, allow_training_data_export: true }).acceptance, acceptance);
});

test('migration responses cannot silently switch the source or target', async () => {
  const requestId = '30000000-0000-4000-8000-000000000003';
  const predecessor = job();
  for (const value of [
    { ...job(round(5)), dataset_source: { job_id: requestId, job_sha256: 'a'.repeat(64), request_id: requestId } },
    { ...job(), dataset_source: { job_id: predecessor.id, job_sha256: 'a'.repeat(64), request_id: requestId } },
  ]) {
    const api = trainingApi('https://training.example', { supabase: 'https://storage.example' }, async () => 'fixture', async () => new Response(JSON.stringify({ job: value })));
    await assert.rejects(api.migrate(predecessor.id, { model: round(5).id, request_id: requestId }), /did not match/);
  }
});

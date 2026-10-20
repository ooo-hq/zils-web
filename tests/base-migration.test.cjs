const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newerBase } = require('../.private/test-build/base-model.js');
const { jobSchema, submissionSchema, imageSubmissionSchema, trainingApi } = require('../.private/test-build/training.js');

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
  assert.equal(sent.acceptance.migration, undefined, 'customer migration keeps ordinary approval criteria');
  assert.equal(submissionSchema.safeParse({ ...input, acceptance: { ...acceptance, previous_job_id: undefined } }).success, false);
  assert.equal(submissionSchema.safeParse({ ...input, acceptance: { ...acceptance, base_change: false } }).success, false);
  assert.equal(imageSubmissionSchema.safeParse({ ...input, acceptance: { ...acceptance, previous_job_id: undefined }, image_intake: { version: 'zils-image-intake/v1', seed: 'test', snapshot_sha256: 'a'.repeat(64) } }).success, false);
});

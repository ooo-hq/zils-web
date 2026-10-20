const test = require('node:test');
const assert = require('node:assert/strict');
const { poolSelection, baseConfigSchema } = require('../.private/test-build/base-model.js');
const { submissionSchema, jobSchema, downloadFiles, isImageJob, trainingApi } = require('../.private/test-build/training.js');
const mini = { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B', max_input_tokens: 4096 };
const lite = { ...mini, id: 'd3-lite-0.8b-v1', name: 'd3-lite' };
const catalog = () => ({ model: mini, channels: { stable: mini, latest: mini }, pools: Object.fromEntries([['d3-mini', mini], ['d3-lite', lite]].map(([id, model]) => [id, { id, name: model.name, enabled: true, channels: { stable: model, latest: model }, availability: Object.fromEntries(['stable', 'latest'].map(c => [c, { training_enabled: true, serving_enabled: false, qualified: { training: true, serving: false }, max_input_tokens: 4096, inputs: { text: true, images: false, video: false } }])) }])) });

test('legacy discovery stays compatible and pool channels freeze the selected profile', () => {
  assert.deepEqual(poolSelection({ model: mini, channels: { stable: mini } }, 'd3-mini', 'stable', 'text'), {});
  const config = baseConfigSchema.parse(catalog());
  const selection = poolSelection(config, 'd3-lite', 'latest', 'text');
  assert.deepEqual(selection, { pool: 'd3-lite', base_channel: 'latest', model: lite.id });
  assert.equal(poolSelection(config, 'd3-mini', 'stable', 'text').model, mini.id);
  assert.equal(poolSelection(config, 'd3-lite', 'stable', 'images'), null);
  config.pools['d3-lite'].enabled = false;
  assert.equal(poolSelection(config, 'd3-lite', 'latest', 'text'), null);
  assert.equal(selection.model, lite.id);
});

test('submission and result schemas retain pool selection and distinguish text from image jobs', () => {
  const selection = { pool: 'd3-lite', base_channel: 'latest', model: lite.id };
  const input = submissionSchema.parse({ name: 'test', acceptance: { min_accuracy: .8, min_brier_improvement: .01 }, allow_training_data_export: true, ...selection });
  assert.equal(input.pool, selection.pool);
  assert.equal(input.base_channel, selection.base_channel);
  assert.equal(input.model, lite.id);
  const job = jobSchema.parse({ id: '10000000-0000-4000-8000-000000000001', name: 'test', status: 'uploading', model: { ...lite, base: 'vllm-sr/d3-lite', base_revision: 'a'.repeat(40), inputs: { images: 4, video: true } } });
  assert.equal(isImageJob(job), false);
  assert.deepEqual(downloadFiles(job), ['adapter_config.json', 'adapter_model.safetensors', 'model.json', 'release.json']);
  assert.equal(isImageJob({ ...job, image_intake: { version: 'zils-image-intake/v1' } }), true);
});

test('a create response cannot silently change the requested pool model', async () => {
  const api = trainingApi('https://training.example', { supabase: 'https://storage.example' }, async () => 'fixture', async () => new Response(JSON.stringify({ job: { id: '10000000-0000-4000-8000-000000000001', name: 'test', status: 'uploading', model: { ...mini, base: 'zils-ai/d3-mini-4.5b-v1', base_revision: 'a'.repeat(40) } }, uploads: Object.fromEntries(['train','calibration','test'].map(s=>[s,{uploaded:true}])) })));
  await assert.rejects(api.create({ name: 'test', model: lite.id, pool: 'd3-lite', acceptance: { min_accuracy: .8, min_brier_improvement: .01 }, allow_training_data_export: true }), /profile/);
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { storageLocations, storageUrl, uploadDescriptor } = require('../.private/test-build/storage.js');

const legacy = 'https://example.supabase.co';
const spaces = 'https://private.nyc3.digitaloceanspaces.com';
const generation = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
const asset = '33333333-3333-4333-8333-333333333333';
const logical = `zils-images/${owner}/${asset}/source`;
const locations = storageLocations(legacy, spaces);
const slot = () => ({ provider: 'spaces', url: `${spaces}/objects/${generation}/${logical}?uploadId=part-a&partNumber=1`, method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, expires_at: new Date(Date.now() + 60_000).toISOString() });

test('accepts private Spaces and deployment-overlap legacy grants', () => {
  assert.equal(uploadDescriptor(slot(), locations, 'image-upload').provider, 'spaces');
  const old = { url: `${legacy}/storage/v1/object/upload/sign/${logical}?token=fixture`, method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' } };
  assert.equal(uploadDescriptor(old, locations, 'image-upload').url, old.url);
});

test('rejects foreign locations, provider mismatch, multipart changes and extra headers', () => {
  const valid = slot();
  for (const change of [
    { url: valid.url.replace('private.nyc3', 'foreign.nyc3') },
    { url: valid.url.replace('https://', 'https://name:secret@') },
    { url: valid.url + '#fragment' },
    { url: valid.url.replace('partNumber=1', 'partNumber=2') },
    { url: valid.url + '&partNumber=1' },
    { url: valid.url + '&uploadId=other' },
    { url: valid.url.replace('uploadId=part-a', 'uploadId=') },
    { url: valid.url.replace('/source', '%2fsource') },
    { url: valid.url.replace('/source', '/x/../source') },
    { url: valid.url.replace('/source', '/%2e%2e/source') },
    { url: valid.url.replace('zils-images/', 'private-documents/') },
    { provider: 'supabase' },
    { provider: undefined },
    { expires_at: undefined },
    { expires_at: '2000-01-01T00:00:00Z' },
    { headers: { ...valid.headers, Authorization: 'secret' } },
    { headers: { ...valid.headers, 'x-amz-acl': 'public-read' } },
    { headers: { ...valid.headers, 'x-upsert': 'false' } },
    { method: 'POST' },
  ]) assert.throws(() => uploadDescriptor({ ...valid, ...change }, locations, 'image-upload'), JSON.stringify(change));
});

test('storage configuration requires exact origins', () => {
  for (const value of [spaces + '/objects', spaces + '?x=1', spaces + '#fragment', 'https://*.digitaloceanspaces.com', 'http://private.example']) {
    assert.throws(() => storageLocations(legacy, value));
  }
  assert.equal(storageLocations('http://127.0.0.1:8998').legacyOrigin, 'http://127.0.0.1:8998');
});

test('uploads and model downloads require their own namespace and path family', () => {
  const data = { ...slot(), url: `${spaces}/objects/${generation}/fez-training-data/${asset}/inputs/train.jsonl?uploadId=one&partNumber=1` };
  assert.equal(uploadDescriptor(data, locations, 'dataset-upload').url, data.url);
  assert.throws(() => uploadDescriptor(data, locations, 'image-upload'));
  assert.throws(() => uploadDescriptor(slot(), locations, 'dataset-upload'));
  const model = `${spaces}/objects/${generation}/fez-training-models/${asset}/releases/${owner}/adapter_model.safetensors?X-Amz-Signature=fixture`;
  assert.equal(storageUrl(model, locations, 'model-download').href, model);
  assert.throws(() => storageUrl(model + '&uploadId=one', locations, 'model-download'));
  assert.throws(() => storageUrl(model.replace('/releases/', '/candidates/'), locations, 'model-download'));
});

test('Spaces uploads omit account credentials and reject wrong destinations before sending', async () => {
  const { imageApi } = require('../.private/test-build/images.js');
  const calls = [];
  const api = imageApi('https://api.example', locations, async () => 'owner-session', async (url, options) => {
    calls.push({ url, options }); return new Response('', { status: 200 });
  });
  const file = new Blob(['photo']);
  await assert.rejects(api.upload({ ...slot(), url: slot().url.replace('private.nyc3', 'foreign.nyc3') }, file));
  assert.equal(calls.length, 0);
  await api.upload(slot(), file);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  assert.deepEqual(calls[0].options.headers, { 'Content-Type': 'application/octet-stream' });
});

test('API grants must name the image and job returned in the same response', async () => {
  const { imageApi } = require('../.private/test-build/images.js');
  const { trainingApi } = require('../.private/test-build/training.js');
  const image = imageApi('https://api.example', locations, async () => 'owner-session', async () => Response.json({ asset: { id: owner, state: 'uploading', expires_at: '2099-01-01T00:00:00Z' }, upload: slot() }));
  await assert.rejects(image.createAsset({ purpose: 'prediction', filename: 'photo.png', source_bytes: 3, source_sha256: 'a'.repeat(64) }));
  const training = trainingApi('https://api.example', locations, async () => 'owner-session', async () => Response.json({
    job: { id: owner, name: 'inspection', status: 'uploading' },
    uploads: Object.fromEntries(['train', 'calibration', 'test'].map(split => [split, { ...slot(), url: `${spaces}/objects/${generation}/fez-training-data/${asset}/inputs/${split}.jsonl?uploadId=one&partNumber=1` }])),
  }));
  await assert.rejects(training.create({ name: 'inspection', acceptance: { min_accuracy: .8, min_brier_improvement: .01 }, allow_training_data_export: true }));
});

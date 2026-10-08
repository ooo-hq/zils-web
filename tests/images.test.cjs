const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const compiled = '../.private/test-build/images.js';
function moduleUnderTest() {
  assert.ok(fs.existsSync(require('node:path').resolve(__dirname, compiled)), 'image API module missing');
  return require(compiled);
}
const id = '10000000-0000-4000-8000-000000000001';
const question = { type: 'choice', instructions: 'Inspect the item', criteria: { normal: null, damaged: null } };
const body = { model: 'image-stock', state: {}, questions: { inspection: question }, images: [{ asset_id: id }] };
const result = { model: 'image-stock', answers: { inspection: { type: 'choice', choice: 'damaged', probabilities: { normal: .4, damaged: .6 }, confidence: .1, unknown_probability: .5, abstained: true } }, usage: { input_tokens: 442, output_tokens: 0 } };

test('unknown is retained and always displayed as Needs review', () => {
  const { parseImageResponse, imageAnswerLabel } = moduleUnderTest();
  const parsed = parseImageResponse(result, body);
  assert.equal(parsed.answers.inspection.unknown_probability, .5);
  assert.equal(imageAnswerLabel(parsed.answers.inspection), 'Needs review');
  for (const change of [{ probabilities: { normal: .4, damaged: .7 } }, { unknown_probability: NaN }, { choice: 'foreign' }, { abstained: undefined }]) {
    assert.throws(() => parseImageResponse({ ...result, answers: { inspection: { ...result.answers.inspection, ...change } } }, body));
  }
});

test('uploads reject foreign origins, overwrites and redirects before sending bytes', async () => {
  const { imageApi } = moduleUnderTest();
  const calls = [];
  const request = async (url, options) => { calls.push({ url, options }); return new Response('{}', { status: 200 }); };
  const api = imageApi('https://api.example', 'https://storage.example', async () => 'session', request);
  const file = new File(['photo'], 'photo.png', { type: 'image/png' });
  const slot = { url: `https://storage.example/storage/v1/object/upload/sign/zils-images/owner/${id}/source?token=fixture`, method: 'PUT', headers: { 'x-upsert': 'false', 'Content-Type': 'application/octet-stream' } };
  await assert.rejects(api.upload({ ...slot, url: 'https://evil.example/photo' }, file));
  await assert.rejects(api.upload({ ...slot, headers: { 'x-upsert': 'true' } }, file));
  assert.equal(calls.length, 0);
  await api.upload(slot, file);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[0].options.headers['x-upsert'], 'false');
});

test('predictions use the current owner session and dedicated gateway route', async () => {
  const { imageApi } = moduleUnderTest();
  let token = 'first';
  const calls = [];
  const api = imageApi('https://api.example', 'https://storage.example', async () => token, async (url, options) => {
    calls.push({ url, options }); return Response.json(result);
  });
  await api.predict(body);
  token = 'refreshed';
  await api.predict(body);
  assert.deepEqual(calls.map(x => x.url), ['https://api.example/v1/image-decisions', 'https://api.example/v1/image-decisions']);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer refreshed');
});

test('native input limits explain how to correct the request', async () => {
  const { imageApi, ImageApiError } = moduleUnderTest();
  for (const [status, message] of [[413, /shorten.*context/i], [422, /shorter instructions/i]]) {
    const api = imageApi('https://api.example', 'https://storage.example', async () => 'session', async () => new Response('{}', { status }));
    await assert.rejects(api.predict(body), error => error instanceof ImageApiError && error.status === status && message.test(error.message));
  }
});

test('image payments preserve the billable meter and direct insufficient credit to billing', async () => {
  const { parseImageResponse, imageApi, ImageApiError } = moduleUnderTest();
  assert.equal(parseImageResponse({ ...result, usage: { ...result.usage, billable_input_tokens: 173 } }, body).usage.billable_input_tokens, 173);
  const api = imageApi('https://api.example', 'https://storage.example', async () => 'session', async () => new Response('{}', { status: 402 }));
  await assert.rejects(api.predict(body), error => error instanceof ImageApiError && error.status === 402 && /credit/i.test(error.message));
});

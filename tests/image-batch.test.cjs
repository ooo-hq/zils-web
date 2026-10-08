const { test } = require('node:test');
const assert = require('node:assert/strict');
const images = require('../.private/test-build/images.js');
const batch = () => require('../.private/test-build/image-batch.js');
const question = { type: 'choice', instructions: 'Inspect the item.', criteria: { normal: null, damaged: null } };
const response = { model: 'private-image', answers: { inspection: { type: 'choice', choice: 'damaged', probabilities: { normal: .2, damaged: .8 }, confidence: .8, unknown_probability: .02, abstained: false } }, usage: { input_tokens: 393, output_tokens: 0 } };
const rows = () => ['one.png', 'two.png', 'three.png'].map((name, i) => ({ id: String(i), filename: name, file: new File(['photo' + i], name, { type: 'image/png' }) }));
function service(failSecond = false, onPredict = () => {}) {
  let count = 0;
  const calls = [];
  const api = images.imageApi('https://api.example', 'https://storage.example', async () => 'owner-session', async (url, options) => {
    const path = new URL(url).pathname;
    const body = options.method === 'POST' ? JSON.parse(options.body) : null;
    calls.push({ method: options.method, path, body });
    if (path === '/v1/image-assets') {
      const id = `10000000-0000-4000-8000-${String(++count).padStart(12, '0')}`;
      return Response.json({ asset: { id, state: 'uploading', expires_at: '2099-01-01T00:00:00Z' }, upload: { url: `https://storage.example/storage/v1/object/upload/sign/zils-images/owner/${id}/source`, method: 'PUT', headers: { 'x-upsert': 'false', 'Content-Type': 'application/octet-stream' } } });
    }
    if (options.method === 'PUT') return Response.json({});
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (path.endsWith('/complete')) return Response.json({ id: path.split('/')[3], state: 'ready', expires_at: '2099-01-01T00:00:00Z' });
    onPredict();
    return failSecond && count === 2 ? new Response('{}', { status: 503 }) : Response.json(response);
  });
  return { api, calls };
}

test('a batch preserves file/result association, skips successes on retry and cleans up each upload', async () => {
  const { runImageBatch } = batch(), { api, calls } = service(true);
  const input = rows(), updates = [];
  input[0].response = response;
  await runImageBatch(input, { api, model: 'private-image', question, signal: new AbortController().signal, onResult: row => updates.push(row) });
  assert.equal(updates.length, 2);
  assert.equal(updates[0].filename, 'two.png');
  assert.equal(updates[0].response.answers.inspection.choice, 'damaged');
  assert.equal(updates[1].filename, 'three.png');
  assert.match(updates[1].error, /unavailable/);
  assert.equal(calls.filter(c => c.method === 'DELETE').length, 2);
  const sent = calls.filter(c => c.path === '/v1/image-decisions').map(c => c.body);
  assert.deepEqual(sent.map(c => c.model), ['private-image', 'private-image']);
  assert.deepEqual(sent.map(c => c.images[0].asset_id), ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002']);
  assert.ok(sent.every(c => !JSON.stringify(c).includes('.png')));
});

test('stopping a batch does not upload another image or publish a late response', async () => {
  const { runImageBatch } = batch(), controller = new AbortController();
  const { api, calls } = service(false, () => controller.abort()), updates = [];
  await assert.rejects(runImageBatch(rows(), { api, model: 'private-image', question, signal: controller.signal, onResult: row => updates.push(row) }), { name: 'AbortError' });
  assert.equal(updates.length, 0);
  assert.equal(calls.filter(c => c.path === '/v1/image-assets').length, 1);
  assert.equal(calls.filter(c => c.method === 'DELETE').length, 1);
});

test('one failed image does not discard other results or stop later images', async () => {
  const { runImageBatch } = batch(), { api } = service(true), results = [];
  await runImageBatch(rows(), { api, model: 'private-image', question, signal: new AbortController().signal, onResult: row => results.push(row) });
  assert.deepEqual(results.map(row => row.response ? 'completed' : 'failed'), ['completed', 'failed', 'completed']);
});

test('expired access pauses the batch before uploading more private files', async () => {
  const { runImageBatch } = batch(), calls = [], results = [];
  const api = images.imageApi('https://api.example', 'https://storage.example', async () => 'expired', async (url) => { calls.push(url); return new Response('{}', { status: 401 }); });
  await assert.rejects(runImageBatch(rows(), { api, model: 'private-image', question, signal: new AbortController().signal, onResult: row => results.push(row) }), /sign in again/);
  assert.equal(calls.length, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].filename, 'one.png');
});

test('CSV keeps review and failure states, escapes filenames and neutralizes spreadsheet formulas', () => {
  const csv = batch().imageBatchCsv([
    { ...rows()[0], filename: '=SUM(1,2).png', response },
    { ...rows()[1], response: { ...response, answers: { inspection: { ...response.answers.inspection, abstained: true } } } },
    { ...rows()[2], error: 'Upload interrupted' },
  ]);
  assert.match(csv, /"'=SUM\(1,2\).png"/);
  assert.match(csv, /"Needs review"/);
  assert.match(csv, /"Failed"/);
  assert.match(csv, /"Upload interrupted"/);
});

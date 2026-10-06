const { test } = require('node:test');
const assert = require('node:assert/strict');
const { playgroundConfig, infer } = require('../.private/test-build/playground-server.js');

const MODEL = 'zils-jevk5-v0.3-r1';

async function isolated(run) {
  const before = { ...process.env };
  const originalFetch = global.fetch;
  try {
    for (const key of Object.keys(process.env)) if (/^(ZILS|FEZ)_DECISION_/.test(key)) delete process.env[key];
    await run();
  } finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
}

test('the shared JevK5 playground requires both its endpoint and a server-side key', () => isolated(async () => {
  assert.deepEqual(playgroundConfig(), { configured: false, models: [{ id: MODEL, label: 'Zils shared · JevK5 4B' }] });
  process.env.ZILS_DECISION_API_URL = 'https://shared.example/v1/systemone';
  assert.equal(playgroundConfig().configured, false);
  global.fetch = () => { throw new Error('Must not send without credentials'); };
  await assert.rejects(infer({ model: MODEL }, new AbortController().signal), /not connected/);
  process.env.ZILS_DECISION_API_KEY = 'server-only-fixture';
  assert.equal(playgroundConfig().configured, true);
}));

test('explicit legacy or custom models are not labeled as the shared JevK5 release', () => isolated(async () => {
  process.env.FEZ_DECISION_MODEL = 'fez-0.8b-experimental';
  assert.equal(playgroundConfig().models[0].label, 'Zils 0.8B · experimental');
  process.env.ZILS_DECISION_MODEL = 'custom-release';
  assert.equal(playgroundConfig().models[0].label, 'custom-release');
}));

test('shared inference validates choice, yes/no and score answers and rejects a different model', () => isolated(async () => {
  Object.assign(process.env, { ZILS_DECISION_API_URL: 'https://shared.example/v1/systemone', ZILS_DECISION_API_KEY: 'server-only-fixture' });
  const request = { model: MODEL, state: 'A synthetic shipping question.', questions: {
    team: { type: 'choice', criteria: { shipping: 'Shipping', billing: 'Billing' } },
    urgent: { type: 'noul' },
    priority: { type: 'score', criteria: [{ label: 'Low' }, { label: 'High' }] },
  } };
  const result = { model: MODEL, answers: {
    team: { type: 'choice', choice: 'shipping', confidence: .9, probabilities: { shipping: .9, billing: .1 } },
    urgent: { type: 'noul', noul: .1 },
    priority: { type: 'score', score: .2, confidence: .8, probabilities: { 0: .8, 1: .2 }, legend: { 0: { label: 'Low' }, 1: { label: 'High' } } },
  }, usage: { input_tokens: 200, output_tokens: 0 } };
  global.fetch = async (url, options) => {
    assert.equal(url, process.env.ZILS_DECISION_API_URL);
    assert.equal(options.headers.Authorization, 'Bearer server-only-fixture');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), request);
    return Response.json(result);
  };
  assert.deepEqual(await infer(request, new AbortController().signal), result);
  result.latency_ms = 100;
  assert.equal((await infer(request, new AbortController().signal)).latency_ms, 100);
  result.latency_ms = -1;
  await assert.rejects(infer(request, new AbortController().signal), error => error.status === 502);
  delete result.latency_ms;
  result.model = 'another-model';
  await assert.rejects(infer(request, new AbortController().signal), error => error.status === 502);
  result.model = MODEL;
  delete result.answers.urgent;
  await assert.rejects(infer(request, new AbortController().signal), error => error.status === 502);
}));

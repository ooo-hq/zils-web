const { test } = require('node:test');
const assert = require('node:assert/strict');
const { authorizeModel, ownedModels, infer, userApiUrl } = require('../.private/test-build/playground-server.js');
const { curlCommand } = require('../.private/test-build/model-quickstart.js');

const SHARED = 'zils-shared-fixture-release';
const KEY = `zils_sk_${'a'.repeat(32)}_${'B'.repeat(43)}`;
const job = (id, state, overrides = {}) => ({ id, name: `run-${id.slice(0, 4)}`, status: 'completed', result: { delivery: { status: 'accepted' } }, workflow: { state, model_id: `acct-model-${id.slice(0, 4)}` }, ...overrides });
const jobs = { jobs: [], models: [
  job('11111111-1111-4111-8111-111111111111', 'ready', { workflow: { state: 'ready', model_id: 'acct-model-1111', model_name: 'support-router' } }),
  job('22222222-2222-4222-8222-222222222222', 'training'),
] };

async function isolated(run) {
  const before = { ...process.env };
  try {
    Object.assign(process.env, { ZILS_DECISION_MODEL: SHARED, ZILS_DECISION_API_URL: 'https://shared.example/v1/systemone', ZILS_DECISION_API_KEY: 'server-only-fixture', NEXT_PUBLIC_ZILS_TRAINING_API_URL: 'https://train.example', NEXT_PUBLIC_ZILS_API_URL: 'https://api.example' });
    await run();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
}

test('owned models come from the training API with the caller session and include only ready ones', () => isolated(async () => {
  const calls = [];
  const models = await ownedModels('session-token', async (url, init) => { calls.push([url, init.headers.Authorization]); return Response.json(jobs); });
  assert.deepEqual(calls, [['https://train.example/v1/jobs', 'Bearer session-token']]);
  assert.deepEqual(models, [{ id: 'acct-model-1111', label: 'support-router', own: true }]);
  await assert.rejects(ownedModels('expired', async () => new Response('{}', { status: 401 })), error => error.status === 401);
}));

test('the shared model needs no user key; other models must be owned and come with a valid key', () => isolated(async () => {
  const never = async () => { throw new Error('shared model must not look up jobs'); };
  assert.deepEqual(await authorizeModel(SHARED, 'session-token', null, never), {});
  const send = async () => Response.json(jobs);
  await assert.rejects(authorizeModel('someone-elses-model', 'session-token', KEY, send), error => error.status === 403);
  await assert.rejects(authorizeModel('acct-model-2222', 'session-token', KEY, send), error => error.status === 403);
  await assert.rejects(authorizeModel('acct-model-1111', 'session-token', null, send), error => error.status === 400);
  await assert.rejects(authorizeModel('acct-model-1111', 'session-token', 'not-a-key', send), error => error.status === 400);
  assert.deepEqual(await authorizeModel('acct-model-1111', 'session-token', KEY, send), { apiKey: KEY });
}));

test('own-model inference goes to the public API with the user key, never the server key', () => isolated(async () => {
  const originalFetch = global.fetch;
  const request = { model: 'acct-model-1111', state: 'A synthetic message.', questions: { urgent: { type: 'noul' } } };
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.example/v1/systemone');
      assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
      return Response.json({ model: request.model, answers: { urgent: { type: 'noul', noul: .2 } }, usage: { input_tokens: 9, output_tokens: 0 } });
    };
    assert.equal((await infer(request, new AbortController().signal, KEY)).answers.urgent.noul, .2);
    global.fetch = async () => new Response('{}', { status: 401 });
    await assert.rejects(infer(request, new AbortController().signal, KEY), error => error.status === 401 && /API key/.test(error.message) && !error.message.includes(KEY));
  } finally { global.fetch = originalFetch; }
  assert.equal(userApiUrl(), 'https://api.example');
}));

test('curl uses the public API, keeps the key in an environment variable and escapes quotes', () => {
  const command = curlCommand('https://api.example/', { model: 'm', state: "It's late", questions: {} });
  assert.match(command, /^curl https:\/\/api\.example\/v1\/systemone \\/);
  assert.match(command, /Authorization: Bearer \$ZILS_API_KEY/);
  assert.match(command, /It'\\''s late/);
  assert.doesNotMatch(command, /zils_sk_/);
});

test('an own model brings its saved questions, keeping only ones the playground can send', () => isolated(async () => {
  process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = 'https://training.example';
  const ready = { status: 'completed', result: { delivery: { status: 'accepted' } } };
  const jobs = { jobs: [
    { ...ready, name: 'a', workflow: { state: 'ready', model_id: 'm-a' }, question_schema: { team: { type: 'choice', instructions: 'Which team?', criteria: { x: 'X', y: 'Y' } }, broken: { type: 'choice' } } },
    { ...ready, name: 'b', workflow: { state: 'ready', model_id: 'm-b' }, question_schema: null },
  ] };
  const models = await ownedModels('session-token', async () => Response.json(jobs));
  assert.deepEqual(models[0].questions, { team: { type: 'choice', instructions: 'Which team?', criteria: { x: 'X', y: 'Y' } } });
  assert.equal('questions' in models[1], false);
}));

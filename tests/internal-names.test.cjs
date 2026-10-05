const { test } = require('node:test');
const assert = require('node:assert/strict');
const { trainingAuthStorageKey } = require('../.private/test-build/training-auth.js');
const { playgroundConfig, infer } = require('../.private/test-build/playground-server.js');
const storage = (entries) => ({ length: entries.length, key: index => entries[index], getItem: key => entries.includes(key) ? 'fixture' : null });

test('new sessions use Zils; active sessions and pending old logins keep one refresh lock', () => {
  assert.equal(trainingAuthStorageKey(storage([])), 'zils-training-auth');
  for (const key of ['fez-training-auth', 'fez-training-auth-code-verifier', 'fez-training-auth-flow-fixture-code-verifier', 'fez-training-auth-flows-code-verifier']) {
    assert.equal(trainingAuthStorageKey(storage([key])), 'fez-training-auth');
  }
  assert.equal(trainingAuthStorageKey(storage(['fez-training-auth', 'zils-training-auth'])), 'zils-training-auth');
  assert.equal(trainingAuthStorageKey({ get length() { throw Error('blocked'); }, getItem() { throw Error('blocked'); } }), 'zils-training-auth');
});

test('Zils inference settings take precedence, preserve old fallback, and allow explicit disabling', async () => {
  const before = { ...process.env };
  const originalFetch = global.fetch;
  try {
    for (const key of Object.keys(process.env)) if (/^(ZILS|FEZ)_DECISION_/.test(key)) delete process.env[key];
    Object.assign(process.env, { FEZ_DECISION_API_URL: 'https://legacy.example/infer', FEZ_DECISION_API_KEY: 'legacy-fixture', FEZ_DECISION_MODEL: 'legacy-model' });
    assert.equal(playgroundConfig().models[0].id, 'legacy-model');
    Object.assign(process.env, { ZILS_DECISION_API_URL: 'https://canonical.example/infer', ZILS_DECISION_API_KEY: 'canonical-fixture', ZILS_DECISION_MODEL: 'canonical-model' });
    assert.equal(playgroundConfig().models[0].id, 'canonical-model');
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://canonical.example/infer');
      assert.equal(options.headers.Authorization, 'Bearer canonical-fixture');
      return new Response('', { status: 503 });
    };
    await assert.rejects(infer({ model: 'canonical-model', state: {}, questions: {} }, new AbortController().signal), /unavailable/);
    process.env.ZILS_DECISION_API_URL = '';
    assert.equal(playgroundConfig().configured, false);
  } finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});

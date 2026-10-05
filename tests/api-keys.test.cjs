const test = require('node:test');
const assert = require('node:assert/strict');
const { apiKeysApi, decisionApiUrl, ApiKeyError } = require('../.private/test-build/api-keys.js');

const id = '8d36a658-4773-435f-bc96-3b42901baa9e';
const key = `zils_sk_${id.replaceAll('-', '')}_${'a'.repeat(43)}`;
const metadata = { id, name: 'Flight app', prefix: key.slice(0, 20), created_at: '2026-10-05T04:00:00+00:00', revoked_at: null };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('key lifecycle uses the current sign-in token and the configured decision service', async () => {
  const calls = [];
  let generation = 0;
  const api = apiKeysApi('https://api.example/decision/', async () => `session-${++generation}`, async (url, options) => {
    calls.push({ url, ...options });
    if (options.method === 'GET') return response({ keys: [metadata] });
    if (url.endsWith('/revoke')) return response({ ...metadata, revoked_at: '2026-10-05T04:01:00Z' });
    return response({ ...metadata, key }, 201);
  });
  assert.deepEqual(await api.list(), { keys: [metadata] });
  assert.equal((await api.create('  Flight app  ')).key, key);
  assert.equal((await api.revoke(id)).revoked_at, '2026-10-05T04:01:00Z');
  assert.deepEqual(calls.map(c => [c.url, c.method, c.headers.Authorization, c.body]), [
    ['https://api.example/decision/v1/keys', 'GET', 'Bearer session-1', undefined],
    ['https://api.example/decision/v1/keys', 'POST', 'Bearer session-2', '{"name":"Flight app"}'],
    [`https://api.example/decision/v1/keys/${id}/revoke`, 'POST', 'Bearer session-3', '{}'],
  ]);
  for (const call of calls) {
    assert.equal(call.cache, 'no-store');
    assert.equal(call.credentials, 'omit');
    assert.equal(call.redirect, 'error');
    assert.ok(call.signal instanceof AbortSignal);
  }
});

test('metadata responses discard secrets and digests', async () => {
  const api = apiKeysApi('https://api.example', async () => 'session', async () => response({ keys: [{ ...metadata, key, digest: 'sensitive-hash' }] }));
  assert.deepEqual(await api.list(), { keys: [metadata] });
});

test('invalid names, key IDs and missing sessions never send a request', async () => {
  let sent = 0;
  const request = async () => { sent++; return response({}); };
  const api = apiKeysApi('https://api.example', async () => 'session', request);
  await assert.rejects(api.create('   '));
  await assert.rejects(api.create('x'.repeat(81)));
  await assert.rejects(api.revoke('../another-account'));
  const signedOut = apiKeysApi('https://api.example', async () => '', request);
  await assert.rejects(signedOut.list(), error => error instanceof ApiKeyError && error.status === 401);
  assert.equal(sent, 0);
});

test('failed creation is not retried and errors do not expose response bodies', async () => {
  let attempts = 0;
  const api = apiKeysApi('https://api.example', async () => 'session', async () => { attempts++; throw new TypeError('private network details'); });
  await assert.rejects(api.create('Flight app'), error => error instanceof ApiKeyError && error.status === 0 && !error.message.includes('private network details'));
  assert.equal(attempts, 1);
  const broken = apiKeysApi('https://api.example', async () => 'session', async () => response({ key }, 500));
  await assert.rejects(broken.list(), error => error instanceof ApiKeyError && error.status === 500 && !error.message.includes(key));
});

test('expired sessions and malformed success responses fail explicitly', async () => {
  const expired = apiKeysApi('https://api.example', async () => 'expired-session', async () => response({ error: { message: 'expired' } }, 401));
  await assert.rejects(expired.list(), error => error instanceof ApiKeyError && error.status === 401);
  const malformed = apiKeysApi('https://api.example', async () => 'session', async () => response({ ...metadata, key: 'not-a-secret' }, 201));
  await assert.rejects(malformed.create('Flight app'), /unexpected response/i);
  const notRevoked = apiKeysApi('https://api.example', async () => 'session', async () => response(metadata));
  await assert.rejects(notRevoked.revoke(id), /revocation/i);
});

test('decision URL defaults to the hosted route and validates explicit overrides', () => {
  assert.equal(decisionApiUrl('https://training.example/'), 'https://training.example/decision');
  assert.equal(decisionApiUrl('https://training.example', 'https://api.example/customer/'), 'https://api.example/customer');
  assert.throws(() => decisionApiUrl('https://training.example', 'http://api.example'));
  assert.throws(() => apiKeysApi('https://user:password@api.example', async () => 'session'));
});

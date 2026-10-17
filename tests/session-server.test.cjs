const test = require('node:test');
const assert = require('node:assert/strict');
const { signedIn } = require('../.private/test-build/session-server.js');

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.example.invalid/';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable';
const request = authorization => new Request('https://zils.example.invalid/api/playground', { method: 'POST', headers: authorization ? { authorization } : {} });

test('a valid session token is confirmed with Supabase', async () => {
  const calls = [];
  const ok = await signedIn(request('Bearer good-token'), async (url, init) => { calls.push([url, init.headers]); return new Response('{}', { status: 200 }); });
  assert.equal(ok, true);
  assert.deepEqual(calls, [['https://auth.example.invalid/auth/v1/user', { apikey: 'publishable', Authorization: 'Bearer good-token' }]]);
});

test('missing, rejected, or unreachable sessions are refused', async () => {
  const never = async () => { throw new Error('should not be called'); };
  assert.equal(await signedIn(request(), never), false);
  assert.equal(await signedIn(request('Basic abc'), never), false);
  assert.equal(await signedIn(request('Bearer expired'), async () => new Response('{}', { status: 401 })), false);
  assert.equal(await signedIn(request('Bearer any'), async () => { throw new TypeError('offline'); }), false);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { authorizationReturnUrl, cliCallbackUrl, authorizationDetails } = require('../.private/test-build/cli-authorization.js');
const { signInWithGoogle } = require('../.private/test-build/training-auth.js');
const id = 'vabn6ktjrrtguq5usk5neuxumt3mpi6y';
const userId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const callback = 'http://127.0.0.1:43187/callback';

test('sign-in returns only to the same website and request', async () => {
  const path = `/cli/authorize?authorization_id=${id}`;
  assert.equal(authorizationReturnUrl('https://zils.ai', id), 'https://zils.ai' + path);
  for (const invalid of ['//attacker.example', id + '&x=1', '', 'a'.repeat(31), 'a'.repeat(33), userId, [id, id]]) assert.throws(() => authorizationReturnUrl('https://zils.ai', invalid));
  const calls = [];
  const client = { auth: { signInWithOAuth: async input => { calls.push(input); return {}; } } };
  await signInWithGoogle(client, 'https://zils.ai', path);
  assert.equal(calls[0].options.redirectTo, 'https://zils.ai' + path);
  for (const invalid of ['https://attacker.example', '//attacker.example', '/%2f/attacker.example', path + '#x', path + '&x=1']) assert.throws(() => signInWithGoogle(client, 'https://zils.ai', invalid));
});

test('only the registered CLI, request and signed-in account can show consent', () => {
  const details = { authorization_id: id, redirect_uri: callback, client: { id: clientId, name: 'Zils CLI' }, user: { id: userId, email: 'invited@example.com' }, scope: 'email' };
  assert.equal(authorizationDetails(details, clientId, id, userId).user.email, 'invited@example.com');
  for (const changed of [{ ...details, redirect_uri: 'https://attacker.example' }, { ...details, client: { id } }, { ...details, user: { id: clientId, email: 'other@example.com' } }, { ...details, authorization_id: clientId }, { ...details, scope: 'email phone' }]) assert.throws(() => authorizationDetails(changed, clientId, id, userId));
});

test('provider redirects allow only the exact loopback callback and bounded response', () => {
  for (const query of ['code=ok&state=expected', 'error=access_denied&state=expected']) assert.equal(cliCallbackUrl(callback + '?' + query), callback + '?' + query);
  for (const url of ['https://attacker.example?code=private-code', callback + '?code=a&code=b&state=s', callback + '?code=a&state=s#fragment', 'http://127.0.0.1:43187/a/../callback?code=a&state=s', callback + '?code=a', callback + '?code=a&state=s&token=secret', callback.replace('127.0.0.1', 'localhost') + '?code=a&state=s']) assert.throws(() => cliCallbackUrl(url));
});

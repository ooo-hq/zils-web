const test = require('node:test');
const assert = require('node:assert/strict');
const { handleContactRequest } = require('../.private/test-build/contact.js');
const config = { apiKey: 'test-only-key', from: 'forms@example.com', to: 'team@example.com' };
const input = { name: '  Ada  ', email: 'ada@example.com', company: 'Flight app', message: 'Can Zils help us prioritize flight disruptions?', website: '', requestId: '15f02874-8a2d-4fe7-8e93-98be21713d39' };
const request = (body = input, headers = {}) => new Request('https://zils.example/api/contact', { method: 'POST', headers: { host: 'zils.example', origin: 'https://zils.example', 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('contact sends plain text to the configured inbox with visitor Reply-To', async () => {
 let call;
 const response = await handleContactRequest(request(), config, async (url, options) => { call = { url, ...options }; return Response.json({ id: 'provider-message-id' }); });
 assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
 assert.equal(call.url, 'https://api.resend.com/emails');
 assert.equal(call.headers.Authorization, 'Bearer test-only-key');
 const email = JSON.parse(call.body);
 assert.deepEqual(email.to, ['team@example.com']); assert.equal(email.from, 'Zils <forms@example.com>'); assert.equal(email.reply_to, 'ada@example.com');
 assert.match(email.text, /Name: Ada/); assert.match(email.text, /flight disruptions/); assert.equal(email.html, undefined);
 assert.equal(call.redirect, 'error'); assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('retries deduplicate the same message while edits receive a different key', async () => {
 const keys = [];
 const send = async (_url, options) => { keys.push(options.headers['Idempotency-Key']); return Response.json({ id: 'sent' }); };
 await handleContactRequest(request(), config, send); await handleContactRequest(request(), config, send);
 await handleContactRequest(request({ ...input, message: 'A different question.' }), config, send);
 assert.equal(keys[0], keys[1]); assert.notEqual(keys[0], keys[2]); assert.ok(!keys[0].includes(input.email));
});

test('browser-valid email addresses reach delivery unchanged', async () => {
 for (const email of ['ada!ops@example.com', 'ada@example.xn--p1ai']) {
  let delivered;
  const response = await handleContactRequest(request({ ...input, email }), config, async (_url, options) => {
   delivered = JSON.parse(options.body).reply_to; return Response.json({ id: 'sent' });
  });
  assert.equal(response.status, 200); assert.equal(delivered, email);
 }
});

test('invalid fields, injection, foreign origins, and malformed input never send', async () => {
 let calls = 0; const send = async () => { calls++; throw new Error('must not send'); };
 for (const body of [{ ...input, name: '  ' }, { ...input, email: 'a@example.com\r\nBcc: other@example.com' }, { ...input, message: '  ' }, { ...input, message: 'x'.repeat(3001) }, { ...input, to: 'attacker@example.com' }, '{']) {
  assert.equal((await handleContactRequest(request(body), config, send)).status, 400);
 }
 assert.equal((await handleContactRequest(request(input, { origin: 'https://other.example' }), config, send)).status, 403);
 assert.equal((await handleContactRequest(request(input, { 'content-type': 'text/plain' }), config, send)).status, 415);
 assert.equal(calls, 0);
});

test('body limits and honeypot stop unwanted delivery', async () => {
 let calls = 0; const send = async () => { calls++; throw new Error('must not send'); };
 assert.equal((await handleContactRequest(request('x'.repeat(25_000)), config, send)).status, 413);
 const response = await handleContactRequest(request({ ...input, website: 'spam.example' }), config, send);
 assert.equal(response.status, 200); assert.equal(calls, 0);
});

test('missing configuration and provider failures never claim a message was sent', async () => {
 let calls = 0;
 const send = async () => { calls++; return Response.json({ error: 'secret provider details' }, { status: 500 }); };
 assert.equal((await handleContactRequest(request(), {}, send)).status, 503); assert.equal(calls, 0);
 for (const provider of [send, async () => Response.json({}), async () => { throw new Error('private failure'); }]) {
  const response = await handleContactRequest(request(), config, provider);
  assert.equal(response.status, 503); const body = await response.json(); assert.equal(body.ok, undefined); assert.ok(!JSON.stringify(body).includes('private')); assert.ok(!JSON.stringify(body).includes('secret'));
 }
});

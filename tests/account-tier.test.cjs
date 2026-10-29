const test = require('node:test');
const assert = require('node:assert/strict');
const { tierApi, TierError, parseTierState, canChooseFree, tierErrorAction, termsOutdated, TERMS_PATH } = require('../.private/test-build/account-tier.js');

const open = { tier: 'paid', free: { open: true, requests_per_minute: 60, tokens_per_day: 200000, terms_version: 'draft-2026-10-28' }, consent: null };
const closed = { ...open, free: { ...open.free, open: false } };
const consented = { ...open, tier: 'free', consent: { at: '2026-10-28T12:00:00Z', terms_version: 'draft-2026-10-28' } };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('parses open and closed state, consent null or present', () => {
  assert.deepEqual(parseTierState(open), open);
  assert.equal(parseTierState(closed).free.open, false);
  assert.equal(parseTierState(consented).consent.terms_version, 'draft-2026-10-28');
  assert.equal(parseTierState({ ...open, tier: 'gold' }), null);
  assert.equal(parseTierState({ tier: 'free' }), null);
  assert.equal(parseTierState(null), null);
});

test('consent gate: free needs a ticked box and an open tier', () => {
  assert.equal(canChooseFree(parseTierState(open), false), false);
  assert.equal(canChooseFree(parseTierState(open), true), true);
  assert.equal(canChooseFree(parseTierState(closed), true), false);
  assert.equal(canChooseFree(null, true), false);
});

test('error actions map the platform codes', () => {
  const err = (status, code) => new TierError('x', status, code);
  assert.equal(tierErrorAction(err(409, 'terms_changed')), 'ask_again');
  assert.equal(tierErrorAction(err(403, 'free_tier_closed')), 'closed');
  assert.equal(tierErrorAction(err(422, 'consent_required')), 'consent');
  assert.equal(tierErrorAction(err(500)), 'other');
  assert.equal(tierErrorAction(new Error('x')), 'other');
});

test('api calls GET and POST with the session token and maps error codes', async () => {
  const calls = [];
  const api = tierApi('https://api.example/decision/', async () => 'tok', async (url, o) => {
    calls.push([url, o.method, o.headers.Authorization, o.body]);
    return o.method === 'GET' ? reply(open) : reply(consented);
  });
  assert.deepEqual(await api.get(), open);
  assert.equal((await api.set('free', true, 'draft-2026-10-28')).tier, 'free');
  assert.deepEqual(calls, [
    ['https://api.example/decision/v1/account/tier', 'GET', 'Bearer tok', undefined],
    ['https://api.example/decision/v1/account/tier', 'POST', 'Bearer tok', JSON.stringify({ tier: 'free', consent: true, terms_version: 'draft-2026-10-28' })],
  ]);
  for (const [status, code] of [[409, 'terms_changed'], [403, 'free_tier_closed'], [422, 'consent_required']]) {
    const failing = tierApi('https://api.example/decision', async () => 'tok', async () => reply({ error: { code } }, status));
    await assert.rejects(failing.set('free', true, 'v'), e => e instanceof TierError && e.status === status && e.code === code);
  }
  const bad = tierApi('https://api.example/decision', async () => 'tok', async () => reply({ nope: 1 }));
  await assert.rejects(bad.get(), e => e.status === 502);
});

test('terms path is the draft terms page', () => assert.equal(TERMS_PATH, '/free-tier-terms'));

test('503 free_tier_unavailable has its own message and code', async () => {
  const api = tierApi('https://api.example/decision', async () => 'tok', async () => reply({ error: { code: 'free_tier_unavailable' } }, 503));
  await assert.rejects(api.get(), e => e.code === 'free_tier_unavailable' && e.message === 'Plans are unavailable right now. Try again later.');
});

test('a free customer who agreed to older terms must agree again', () => {
  assert.equal(termsOutdated(parseTierState(consented)), false);
  const old = { ...consented, consent: { at: 'x', terms_version: 'old' } };
  assert.equal(termsOutdated(parseTierState(old)), true);
  assert.equal(termsOutdated(parseTierState(open)), false);
  assert.equal(termsOutdated(parseTierState({ ...open, consent: { at: 'x', terms_version: 'old' } })), false);
  assert.equal(termsOutdated(null), false);
});

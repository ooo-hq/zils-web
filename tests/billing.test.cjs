const test = require('node:test');
const assert = require('node:assert/strict');
const { billingApi, BillingError, formatCredit, checkoutIntent, pendingCheckout, attachCheckout, settleCheckout } = require('../.private/test-build/billing.js');

const id = '8d36a658-4773-435f-bc96-3b42901baa9e';
const purchase = '91f22b36-83bd-5da1-90f8-a4b5dc8a6e52';
const summary = {
  mode: 'test', currency: 'usd', balance_nanos: '5000000000', reserved_nanos: '2000000000', available_nanos: '3000000000',
  free_training_runs: 1, topup_amounts_cents: [500, 2000, 5000, 10000],
  transactions: [{ id: 'ledger-1', kind: 'topup', amount_nanos: '5000000000', created_at: '2026-10-08T12:00:00Z', reference: id }],
  payments: [{ id: purchase, amount_cents: 500, status: 'paid', created_at: '2026-10-08T12:00:00Z', receipt_url: 'https://pay.stripe.com/receipts/payment/test' }],
};
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const memory = () => { const items = new Map(); return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) }; };

test('billing uses fresh session tokens, no cache, and the decision API endpoint contract', async () => {
  const calls = [];
  let generation = 0;
  const api = billingApi('https://api.example/decision/', async () => `session-${++generation}`, async (url, options) => {
    calls.push({ url, ...options });
    return response(options.method === 'GET' ? summary : { url: 'https://checkout.stripe.com/c/pay/test', purchase_id: purchase });
  });
  assert.deepEqual(await api.summary(), summary);
  assert.deepEqual(await api.checkout(500, id), { url: 'https://checkout.stripe.com/c/pay/test', purchase_id: purchase });
  assert.deepEqual(calls.map(call => [call.url, call.method, call.headers.Authorization, call.body]), [
    ['https://api.example/decision/v1/billing', 'GET', 'Bearer session-1', undefined],
    ['https://api.example/decision/v1/billing/checkout', 'POST', 'Bearer session-2', JSON.stringify({ amount_cents: 500, idempotency_key: id })],
  ]);
  for (const call of calls) { assert.equal(call.cache, 'no-store'); assert.equal(call.credentials, 'omit'); assert.equal(call.redirect, 'error'); assert.ok(call.signal instanceof AbortSignal); }
});

test('invalid amounts, IDs, and missing sessions cannot start checkout', async () => {
  let sent = 0;
  const request = async () => { sent++; return response({}); };
  const api = billingApi('https://api.example', async () => 'session', request);
  for (const amount of [0, 499, 500.5, 999999, NaN]) await assert.rejects(api.checkout(amount, id));
  await assert.rejects(api.checkout(500, '../purchase'));
  await assert.rejects(billingApi('https://api.example', async () => '', request).summary(), error => error instanceof BillingError && error.status === 401);
  assert.equal(sent, 0);
});

test('checkout redirects only to HTTPS Stripe Checkout without credentials or custom ports', async () => {
  for (const url of ['javascript:alert(1)', 'http://checkout.stripe.com/c/pay/x', 'https://checkout.stripe.com.evil.example/x', 'https://evil.example/checkout.stripe.com', 'https://user@checkout.stripe.com/x', 'https://checkout.stripe.com:444/x', '/relative']) {
    const api = billingApi('https://api.example', async () => 'session', async () => response({ url, purchase_id: purchase }));
    await assert.rejects(api.checkout(500, id), /unexpected response/i);
  }
});

test('malformed or inconsistent balances fail closed and unsafe receipt links are omitted', async () => {
  for (const patch of [{ available_nanos: '4000000000' }, { balance_nanos: 5000000000 }, { balance_nanos: 'not-a-number' }, { reserved_nanos: '1.5' }, { reserved_nanos: '-1' }, { free_training_runs: -1 }, { mode: 'sandbox' }, { topup_amounts_cents: [123] }]) {
    const api = billingApi('https://api.example', async () => 'session', async () => response({ ...summary, ...patch }));
    await assert.rejects(api.summary(), /unexpected response/i);
  }
  const api = billingApi('https://api.example', async () => 'session', async () => response({ ...summary, payments: [{ ...summary.payments[0], receipt_url: 'javascript:alert(1)' }] }));
  assert.equal((await api.summary()).payments[0].receipt_url, null);
});

test('failures use safe messages and uncertain checkout requests are never automatically retried', async () => {
  let attempts = 0;
  const api = billingApi('https://api.example', async () => 'session', async () => { attempts++; throw new Error('private details'); });
  await assert.rejects(api.checkout(500, id), error => error.status === 0 && !error.message.includes('private details'));
  assert.equal(attempts, 1);
  for (const status of [401, 403, 409, 429, 503]) {
    const failed = billingApi('https://api.example', async () => 'session', async () => response({ error: 'private details' }, status));
    await assert.rejects(failed.summary(), error => error instanceof BillingError && error.status === status && !error.message.includes('private details'));
  }
});

test('only a verified checkout_paid conflict exposes a terminal checkout code', async () => {
  for (const [status, code, expected] of [[409, 'checkout_paid', 'checkout_paid'], [503, 'checkout_paid', undefined], [409, 'private-diagnostic-code', undefined]]) {
    const api = billingApi('https://api.example', async () => 'session', async () => response({ error: { code, message: 'private-details' } }, status));
    await assert.rejects(api.checkout(500, id), error => error instanceof BillingError && error.code === expected && !error.message.includes('private-details'));
  }
});

test('legacy API-key authentication at the billing endpoint is a service error, not an expired session', async () => {
  const api = billingApi('https://api.example', async () => 'valid-user-session', async () => response({
    error: { code: 'invalid_credentials', message: 'API key is invalid or revoked.' },
  }, 401));
  await assert.rejects(api.summary(), error => error instanceof BillingError && error.code === 'billing_unavailable' && !/sign in/i.test(error.message));
  const expired = billingApi('https://api.example', async () => 'expired-user-session', async () => response({
    error: { code: 'service_unavailable', message: 'Your session has expired; sign in again.' },
  }, 401));
  await assert.rejects(expired.summary(), error => error.status === 401 && error.code === undefined && /sign in/i.test(error.message));
});

test('credit formatting preserves nano-dollar usage and values beyond safe Number precision', () => {
  assert.equal(formatCredit('5000000000'), '$5.00');
  assert.equal(formatCredit('4999999958'), '$4.999999958');
  assert.equal(formatCredit('-42'), '−$0.000000042');
  assert.equal(formatCredit('10000000000000000042'), '$10,000,000,000.000000042');
});

test('checkout intent persists across reloads and is isolated by account and mode', () => {
  const storage = memory();
  const scope = 'https://api.example:account-one:test';
  const intent = checkoutIntent(storage, scope, 500, () => id);
  assert.deepEqual(intent, { amount_cents: 500, idempotency_key: id });
  assert.deepEqual(checkoutIntent(storage, scope, 500, () => { throw new Error('must reuse'); }), intent);
  assert.deepEqual(pendingCheckout(storage, scope), intent);
  assert.equal(pendingCheckout(storage, 'https://api.example:account-two:test'), null);
  assert.equal(pendingCheckout(storage, 'https://api.example:account-one:live'), null);
  assert.throws(() => checkoutIntent(storage, scope, 2000, () => id), /continue/i);
  settleCheckout(storage, scope, summary.payments);
  assert.deepEqual(pendingCheckout(storage, scope), intent);
  attachCheckout(storage, scope, purchase);
  settleCheckout(storage, scope, [{ ...summary.payments[0], status: 'pending' }]);
  assert.deepEqual(pendingCheckout(storage, scope), { ...intent, purchase_id: purchase });
  settleCheckout(storage, scope, summary.payments);
  assert.equal(pendingCheckout(storage, scope), null);
});

test('blocked browser storage prevents starting an unrepeatable checkout', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
  assert.throws(() => checkoutIntent(storage, 'scope', 500, () => id), /browser storage/i);
});

test('usage totals preserve large counts and tiny charges, reject malformed values, and remain optional', async () => {
  const usage = { since: '2026-09-08T12:00:00Z', until: '2026-10-08T12:00:00Z', calls: '9007199254740993', failed_calls: '0', active_calls: '0', input_tokens: '90071992547409930', training_runs: '1', failed_training_runs: '0', active_training_runs: '0', inference_spend_nanos: '42', training_spend_nanos: '0', models: [] };
  const api = value => billingApi('https://api.example', async () => 'session', async () => response({ ...summary, usage: value }));
  assert.deepEqual((await api(usage).summary()).usage, usage);
  assert.equal((await api(undefined).summary()).usage, undefined);
  for (const patch of [{ calls: -1 }, { calls: '-1' }, { input_tokens: '1.2' }, { inference_spend_nanos: '-42' }, { since: 'yesterday' }]) {
    await assert.rejects(api({ ...usage, ...patch }).summary(), /unexpected response/);
  }
});

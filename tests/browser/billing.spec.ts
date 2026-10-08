import { test, expect, type Page } from '@playwright/test';

const purchase = '91f22b36-83bd-5da1-90f8-a4b5dc8a6e52';
const summary = {
  mode: 'test', currency: 'usd', balance_nanos: '1500000000', reserved_nanos: '500000000', available_nanos: '1000000000',
  free_training_runs: 1, topup_amounts_cents: [500, 2000, 5000, 10000],
  transactions: [{ id: 'ledger-1', kind: 'inference', amount_nanos: '-42', created_at: '2026-10-08T12:00:00Z', reference: 'request-1' }],
  payments: [{ id: purchase, amount_cents: 500, status: 'paid', created_at: '2026-10-08T12:00:00Z', receipt_url: 'https://pay.stripe.com/receipts/payment/test' }],
};

async function billing(page: Page, options: { signedIn?: boolean; mode?: string; billingAuth?: 'legacy' | 'expired'; checkout?: 'fail' | 'unsafe' | 'expired' | 'paid' | 'conflict'; training402?: boolean } = {}) {
  const user = { id: '10000000-0000-4000-8000-000000000002', email: 'client@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString('base64url')}.browser-test`;
  if (options.signedIn !== false) await page.addInitScript(({ user, token, expires }) => {
    localStorage.setItem('zils-training-auth', JSON.stringify({ user, access_token: token, refresh_token: 'browser-test', token_type: 'bearer', expires_in: 3600, expires_at: expires }));
  }, { user, token, expires });
  const checkouts: { amount_cents: number; idempotency_key: string }[] = [];
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests.push(url.pathname);
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user, headers });
    if (url.pathname === '/v1/jobs') return route.fulfill({ json: { jobs: options.training402 ? [{ id: purchase, name: 'Saved training run', status: 'uploading' }] : [] }, headers });
    if (url.pathname === `/v1/jobs/${purchase}/submit`) return route.fulfill({ status: 402, json: { error: 'Add credit before submitting this job.' }, headers });
    if (url.pathname === '/v1/billing') {
      if (options.billingAuth) return route.fulfill({ status: 401, json: { error: {
        code: options.billingAuth === 'legacy' ? 'invalid_credentials' : 'service_unavailable',
        message: options.billingAuth === 'legacy' ? 'API key is invalid or revoked.' : 'Your session has expired; sign in again.',
      } }, headers });
      return route.fulfill({ json: { ...summary, mode: options.mode || 'test' }, headers });
    }
    if (url.pathname === '/v1/billing/checkout') {
      checkouts.push(route.request().postDataJSON());
      if (options.checkout === 'expired') return route.fulfill({ status: 410, json: {}, headers });
      if (options.checkout === 'paid' || options.checkout === 'conflict') return route.fulfill({ status: 409, json: { error: { code: options.checkout === 'paid' ? 'checkout_paid' : 'idempotency_conflict' } }, headers });
      if (options.checkout === 'unsafe') return route.fulfill({ json: { url: 'https://evil.example/checkout', purchase_id: purchase }, headers });
      return route.fulfill({ status: 503, json: { error: 'private-provider-details' }, headers });
    }
    return route.fulfill({ status: 404, json: {}, headers });
  });
  return { checkouts, requests, errors };
}

test('signed-out billing offers existing sign-in and never requests private balances', async ({ page }) => {
  const { requests } = await billing(page, { signedIn: false });
  await page.goto('/billing');
  await expect(page.getByRole('heading', { name: 'Sign in to view billing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add $5', exact: true })).toHaveCount(0);
  expect(requests).not.toContain('/v1/billing');
});

test('unavailable billing keeps the valid workspace session and never asks for another sign-in', async ({ page }) => {
  const { requests } = await billing(page, { billingAuth: 'legacy' });
  await page.goto('/billing');
  await expect(page.locator('main').getByRole('alert')).toHaveText('Billing is not connected on this site yet. Please try again later.');
  await expect(page.getByRole('link', { name: 'Sign in again', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add $5', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Your workspace', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Train a model', exact: true })).toBeVisible();
  expect(requests).not.toContain('/auth/v1/logout');
});

test('an expired billing session still offers a sign-in link', async ({ page }) => {
  await billing(page, { billingAuth: 'expired' });
  await page.goto('/billing');
  await expect(page.locator('main').getByRole('alert')).toContainText('Your session has expired.');
  await expect(page.getByRole('link', { name: 'Sign in again', exact: true })).toBeVisible();
});

test('billing shows exact server balances, reservations, allowance, receipts and test-only amounts', async ({ page }) => {
  const { errors } = await billing(page);
  await page.goto('/billing');
  await expect(page.getByRole('heading', { name: 'Test mode', exact: true })).toBeVisible();
  await expect(page.getByText('$1.00', { exact: true })).toBeVisible();
  await expect(page.getByText('$0.50', { exact: true })).toBeVisible();
  await expect(page.getByText('1 standard run available', { exact: true })).toBeVisible();
  await expect(page.getByText('Low credit', { exact: true })).toBeVisible();
  await expect(page.getByText('−$0.000000042', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Receipt' })).toHaveAttribute('href', 'https://pay.stripe.com/receipts/payment/test');
  for (const amount of [5, 20, 50, 100]) await expect(page.getByRole('button', { name: `Add $${amount}`, exact: true })).toBeEnabled();
  await page.screenshot({ path: '.private/billing-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Billing', exact: true })).toHaveAttribute('href', '/billing');
  expect(errors).toEqual([]);
});

test('returning from checkout does not invent credit and mobile layout stays within viewport', async ({ page }) => {
  await billing(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/billing?checkout=success');
  await expect(page.getByText(/Credit is added only after payment is confirmed/)).toBeVisible();
  await expect(page.getByText('$1.00', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.private/billing-mobile.png', fullPage: true });
  await page.goto('/billing?checkout=cancelled');
  await expect(page.getByText(/Checkout was cancelled/)).toBeVisible();
  await expect(page.getByText('$1.00', { exact: true })).toBeVisible();
});

test('uncertain checkout reuses persisted idempotency key after reload and locks other amounts', async ({ page }) => {
  const { checkouts } = await billing(page, { checkout: 'fail' });
  await page.goto('/billing');
  await page.getByRole('button', { name: 'Add $20', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('not configured');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add $5', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Continue $20 checkout', exact: true }).click();
  await expect.poll(() => checkouts.length).toBe(2);
  expect(checkouts[0]).toEqual(checkouts[1]);
  expect(checkouts[0].idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
});

test('unsafe checkout links do not navigate away and verified expiry unlocks a new amount', async ({ page }) => {
  await billing(page, { checkout: 'unsafe' });
  await page.goto('/billing');
  await page.getByRole('button', { name: 'Add $5', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('unexpected response');
  await expect(page).toHaveURL(/\/billing$/);
  await page.unroute('**/*');
  await billing(page, { checkout: 'expired' });
  await page.getByRole('button', { name: 'Continue $5 checkout', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('expired');
  await expect(page.getByRole('button', { name: 'Add $20', exact: true })).toBeEnabled();
});

test('off or live backend cannot enable checkout through the test preview', async ({ page }) => {
  await billing(page, { mode: 'live' });
  await page.goto('/billing');
  await expect(page.getByText(/Top-ups are unavailable in this preview/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add $5', exact: true })).toBeDisabled();
});

test('training preview explains reservation and links an insufficient-credit error to billing', async ({ page }) => {
  await billing(page, { training402: true });
  await page.goto('/train');
  await expect(page.getByText(/Submitting a standard run reserves one included run or \$2 in test credit/)).toBeVisible();
  await page.getByRole('button', { name: 'Retry submission', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Add credit before submitting this job.');
  await expect(page.locator('main').getByRole('alert').getByRole('link', { name: 'Add credit' })).toHaveAttribute('href', '/billing');
});

test('verified already-paid retry clears uncertain checkout while ordinary conflicts keep it', async ({ page }) => {
  await billing(page, { checkout: 'conflict' });
  await page.goto('/billing');
  await page.getByRole('button', { name: 'Add $5', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('could not be continued');
  await expect(page.getByRole('button', { name: 'Add $20', exact: true })).toBeDisabled();
  await page.unroute('**/*');
  const { requests } = await billing(page, { checkout: 'paid' });
  await page.getByRole('button', { name: 'Continue $5 checkout', exact: true }).click();
  await expect(page.getByText('Payment already confirmed.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add $20', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Continue $5 checkout', exact: true })).toHaveCount(0);
  expect(requests).toContain('/v1/billing');
});

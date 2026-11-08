import { test, expect, type Page } from '@playwright/test';

// All service requests are intercepted; nothing reaches a real coordinator or sends an email.
const id = '10000000-0000-4000-8000-000000000009';
const owner = '20000000-0000-4000-8000-000000000002';
function session() {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: owner, email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  return { user, access_token: `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, exp: expires })).toString('base64url')}.browser-test`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires };
}
async function fixture(page: Page, job: Record<string, unknown>) {
  await page.addInitScript(value => { localStorage.setItem('zils-training-auth', JSON.stringify(value)); localStorage.setItem('zils-welcome-seen', '1'); }, session());
  const current: Record<string, unknown> = { id, name: 'ticket-team', created_at: '2026-11-08T20:55:47Z', error: null, result: null, workflow: null, ...job };
  const notified: unknown[] = [];
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: session().user, headers });
    if (url.pathname === '/v1/jobs') return route.fulfill({ json: { jobs: [current], models: [] }, headers });
    if (url.pathname === `/v1/jobs/${id}`) return route.fulfill({ json: { job: current }, headers });
    if (url.pathname === `/v1/jobs/${id}/notify` && req.method() === 'POST') {
      const body = req.postDataJSON();
      notified.push(body);
      current.email_when_done = body.email_when_done;
      return route.fulfill({ json: { job: current }, headers });
    }
    if (url.pathname === '/v1/billing') return route.fulfill({ json: { mode: 'test', currency: 'usd', balance_nanos: '0', reserved_nanos: '0', available_nanos: '0', free_training_runs: 0, topup_amounts_cents: [500], transactions: [], payments: [] }, headers });
    if (url.pathname === '/v1/keys') return route.fulfill({ json: { keys: [] }, headers });
    if (url.pathname === '/v1/image-models') return route.fulfill({ json: { training_enabled: false, models: [] }, headers });
    return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' }, headers });
  });
  return { notified };
}

test('an unfinished run can email its owner when it finishes, and the choice can be undone', async ({ page }) => {
  const { notified } = await fixture(page, { status: 'running', email_when_done: false, email_sent: false });
  await page.goto(`/train?run=${id}`);
  const box = page.getByRole('checkbox', { name: 'Email me when this run finishes' });
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(box).toBeChecked();
  await expect(page.getByText('We’ll email your account address once, when this run finishes.')).toBeVisible();
  await page.screenshot({ path: '.private/run-email.png', animations: 'disabled' });
  await box.uncheck();
  await expect(box).not.toBeChecked();
  expect(notified).toEqual([{ email_when_done: true }, { email_when_done: false }]);
});

test('a finished run says the email was sent and offers no checkbox', async ({ page }) => {
  await fixture(page, { status: 'failed', error: 'Processing failed.', email_when_done: true, email_sent: true });
  await page.goto(`/train?run=${id}`);
  await expect(page.getByText('We emailed you when this run finished.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Email me when this run finishes' })).toHaveCount(0);
});

test('a coordinator that does not report the setting shows no checkbox', async ({ page }) => {
  await fixture(page, { status: 'running' });
  await page.goto(`/train?run=${id}`);
  await expect(page.getByRole('heading', { name: 'Your model is being trained.' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Email me when this run finishes' })).toHaveCount(0);
});

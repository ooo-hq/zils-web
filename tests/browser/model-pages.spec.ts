import { test, expect, type Page } from '@playwright/test';

const id = '10000000-0000-4000-8000-000000000001';
const owner = '20000000-0000-4000-8000-000000000002';
const modelId = 'support-version-immutable';
const path = `/train/models/${id}`;
const policy = { min_accuracy: .8, min_brier_improvement: .01 };
const job = {
  id, name: 'support-routing', status: 'completed', created_at: '2026-10-09T12:00:00Z',
  workflow: { state: 'ready', model_id: modelId, model_name: 'support-routing-v1' },
  result: {
    delivery: { status: 'accepted', uid: 2, sha256: 'a'.repeat(64), acceptance: policy },
    baseline: { accuracy: .7, brier: .31, skill: .3 },
    miners: [{ uid: 1, status: 'evaluated', accuracy: .99, brier: .29 }, { uid: 2, status: 'evaluated', accuracy: .91, brier: .17, count: 80 }], weights: {},
  },
};
const usage = {
  since: '2026-09-09T12:00:00Z', until: '2026-10-09T12:00:00Z', calls: '5012', failed_calls: '1', active_calls: '0', input_tokens: '6000', unmetered_calls: '0',
  training_runs: '2', failed_training_runs: '0', active_training_runs: '0', inference_spend_nanos: '51000000', training_spend_nanos: '0',
  models: [
    { model_id: modelId, model_name: 'support-routing-v1', calls: '12', failed_calls: '1', active_calls: '0', input_tokens: '1000', spend_nanos: '1000000' },
    { model_id: 'another-version', model_name: 'support-routing-v1', calls: '5000', failed_calls: '0', active_calls: '0', input_tokens: '5000', spend_nanos: '50000000' },
  ],
};
function session(userId: string) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: userId, email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  return { user, access_token: `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: expires })).toString('base64url')}.browser-test`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires };
}
async function fixture(page: Page, options: { signedOut?: boolean; denied?: boolean; unapproved?: boolean; activating?: boolean; image?: boolean; missingSelected?: boolean; usage?: 'failed' | 'missing' | 'empty'; hold?: boolean } = {}) {
  if (!options.signedOut) await page.addInitScript(value => localStorage.setItem('zils-training-auth', JSON.stringify(value)), session(owner));
  const requests: string[] = [], writes: string[] = [];
  let release: (() => void) | undefined;
  const current = {
    ...job,
    ...(options.image ? { model: { id: 'imajev-4b-v1', name: 'Imajev 4B', base: 'Qwen/Qwen3.5-4B', base_revision: 'a'.repeat(40) } } : {}),
    workflow: { ...job.workflow, state: options.activating ? 'activating' : 'ready' },
    result: { ...job.result, delivery: { ...job.result.delivery, uid: options.missingSelected ? undefined : 2, status: options.unapproved ? 'no_qualifying_model' : 'accepted' } },
  };
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests.push(url.pathname);
    if (req.method() !== 'GET') writes.push(url.pathname);
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: session(owner).user, headers });
    const encoded = (req.headers().authorization || '').split('.')[1];
    const sub = encoded ? JSON.parse(Buffer.from(encoded, 'base64url').toString()).sub : '';
    if (options.denied || sub !== owner) return route.fulfill({ status: 404, json: { error: 'Not found' }, headers });
    if (url.pathname === '/v1/jobs') return route.fulfill({ json: { jobs: [current], models: [current] }, headers });
    if (url.pathname === `/v1/jobs/${id}`) {
      if (options.hold) await new Promise<void>(resolve => { release = resolve; });
      return route.fulfill({ json: { job: current }, headers }).catch(() => {});
    }
    if (url.pathname === '/v1/billing') {
      if (options.usage === 'failed') return route.fulfill({ status: 503, json: {}, headers });
      return route.fulfill({ json: { mode: 'test', currency: 'usd', balance_nanos: '0', reserved_nanos: '0', available_nanos: '0', free_training_runs: 0, topup_amounts_cents: [500], transactions: [], payments: [], usage: options.usage === 'missing' ? undefined : options.usage === 'empty' ? { ...usage, models: [] } : usage }, headers });
    }
    if (url.pathname === '/v1/keys') return route.fulfill({ json: { keys: [] }, headers });
    if (url.pathname === '/v1/image-models') return route.fulfill({ json: { training_enabled: false, models: [{ name: modelId, stock: false, capabilities: { modalities: ['image', 'text'] }, task: { question: { type: 'choice', instructions: 'Inspect the connector.', criteria: { Normal: null, Damaged: null } }, outcome_order: ['Normal', 'Damaged'] } }] }, headers });
    return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' }, headers });
  });
  return { requests, writes, release: () => release?.() };
}

test('workspace links to private model stats, exact-version usage, and runnable API examples', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 1050 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const control = await fixture(page);
  await page.goto('/train');
  await page.getByRole('region', { name: 'Your models' }).getByRole('link', { name: 'View model', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole('heading', { name: job.name, level: 1 })).toBeVisible();
  const results = page.getByRole('region', { name: 'How this model performed' });
  await expect(results.getByText('91.00%', { exact: true })).toBeVisible();
  await expect(results.getByText('99.00%', { exact: true })).toHaveCount(0);
  await expect(results.getByText('0.1700', { exact: true })).toBeVisible();
  await expect(results.getByText('80', { exact: true })).toBeVisible();
  const usage = page.getByRole('region', { name: 'API usage', exact: true });
  await expect(usage.getByText('12', { exact: true })).toBeVisible();
  await expect(usage.getByText('1,000', { exact: true })).toBeVisible();
  await expect(usage.getByText('$0.001', { exact: true })).toBeVisible();
  await expect(usage.getByText('5,000', { exact: true })).toHaveCount(0);
  await expect(usage).toContainText('Test mode');
  await page.screenshot({ path: '.private/model-page-preview.png' });
  await page.screenshot({ path: '.private/model-page-desktop.png', fullPage: true });
  const access = page.getByRole('region', { name: 'Access this model' });
  await access.getByRole('button', { name: 'Copy code', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('"model": "support-routing-v1"');
  await access.getByRole('button', { name: 'JavaScript', exact: true }).click();
  await expect(access.getByLabel('Example code')).toContainText('http://127.0.0.1:8999/v1/systemone');
  await access.getByRole('button', { name: 'API keys', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('heading', { name: job.name, level: 1 })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.private/model-page-mobile.png', fullPage: true });
  const html = await (await page.request.get(path)).text();
  expect(html).not.toContain(modelId);
  expect(html).not.toContain(job.name);
  expect(control.writes).toEqual([]);
});

test('signed-out visitors and other owners never see private model data', async ({ page }) => {
  const control = await fixture(page, { signedOut: true });
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Sign in to view this model' })).toBeVisible();
  expect(control.requests).not.toContain(`/v1/jobs/${id}`);
  await page.evaluate(value => {
    const channel = new BroadcastChannel('zils-training-auth');
    channel.postMessage({ event: 'SIGNED_IN', session: value });
    setTimeout(() => channel.close(), 100);
    localStorage.setItem('zils-training-auth', JSON.stringify(value));
  }, session('30000000-0000-4000-8000-000000000003'));
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('This model is not available to this account.');
  await expect(page.getByText(job.name, { exact: true })).toHaveCount(0);
  expect(control.requests).not.toContain('/v1/billing');
});

test('changing accounts during loading cannot display the previous owner’s model', async ({ page }) => {
  const control = await fixture(page, { hold: true });
  await page.goto(path);
  await expect.poll(() => control.requests.includes(`/v1/jobs/${id}`)).toBe(true);
  await page.evaluate(value => {
    localStorage.setItem('zils-training-auth', JSON.stringify(value));
    const channel = new BroadcastChannel('zils-training-auth');
    channel.postMessage({ event: 'TOKEN_REFRESHED', session: value });
    setTimeout(() => channel.close(), 100);
  }, session('30000000-0000-4000-8000-000000000003'));
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('This model is not available to this account.');
  control.release();
  await expect(page.getByText(job.name, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Access this model' })).toHaveCount(0);
});

test('activation and approval are distinct: accepted stats are visible before API access', async ({ page }) => {
  const control = await fixture(page, { activating: true });
  await page.goto('/train');
  await page.getByRole('link', { name: 'View model stats and access' }).click();
  await expect(page.getByRole('region', { name: 'Model activation' })).toContainText('Preparing API access');
  await expect(page.getByText('91.00%', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Access this model' })).toHaveCount(0);
  expect(control.requests).not.toContain('/v1/billing');
});

test('unapproved and invalid model links do not expose scores or API instructions', async ({ page }) => {
  const control = await fixture(page, { unapproved: true });
  await page.goto(path);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('does not have an approved model');
  await expect(page.getByRole('region', { name: 'How this model performed' })).toHaveCount(0);
  expect(control.requests).not.toContain('/v1/billing');
  const response = await page.goto('/train/models/not-a-valid-id');
  expect(response?.status()).toBe(404);
  expect(control.requests).not.toContain('/v1/jobs/not-a-valid-id');
});

for (const state of ['failed', 'missing', 'empty'] as const) test(`usage ${state} never invents numbers or blocks model access`, async ({ page }) => {
  await fixture(page, { usage: state });
  await page.goto(path);
  const usage = page.getByRole('region', { name: 'API usage', exact: true });
  await expect(usage).toContainText(state === 'failed' ? 'Usage could not be loaded' : state === 'missing' ? 'Usage reporting is not available' : 'No recorded API usage');
  await expect(usage.getByText('Completed calls', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Example code')).toBeVisible();
});

test('missing selected-candidate scores never display another candidate as the approved model', async ({ page }) => {
  await fixture(page, { missingSelected: true });
  await page.goto(path);
  const results = page.getByRole('region', { name: 'How this model performed' });
  await expect(results.getByText('Not recorded', { exact: true })).toHaveCount(3);
  await expect(results.getByText('99.00%', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Example code')).toBeVisible();
});

test('approved image models retain their saved task and image API access', async ({ page }) => {
  const control = await fixture(page, { image: true });
  await page.goto(path);
  await page.getByText('Image evaluation details', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Image evaluation results' })).toBeVisible();
  const access = page.getByRole('region', { name: 'Access this model' });
  await expect(access.getByRole('button', { name: 'API keys' })).toBeVisible();
  await access.getByRole('button', { name: 'Use your model', exact: true }).click();
  await expect(access.getByRole('button', { name: 'One image', exact: true })).toBeVisible();
  await access.getByText('Use from your application', { exact: true }).click();
  await expect(access.locator('pre')).toContainText('"model": "support-version-immutable"');
  await expect(access.locator('pre')).toContainText('Inspect the connector.');
  await expect(access.locator('pre')).toContainText('YOUR_FINALIZED_ASSET_ID');
  expect(control.writes).toEqual([]);
});

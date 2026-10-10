import { test, expect, type Page } from '@playwright/test';

const id = '10000000-0000-4000-8000-000000000001';
const modelId = `zils-adapter-${id}-${'a'.repeat(64)}`;
async function workspace(page: Page, state = 'ready', withModels = false, index = false) {
  const user = { id: '10000000-0000-4000-8000-000000000002', email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString('base64url')}.browser-test`;
  await page.addInitScript(({ user, token, expires }) => {
    localStorage.setItem('zils-training-auth', JSON.stringify({ user, access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires }));
  }, { user, token, expires });
  const job = { id, name: 'support-actions', status: 'completed', workflow: { state, model_id: modelId }, result: { delivery: { status: 'accepted', uid: 1, acceptance: { min_accuracy: .8, min_brier_improvement: .01 } }, baseline: { accuracy: .8125, brier: .314, skill: .3 }, miners: [{ uid: 1, status: 'evaluated', accuracy: .9375, brier: .210 }], weights: {} } };
  const modelJobs = [
    { ...job, workflow: { ...job.workflow, model_name: 'support-actions-10000000' } },
    { ...job, id: '20000000-0000-4000-8000-000000000001', name: 'invoice-checking', workflow: { state: 'ready', model_id: 'invoice-immutable-id', model_name: 'invoice-checking-20000000' } },
    { ...job, id: '30000000-0000-4000-8000-000000000001', name: 'still-activating', workflow: { state: 'activating', model_id: 'pending-model' } },
  ];
  const writes: string[] = [];
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (req.method() !== 'GET') writes.push(url.pathname);
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user, headers });
    if (url.pathname === '/v1/jobs') return route.fulfill({ json: withModels ? { jobs: [modelJobs[0], modelJobs[2]], models: modelJobs.slice(0, 2) } : { jobs: [job] }, headers });
    if (url.pathname.startsWith('/v1/jobs/')) {
      const selected = (withModels ? modelJobs : [job]).find(item => url.pathname === `/v1/jobs/${item.id}`);
      return route.fulfill({ status: selected ? 200 : 404, json: selected ? { job: selected } : { error: 'Not found' }, headers });
    }
    if (url.pathname === '/v1/keys') return route.fulfill({ json: { keys: [] }, headers });
    return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' }, headers });
  });
  await page.goto(index ? '/train' : `/train?run=${id}`);
  return writes;
}

test('ready model has copyable ID, runnable examples, download, and direct API key access', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const writes = await workspace(page);
  const quickstart = page.getByRole('region', { name: 'Use your model' });
  await quickstart.getByRole('button', { name: 'Copy model ID' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(modelId);
  await expect(quickstart.getByText('API model ID copied.')).toBeVisible();
  await quickstart.getByRole('button', { name: 'Copy code', exact: true }).click();
  const python = await page.evaluate(() => navigator.clipboard.readText());
  expect(python).toContain(modelId);
  expect(python).toContain('http://127.0.0.1:8999/v1/systemone');
  expect(python).toContain('from urllib.request import Request, urlopen');
  await page.getByRole('region', { name: 'Use your model' }).screenshot({ path: '.private/model-quickstart-desktop.png' });
  await quickstart.getByRole('button', { name: 'JavaScript', exact: true }).click();
  await expect(quickstart.getByRole('button', { name: 'Copy code', exact: true })).toBeVisible();
  await expect(quickstart.getByLabel('Example code')).toContainText('const response = await fetch');
  await expect(quickstart.getByLabel('Run command')).toContainText('node use-model.mjs');
  const downloadPromise = page.waitForEvent('download');
  await quickstart.getByRole('button', { name: 'Download use-model.mjs' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('use-model.mjs');
  await quickstart.getByRole('button', { name: 'API keys', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'API keys', exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test('blocked clipboard selects the full ID for manual copying', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('blocked'); } } }); });
  await workspace(page);
  await page.getByRole('button', { name: 'Copy model ID' }).click();
  await expect(page.getByText('Copy was blocked.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('API model ID')).toBeFocused();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(modelId);
});

test('model usage fits a small screen and optional downloads stay collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await workspace(page);
  await expect(page.getByRole('button', { name: 'Copy model ID' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Get model files' })).not.toBeVisible();
  await page.screenshot({ path: '.private/model-quickstart-mobile.png', fullPage: true });
});

test('activation in progress does not offer a usable model prematurely', async ({ page }) => {
  await workspace(page, 'activating');
  await expect(page.getByRole('heading', { name: 'Training passed. Preparing API access.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Use your model' })).toHaveCount(0);
});


test('available models list keeps different tasks separate and links to each model page', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const writes = await workspace(page, 'ready', true, true);
  const library = page.getByRole('region', { name: 'Your models' });
  await expect(library.getByRole('listitem')).toHaveCount(2);
  await expect(library.getByText('still-activating')).toHaveCount(0);
  const invoice = library.getByRole('listitem').filter({ hasText: 'invoice-checking' });
  await invoice.getByRole('button', { name: 'Copy name' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('invoice-checking-20000000');
  await library.screenshot({ path: '.private/model-library-desktop.png' });
  await invoice.getByRole('link', { name: 'View model' }).click();
  await expect(page).toHaveURL(/\/train\/models\/20000000-0000-4000-8000-000000000001$/);
  const example = page.getByRole('region', { name: 'Use your model' });
  await expect(example.getByLabel('API model name')).toHaveText('invoice-checking-20000000');
  await expect(example.getByLabel('Example code')).toContainText('invoice-checking-20000000');
  expect(writes).toEqual([]);
});

test('multiple named models fit on mobile and preserve full IDs in technical details', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await workspace(page, 'ready', true, true);
  const library = page.getByRole('region', { name: 'Your models' });
  await expect(library.getByRole('link', { name: 'View model' })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await library.screenshot({ path: '.private/model-library-mobile.png' });
  await page.getByRole('region', { name: 'Run history' }).getByRole('link', { name: /support-actions/ }).click();
  await page.getByText('Evaluation and technical details', { exact: true }).click();
  await expect(page.locator('details').filter({ has: page.locator('summary', { hasText: 'Evaluation and technical details' }) }).getByText(modelId, { exact: true })).toBeVisible();
});

test('completed runs stay out of the index and open through permanent links', async ({ page }) => {
  const writes = await workspace(page, 'ready', false, true);
  await expect(page.getByRole('region', { name: 'Use your model' })).toHaveCount(0);
  await expect(page.locator('#current-run-title')).toHaveCount(0);
  const link = page.getByRole('region', { name: 'Run history' }).getByRole('link', { name: /support-actions/ });
  await expect(link).toHaveAttribute('href', `/train?run=${id}`);
  await link.focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/train\\?run=${id}$`));
  await expect(page.getByRole('region', { name: 'Use your model' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#current-run-title')).toHaveText('support-actions');
  await page.getByRole('link', { name: 'Back to Training', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Use your model' })).toHaveCount(0);
  await page.getByRole('region', { name: 'Your models' }).getByRole('link', { name: 'View model' }).click();
  await expect(page.getByRole('heading', { name: 'support-actions', level: 1 })).toBeVisible();
  expect(writes).toEqual([]);
});

test('compact model names and highlighted examples preserve the exact copied code in both themes', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await workspace(page, 'ready', true, true);
  await page.getByRole('region', { name: 'Run history' }).getByRole('link', { name: /support-actions/ }).click();
  const example = page.locator(`#use-model-${id}`);
  await expect(example.getByLabel('API model name')).toHaveText('support-actions-10000000');
  await expect(example.locator('textarea')).toHaveCount(0);
  const nameHeight = await example.getByLabel('API model name').evaluate(node => node.getBoundingClientRect().height);
  expect(nameHeight).toBeLessThan(48);
  for (const language of ['Python', 'JavaScript']) {
    await example.getByRole('button', { name: language, exact: true }).click();
    const code = example.getByLabel('Example code');
    await expect(code.locator('.token.keyword').first()).toBeVisible();
    await expect(code.locator('.token.string').first()).toBeVisible();
    await example.getByRole('button', { name: 'Copy code', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await code.textContent());
    await example.getByRole('button', { name: 'Copy command', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await example.getByLabel('Run command').textContent());
  }
  await example.screenshot({ path: '.private/compact-examples-light.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const keyword = example.getByLabel('Example code').locator('.token.keyword').first();
  expect(await keyword.evaluate(node => getComputedStyle(node).color)).not.toBe(await example.getByLabel('Example code').evaluate(node => getComputedStyle(node).color));
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await example.screenshot({ path: '.private/compact-examples-dark-mobile.png' });
});

import { test, expect, type Page, type Request } from '@playwright/test';
import { signIn } from './signed-in';

const KEY = `zils_sk_${'c'.repeat(32)}_${'D'.repeat(43)}`;
const OWN = { id: 'acct-support-router', label: 'support-router', own: true };

async function open(page: Page, runs: Request[]) {
  await signIn(page);
  await page.route('**/api/playground', route => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ json: { configured: true, models: [{ id: 'browser-test-release', label: 'Zils shared' }, OWN] } });
    runs.push(request);
    const body = request.postDataJSON();
    return route.fulfill({ json: { model: body.model, answers: Object.fromEntries(Object.keys(body.questions).map(id => [id, { type: 'noul', noul: .7 }])), usage: { input_tokens: 30, output_tokens: 0 } } });
  });
  await page.goto('/playground');
}

test('the playground opens straight into the request editor', async ({ page }) => {
  await open(page, []);
  await expect(page.getByRole('heading', { name: 'Playground', exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Context/)).toBeVisible();
  await expect(page.getByLabel(/^Decisions/)).toBeVisible();
  await expect(page.getByText('Build a decision')).toHaveCount(0);
  await page.screenshot({ path: '.private/playground-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('an own model runs with the pasted key, keeps it out of storage, and shows the request as curl', async ({ page }) => {
  const runs: Request[] = [];
  await open(page, runs);
  await page.getByLabel('Model', { exact: true }).selectOption(OWN.id);
  await page.getByRole('button', { name: /Run decisions/ }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Paste one of your API keys');
  expect(runs).toHaveLength(0);

  await page.getByLabel('Your API key').fill(KEY);
  await page.getByRole('button', { name: /Run decisions/ }).click();
  await expect.poll(() => runs.length).toBe(1);
  expect(runs[0].headers()['x-zils-api-key']).toBe(KEY);
  expect(runs[0].headers().authorization).toMatch(/^Bearer /);
  expect(runs[0].postDataJSON().model).toBe(OWN.id);
  expect(runs[0].postData()).not.toContain(KEY);

  await page.getByRole('tab', { name: 'API' }).click();
  const curl = page.getByText('curl http://127.0.0.1:8999/v1/systemone');
  await expect(curl).toBeVisible();
  await expect(curl).toContainText('Bearer $ZILS_API_KEY');
  await expect(curl).toContainText(OWN.id);
  await expect(curl).not.toContainText(KEY);
  expect(page.url()).not.toContain(KEY);
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain(KEY);
});

test('the shared model never sends a user key', async ({ page }) => {
  const runs: Request[] = [];
  await open(page, runs);
  await expect(page.getByLabel('Your API key')).toBeHidden();
  await page.getByRole('button', { name: /Run decisions/ }).click();
  await expect.poll(() => runs.length).toBe(1);
  expect(runs[0].headers()['x-zils-api-key']).toBeUndefined();
  expect(runs[0].postDataJSON().model).toBe('browser-test-release');
});

test('signed-out visitors are sent to sign in or examples, and the model routes refuse them', async ({ page }) => {
  await page.goto('/playground');
  await expect(page.getByRole('heading', { name: 'Sign in to use the playground', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'See examples', exact: true })).toHaveAttribute('href', '/examples');
  await expect(page.getByLabel(/^Decisions/)).toHaveCount(0);
  for (const path of ['/api/playground', '/api/setup']) {
    expect((await page.request.post(path, { data: {} })).status()).toBe(401);
    expect((await page.request.post(path, { data: {}, headers: { authorization: 'Bearer not-a-session' } })).status()).toBe(401);
  }
});

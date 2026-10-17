import { test, expect, type Page, type Request } from '@playwright/test';
import { signIn } from './signed-in';

const KEY = `zils_sk_${'c'.repeat(32)}_${'D'.repeat(43)}`;
const OWN = { id: 'acct-support-router', label: 'support-router', own: true };

async function open(page: Page, runs: Request[]) {
  await signIn(page);
  await page.route('**/api/setup', route => route.fulfill({ status: 503, json: { error: 'Assistant unavailable for this test.' } }));
  await page.route('**/api/playground', route => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ json: { configured: true, models: [{ id: 'browser-test-release', label: 'Zils shared' }, OWN] } });
    runs.push(request);
    const body = request.postDataJSON();
    return route.fulfill({ json: { model: body.model, answers: { refund: { type: 'noul', noul: .7 } }, usage: { input_tokens: 30, output_tokens: 0 } } });
  });
  await page.goto('/playground');
  await page.getByRole('button', { name: /Check a condition/ }).click();
  await page.getByRole('button', { name: 'Try an example', exact: true }).click();
}

test('an own model runs with the pasted key, keeps it out of storage, and shows the request as curl', async ({ page }) => {
  const runs: Request[] = [];
  await open(page, runs);
  await page.getByLabel('Model', { exact: true }).selectOption(OWN.id);
  await page.getByRole('button', { name: 'Run example', exact: true }).click();
  await expect(page.getByRole('alert', { name: 'Setup error' })).toContainText('Paste one of your API keys');
  expect(runs).toHaveLength(0);

  await page.getByLabel('Your API key').fill(KEY);
  await page.getByRole('button', { name: 'Run example', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your results' })).toBeVisible();
  expect(runs).toHaveLength(1);
  expect(runs[0].headers()['x-zils-api-key']).toBe(KEY);
  expect(runs[0].headers().authorization).toMatch(/^Bearer /);
  expect(runs[0].postDataJSON().model).toBe(OWN.id);
  expect(runs[0].postData()).not.toContain(KEY);

  const curl = page.getByLabel('Request as curl');
  await expect(curl).toContainText('curl http://127.0.0.1:8999/v1/systemone');
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
  await page.getByRole('button', { name: 'Run example', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your results' })).toBeVisible();
  expect(runs[0].headers()['x-zils-api-key']).toBeUndefined();
  expect(runs[0].postDataJSON().model).toBe('browser-test-release');
});

test('the advanced editor sends the session and the chosen model, and its API view targets the public API', async ({ page }) => {
  const runs: Request[] = [];
  await open(page, runs);
  await page.getByLabel('Model', { exact: true }).selectOption(OWN.id);
  await page.getByLabel('Your API key').fill(KEY);
  await page.getByRole('button', { name: 'Advanced editor', exact: true }).click();
  await page.getByRole('button', { name: 'Run decisions' }).click();
  await expect.poll(() => runs.length).toBe(1);
  expect(runs[0].headers().authorization).toMatch(/^Bearer /);
  expect(runs[0].headers()['x-zils-api-key']).toBe(KEY);
  expect(runs[0].postDataJSON().model).toBe(OWN.id);
  await page.getByRole('tab', { name: 'API' }).click();
  await expect(page.getByText('curl http://127.0.0.1:8999/v1/systemone')).toBeVisible();
});

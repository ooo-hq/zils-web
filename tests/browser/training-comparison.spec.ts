import { test, expect, type Page } from '@playwright/test';

const id = '10000000-0000-4000-8000-000000000001';
const job = {
  id, name: 'abcd-sample', status: 'completed',
  model: { id: 'jevk5-4b-v0.3', name: 'JevK5', base: 'base', base_revision: 'a'.repeat(40) },
  dataset_counts: { train: 64, calibration: 16, test: 16 },
  result: { delivery: { status: 'accepted', uid: 1, acceptance: { min_accuracy: .5, min_brier_improvement: 0 } }, baseline: { accuracy: .8125, brier: .314, skill: .3 }, miners: [{ uid: 1, status: 'evaluated', accuracy: .8125, brier: .219 }], weights: {} },
};
const complete = {
  status: 'completed', created_at: '2026-10-07', finished_at: '2026-10-07', model_id: 'synthetic-test-model', checkpoint_sha256: 'a'.repeat(64), jev_model: 'jev-1.13.0', input_sha256: 'b'.repeat(64), error: null,
  result: { cases: 40, groups: 40, verdict: 'less_accurate', trained: { correct: 28, accuracy: .7, brier: .3 }, jev: { correct: 38, accuracy: .95, brier: .1 }, accuracy_difference: -.25, accuracy_difference_95_ci: [-.4, -.1], wins: 0, losses: 10, method: 'Synthetic browser fixture. Paired comparison.', rows: [{ id: 'case-1', expected: 'b', trained: 'a', jev: 'b', trained_correct: false, jev_correct: true }] },
};

async function workspace(page: Page, options: { available?: boolean; saved?: boolean; failed?: boolean } = {}) {
  const user = { id: '10000000-0000-4000-8000-000000000002', email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString('base64url')}.browser-test`;
  await page.addInitScript(({ user, token, expires }) => {
    localStorage.setItem('zils-training-auth', JSON.stringify({ user, access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires }));
  }, { user, token, expires });
  const state = { mutations: [] as string[], comparison: options.saved ? complete : options.failed ? { ...complete, status: 'failed', result: null, error: 'Comparison interrupted. No complete comparison is available; contact support.' } : null as unknown };
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user, headers });
    if (request.method() !== 'GET') state.mutations.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === '/v1/jobs') return route.fulfill({ json: { jobs: [job] }, headers });
    if (url.pathname === `/v1/jobs/${id}/comparison` && request.method() === 'GET') return route.fulfill({ json: { available: options.available ?? true, comparison: state.comparison }, headers });
    if (url.pathname === `/v1/jobs/${id}/comparison` && request.method() === 'POST') {
      expect(request.postDataJSON()).toEqual({ allow_typesafe_export: true, unseen_examples: true, consent_version: 'typesafe-evaluation-v1' });
      state.comparison = { ...complete, status: 'uploading', result: null };
      return route.fulfill({ json: { comparison: state.comparison, upload: { url: 'http://127.0.0.1:8998/storage/v1/object/comparison', method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' } } }, headers });
    }
    if (request.method() === 'PUT' && url.pathname === '/storage/v1/object/comparison') return route.fulfill({ json: {}, headers });
    if (url.pathname === `/v1/jobs/${id}/comparison/submit`) {
      state.comparison = complete;
      return route.fulfill({ json: { comparison: state.comparison }, headers });
    }
    return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' }, headers });
  });
  await page.goto('/train');
  return state;
}

test('shows the selected sample result without calling its probability gain an accuracy gain', async ({ page }) => {
  const state = await workspace(page);
  await expect(page.getByRole('heading', { name: 'Same accuracy on the selection test' })).toBeVisible();
  await expect(page.getByText('13 of 16 correct')).toHaveCount(2);
  await expect(page.getByText('Better probability estimates')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set up comparison' })).toBeVisible();
  expect(state.mutations).toEqual([]);
});

test('requires both confirmations, uploads once, and preserves a Jev win', async ({ page }) => {
  const state = await workspace(page);
  await page.getByRole('button', { name: 'Set up comparison' }).click();
  const run = page.getByRole('button', { name: 'Run comparison', exact: true });
  await expect(run).toBeDisabled();
  const row = { id: 'fresh', group_id: 'fresh', family: 'task', state: 'input', question: { type: 'noul', instructions: 'Yes?' }, label: 'true' };
  await page.getByLabel('New test examples (.jsonl)').setInputFiles({ name: 'fresh.jsonl', mimeType: 'application/jsonl', buffer: Buffer.from(JSON.stringify(row)) });
  await page.getByLabel('These examples and related conversations').check();
  await expect(run).toBeDisabled();
  expect(state.mutations).toEqual([]);
  await page.getByLabel('I approve sending').check();
  await run.click();
  await expect(page.getByRole('heading', { name: 'Less accurate than Jev on this test' })).toBeVisible();
  expect(state.mutations).toEqual([`POST /v1/jobs/${id}/comparison`, 'PUT /storage/v1/object/comparison', `POST /v1/jobs/${id}/comparison/submit`]);
  await page.getByText('See answers and test details').click();
  await expect(page.getByRole('cell', { name: 'b · correct', exact: true })).toBeVisible();
});

test('an interrupted comparison never shows a winner or repeat-run button', async ({ page }) => {
  await workspace(page, { failed: true });
  await expect(page.getByRole('alert').filter({ hasText: 'No complete comparison' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set up comparison' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'More accurate than Jev on this test' })).toHaveCount(0);
});

test('completed evidence fits a mobile screen and remains readable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await workspace(page, { saved: true });
  await expect(page.getByRole('heading', { name: 'Less accurate than Jev on this test' })).toBeVisible();
  await page.getByText('See answers and test details').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('disabled comparisons retain the useful starting-model result', async ({ page }) => {
  await workspace(page, { available: false });
  await expect(page.getByText('Jev comparison is not enabled on this service yet.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Same accuracy on the selection test' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set up comparison' })).toHaveCount(0);
});

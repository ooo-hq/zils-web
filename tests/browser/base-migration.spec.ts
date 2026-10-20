import { test, expect, type Page } from '@playwright/test';
import { signIn } from './signed-in';
import { mini, poolConfig } from './model-pools-fixture';
import { baseConfigSchema } from '../../lib/base-model';
import type { Job, Submission } from '../../lib/training';

const id = '10000000-0000-4000-8000-000000000001';
const newId = '10000000-0000-4000-8000-000000000003';
const round = (n: number) => ({ ...mini, id: `d3-mini-4.5b-zils-r${n}`, name: `d3-mini r${n}` });
const currentJob = (model = mini): Job => ({
  id, name: 'support-routing', status: 'completed', model,
  workflow: { state: 'ready', model_id: 'support-routing-v1', model_alias: 'support-routing' },
  result: { delivery: { status: 'accepted', uid: 1 }, baseline: { accuracy: .8, brier: .2, skill: .4 }, miners: [{ uid: 1, status: 'evaluated', accuracy: .9, brier: .15 }], weights: {} },
});

async function fixture(page: Page, model = mini, target = round(5)) {
  await signIn(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const config = baseConfigSchema.parse(poolConfig());
  config.pools!['d3-mini'].channels.latest = target;
  const state = { config, unavailable: false, denied: false, listed: false, posts: [] as Submission[], writes: [] as string[] };
  let created: Job | undefined;
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.startsWith('/auth/')) return route.fallback();
    if (request.method() !== 'GET') state.writes.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === '/v1/config') return route.fulfill({ headers, status: state.unavailable ? 503 : 200, json: state.config });
    if (url.pathname === `/v1/jobs/${id}`) return route.fulfill({ headers, status: state.denied ? 404 : 200, json: state.denied ? { error: 'Not found' } : { job: currentJob(model) } });
    if (url.pathname === '/v1/jobs' && request.method() === 'GET') return route.fulfill({ headers, json: { jobs: created ? [created] : [], models: state.listed ? [currentJob(model)] : [] } });
    if (url.pathname === '/v1/jobs' && request.method() === 'POST') {
      const input = request.postDataJSON() as Submission; state.posts.push(input);
      created = { id: newId, name: input.name, status: 'uploading', model: target, acceptance: input.acceptance };
      return route.fulfill({ headers, json: { job: created, uploads: Object.fromEntries(['train', 'calibration', 'test'].map(split => [split, { url: `http://127.0.0.1:8998/storage/v1/object/upload/sign/fez-training-data/${newId}/inputs/${split}.jsonl?token=fixture`, method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' } }])) } });
    }
    if (url.pathname.startsWith('/storage/') && request.method() === 'PUT') return route.fulfill({ headers, json: {} });
    if (url.pathname === `/v1/jobs/${newId}/submit` && created) {
      created.status = 'validating';
      return route.fulfill({ headers, json: { job: created } });
    }
    return route.fulfill({ headers, status: 404, json: { error: 'Not part of this fixture' } });
  });
  return state;
}

async function openMigration(page: Page) {
  await page.goto(`/models/${id}`);
  await page.getByRole('link', { name: 'Migrate', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Migrate your model' })).toBeVisible();
  await expect(page.getByText('Replacing support-routing.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change example type' })).toHaveCount(0);
  await expect(page.getByLabel('Base channel', { exact: true })).toHaveCount(0);
}

async function preparedFiles(page: Page) {
  await page.getByRole('button', { name: 'Use prepared files' }).click();
  await page.getByLabel('Run name', { exact: true }).fill('support-migration');
  for (const split of ['train', 'calibration', 'test']) {
    const rows = Array.from({ length: 4 }, (_, i) => ({ id: `${split}-${i}`, group_id: `${split}-${i}`, family: 'routing', state: { message: `${split} example ${i}` }, question: { type: 'choice', criteria: { billing: null, support: null } }, label: i % 2 ? 'billing' : 'support' }));
    await page.locator(`#dataset-${split}`).setInputFiles({ name: `${split}.jsonl`, mimeType: 'application/jsonl', buffer: Buffer.from(rows.map(row => JSON.stringify(row)).join('\n')) });
  }
  await page.getByLabel('I am authorized', { exact: false }).check();
}

test('Migrate submits a pinned base change through the prepared training flow only on request', async ({ page }) => {
  const state = await fixture(page);
  await openMigration(page);
  expect(state.writes).toEqual([]);
  await preparedFiles(page);
  await page.getByText('Success criteria: at least 80% accuracy', { exact: true }).click();
  await page.getByLabel('Minimum accuracy (%)', { exact: true }).fill('87');
  await page.getByLabel('Minimum Brier improvement', { exact: true }).fill('0.02');
  // A promotion while the form is open may move the same pinned base to stable.
  state.config.pools!['d3-mini'].channels = { stable: round(5), latest: round(6) };
  await page.getByRole('button', { name: 'Send for training', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0]).toMatchObject({ model: round(5).id, pool: 'd3-mini', base_channel: 'stable', acceptance: { previous_job_id: id, base_change: true, min_accuracy: .87, min_brier_improvement: .02 } });
  expect(state.posts[0].acceptance).not.toHaveProperty('migration');
  expect(state.writes.filter(write => write.startsWith('PUT'))).toHaveLength(3);
  expect(state.writes.at(-1)).toBe(`POST /v1/jobs/${newId}/submit`);
});

test('r5 to r6 also works through guided examples', async ({ page }) => {
  const state = await fixture(page, round(5), round(6));
  await openMigration(page);
  await expect(page.getByText('Starting base:', { exact: false })).toContainText('d3-mini r6');
  await page.getByLabel('The decision', { exact: true }).fill('Which team should handle this support ticket?');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const rows = ['case_id,message,answer', ...Array.from({ length: 18 }, (_, i) => `case-${i},Help with request ${i},${i % 2 ? 'Billing' : 'Support'}`)];
  await page.getByLabel('Drop your data here or choose a file').setInputFiles({ name: 'examples.csv', mimeType: 'text/csv', buffer: Buffer.from(rows.join('\n')) });
  await page.getByRole('button', { name: 'Review examples', exact: true }).click();
  await page.getByRole('button', { name: 'Check readiness' }).click();
  await page.getByLabel('Run name', { exact: true }).fill('support-r6');
  await page.getByLabel('I checked the answers', { exact: false }).check();
  await page.getByLabel('I am authorized', { exact: false }).check();
  expect(state.writes).toEqual([]);
  await page.getByRole('button', { name: 'Send for training', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(state.posts[0]).toMatchObject({ model: round(6).id, acceptance: { previous_job_id: id, base_change: true } });
});

test('availability is rechecked before creating a job', async ({ page }) => {
  const state = await fixture(page);
  await openMigration(page); await preparedFiles(page);
  state.config.pools!['d3-mini'].availability.latest.training_enabled = false;
  await page.getByRole('button', { name: 'Send for training', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This migration is no longer available');
  expect(state.writes).toEqual([]);
});

for (const reason of ['unavailable', 'denied'] as const) test(`a ${reason} migration cannot fall back to ordinary training`, async ({ page }) => {
  const state = await fixture(page); state[reason] = true;
  await page.goto(`/train?upgrade=${id}&migrate=${round(5).id}`);
  await expect(page.getByRole('alert').first()).toBeVisible();
  await preparedFiles(page);
  await expect(page.getByRole('button', { name: 'Send for training', exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test('discovery failure leaves the existing model usable without an upgrade claim', async ({ page }) => {
  const state = await fixture(page); state.unavailable = true;
  await page.goto(`/models/${id}`);
  await expect(page.getByRole('heading', { name: 'support-routing', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Use this model', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Migrate', exact: true })).toHaveCount(0);
});

test('the Models list links eligible models to their migration notice', async ({ page }, testInfo) => {
  const state = await fixture(page); state.listed = true;
  await page.goto('/models');
  const availability = page.getByRole('link', { name: 'Newer base available', exact: true });
  await expect(availability).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('migration-models.png'), animations: 'disabled' });
  await availability.click();
  await expect(page.getByRole('region', { name: 'Newer base available' })).toBeVisible();
  expect(state.writes).toEqual([]);
});

for (const theme of ['light', 'dark']) for (const width of [390, 1440]) test(`migration fits ${width}px in ${theme}`, async ({ page }, testInfo) => {
  await fixture(page);
  await page.addInitScript(value => localStorage.setItem('zils-theme', value), theme);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/models/${id}`);
  const notice = page.getByRole('region', { name: 'Newer base available' });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('link', { name: 'Migrate', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`migration-${theme}-${width}.png`), animations: 'disabled' });
  await page.getByRole('link', { name: 'Migrate', exact: true }).click();
  await expect(page.getByText('Starting base:', { exact: false })).toContainText('d3-mini r5');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`migration-form-${theme}-${width}.png`), animations: 'disabled' });
});

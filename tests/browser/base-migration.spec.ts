import { expect, test, type Page } from '@playwright/test';
import { signIn } from './signed-in';
import { mini, poolConfig } from './model-pools-fixture';
import { baseConfigSchema } from '../../lib/base-model';
import type { Job } from '../../lib/training';

const id = '11111111-1111-4111-8111-111111111111', newId = '33333333-3333-4333-8333-333333333333';
const round = (n: number) => ({ ...mini, id: `d3-mini-4.5b-zils-r${n}`, name: `d3-mini r${n}` });
const currentJob = (model = mini): Job => ({
  id, name: 'support-routing', status: 'completed', model,
  workflow: { state: 'ready', model_id: 'support-routing-v1', model_alias: 'support-routing' },
  result: { delivery: { status: 'accepted', uid: 1 }, baseline: { accuracy: .8, brier: .2, skill: .4 }, miners: [{ uid: 1, status: 'evaluated', accuracy: .9, brier: .15 }], weights: {} },
});

async function fixture(page: Page, model = mini, target = round(7)) {
  await signIn(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const config = baseConfigSchema.parse(poolConfig());
  config.pools!['d3-mini'].channels.latest = target;
  const state = { config, denied: false, missing: false, lostResponse: false, posts: [] as Record<string, string>[], writes: [] as string[], creations: 0 };
  let created: Job | undefined;
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.startsWith('/auth/')) return route.fallback();
    if (request.method() !== 'GET') state.writes.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === '/v1/config') return route.fulfill({ headers, json: state.config });
    if (url.pathname === `/v1/jobs/${id}`) return route.fulfill({ headers, json: { job: currentJob(model) } });
    if (url.pathname === `/v1/jobs/${id}/migration`) {
      if (state.denied || state.missing) return route.fulfill({ headers, status: state.denied ? 404 : 409, json: { error: state.denied ? 'Job not found.' : 'The saved dataset is no longer available. Train a replacement with new examples.' } });
      if (request.method() === 'GET') return route.fulfill({ headers, json: { job: currentJob(model), counts: { train: 4096, calibration: 500, test: 500 }, acceptance: { min_accuracy: .87, min_brier_improvement: .02, previous_job_id: id, base_change: true, migration: 'no_regression' }, allow_jev_comparison: true } });
      const body = request.postDataJSON(); state.posts.push(body);
      if (!created) {
        created = { id: newId, name: 'support-routing', status: 'validating', model: target, dataset_source: { job_id: id, job_sha256: 'a'.repeat(64), request_id: body.request_id } };
        state.creations++;
      }
      if (state.lostResponse) { state.lostResponse = false; return route.abort(); }
      return route.fulfill({ headers, json: { job: created } });
    }
    if (url.pathname === `/v1/jobs/${newId}` && created) return route.fulfill({ headers, json: { job: created } });
    if (url.pathname === '/v1/jobs' && request.method() === 'GET') return route.fulfill({ headers, json: { jobs: created ? [created] : [], models: [currentJob(model)] } });
    return route.fulfill({ headers, status: 404, json: { error: 'Not part of this fixture' } });
  });
  return state;
}

async function openMigration(page: Page) {
  await page.goto(`/models/${id}`);
  await page.getByRole('link', { name: 'Migrate', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Migrate your model' });
  await expect(dialog.getByRole('heading', { name: 'support-routing' })).toBeVisible();
  return dialog;
}

test('Migrate confirms existing data and settings without reopening the training wizard', async ({ page }) => {
  const state = await fixture(page);
  const dialog = await openMigration(page);
  await expect(dialog.getByText('4,096', { exact: true })).toBeVisible();
  await expect(dialog.getByText('87%', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Match or improve', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Minimum Brier improvement', { exact: true })).toHaveCount(0);
  await expect(dialog.locator('input, textarea, select')).toHaveCount(0);
  await expect(dialog.getByText('d3-mini r7', { exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
  state.config.pools!['d3-mini'].channels = { stable: round(7), latest: round(8) };
  await dialog.getByRole('button', { name: 'Confirm migration' }).click();
  await expect(page).toHaveURL(`/train?run=${newId}`);
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0]).toMatchObject({ model: round(7).id, pool: 'd3-mini', base_channel: 'stable' });
  expect(Object.keys(state.posts[0]).sort()).toEqual(['base_channel', 'model', 'pool', 'request_id']);
  expect(state.writes).toEqual([`POST /v1/jobs/${id}/migration`]);
});

test('cancel does not create a run', async ({ page }) => {
  const state = await fixture(page);
  const dialog = await openMigration(page);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes).toEqual([]);
});

test('a lost response retries the same migration request', async ({ page }) => {
  const state = await fixture(page); state.lostResponse = true;
  const dialog = await openMigration(page);
  await dialog.getByRole('button', { name: 'Confirm migration' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Cannot reach');
  state.config.pools!['d3-mini'].availability.latest.training_enabled = false;
  await page.reload();
  await expect(dialog.getByRole('alert')).toContainText('no longer available');
  await dialog.getByRole('button', { name: 'Retry migration' }).click();
  await expect(page).toHaveURL(`/train?run=${newId}`);
  expect(state.posts).toHaveLength(2);
  expect(state.posts[0].request_id).toBe(state.posts[1].request_id);
  expect(state.creations).toBe(1);
});

test('availability is checked again at confirmation', async ({ page }) => {
  const state = await fixture(page);
  const dialog = await openMigration(page);
  state.config.pools!['d3-mini'].availability.latest.training_enabled = false;
  await dialog.getByRole('button', { name: 'Confirm migration' }).click();
  await expect(dialog.getByRole('alert')).toContainText('no longer available');
  expect(state.writes).toEqual([]);
});

for (const reason of ['denied', 'missing'] as const) test(`${reason} saved data blocks migration without ordinary training fallback`, async ({ page }) => {
  const state = await fixture(page); state[reason] = true;
  await page.goto(`/train?upgrade=${id}&migrate=${round(7).id}`);
  const dialog = page.getByRole('dialog', { name: 'Migrate your model' });
  await expect(dialog.getByRole('alert')).toContainText(reason === 'denied' ? 'Job not found' : 'no longer available');
  await expect(dialog.getByRole('button', { name: 'Confirm migration' })).toHaveCount(0);
  await expect(dialog.locator('input')).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test('the Models list links eligible models to the migration notice', async ({ page }) => {
  await fixture(page); await page.goto('/models');
  await page.getByRole('link', { name: 'Newer base available' }).click();
  await expect(page.getByRole('region', { name: 'Newer base available' })).toBeVisible();
});

test('a model already on the newest base has no migration offer', async ({ page }) => {
  await fixture(page, round(7)); await page.goto(`/models/${id}`);
  await expect(page.getByRole('link', { name: 'Migrate', exact: true })).toHaveCount(0);
});

for (const theme of ['light', 'dark']) for (const width of [390, 1440]) test(`migration confirmation fits ${width}px in ${theme}`, async ({ page }, testInfo) => {
  await fixture(page);
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(value => localStorage.setItem('zils-theme', value), theme);
  const dialog = await openMigration(page);
  await expect(dialog.getByRole('button', { name: 'Confirm migration' })).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const style = await dialog.evaluate(element => ({ font: getComputedStyle(element).fontFamily, shadow: getComputedStyle(element).boxShadow }));
  expect(style.font).toContain('Inter Tight');
  expect(style.shadow).toBe('none');
  await page.screenshot({ path: testInfo.outputPath(`confirmation-${theme}-${width}.png`), animations: 'disabled' });
});

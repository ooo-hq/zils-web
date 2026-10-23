import { legacyConfig, poolConfig, mini, lite } from './model-pools-fixture';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const jobId = '30000000-0000-4000-8000-000000000001';
const owner = '30000000-0000-4000-8000-000000000002';
const splits = ['train', 'calibration', 'test'] as const;

async function workspace(page: Page, options: { signedIn?: boolean; failUpload?: boolean; credit?: boolean; lostCreate?: boolean | 400 | 409; lostSubmit?: boolean; imagesEnabled?: boolean; pools?: boolean } = {}) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: owner, email: 'trainer@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  if (options.signedIn !== false) await page.addInitScript(({ user, expires }) => {
    localStorage.setItem('zils-training-auth', JSON.stringify({ user, access_token: `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({ sub: user.id, exp: expires }))}.fixture`, refresh_token: 'fixture', expires_at: expires, expires_in: 3600, token_type: 'bearer' }));
  }, { user, expires });
  let created: Record<string, unknown> | undefined, status = 'uploading', failUpload = options.failUpload;
  const state = { credit: options.credit, creates: 0, submits: 0, uploads: {} as Record<string, string>, putAttempts: [] as string[], mutations: [] as string[], assets: [] as { id: string; filename: string; source_sha256: string }[] };
  const job = () => ({ id: jobId, name: created?.name || 'teaching-run', status, acceptance: created?.acceptance, ...(created?.model ? { model: created.model === lite.id ? lite : mini, image_intake: created.image_intake } : {}) });
  const grant = (path: string) => ({ url: `http://127.0.0.1:8998/storage/v1/object/upload/sign/${path}`, method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' } });
  const uploads = () => Object.fromEntries(splits.map(split => [split, state.uploads[split] ? { uploaded: true } : grant(`fez-training-data/${jobId}/inputs/${split}.jsonl`)]));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (url.origin === 'http://127.0.0.1:3107') {
      if (path === '/api/teaching/align') return route.fulfill({ json: { decision: false, reflection: false } });
      return route.continue();
    }
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.method() !== 'GET') state.mutations.push(`${request.method()} ${path}`);
    if (path.startsWith('/auth/v1/')) return route.fulfill({ headers, json: user });
    if (path === '/v1/config') return route.fulfill({ headers, json: options.pools ? poolConfig() : legacyConfig });
    if (path === '/v1/image-models') return route.fulfill({ headers, json: { models: [], training_enabled: options.imagesEnabled !== false, training_profile: { model: 'd3-mini-4.5b-v1', capabilities: { modalities: ['text', 'image', 'video'], question_types: ['noul', 'choice', 'score'], max_images: 4, max_videos: 1, max_questions: 8, max_options: 255, max_input_tokens: 4096, unknown_key: null }, images_per_example: 1, max_train: 1024, max_calibration: 256, max_test: 512, max_source_bytes: 10485760, max_pixels: 16000000, max_edge: 8192 } } });
    if (path === '/v1/jobs' && request.method() === 'GET') return route.fulfill({ headers, json: { jobs: created ? [job()] : [] } });
    if (path === '/v1/jobs' && request.method() === 'POST') {
      state.creates++; created = request.postDataJSON();
      if (typeof options.lostCreate === 'number') return route.fulfill({ status: options.lostCreate, headers, json: { error: 'Upload grants unavailable after saving the run.' } });
      if (options.lostCreate) return route.abort('failed');
      return route.fulfill({ headers, json: { job: job(), uploads: uploads() } });
    }
    if (path === `/v1/jobs/${jobId}`) return route.fulfill({ headers, json: { job: job() } });
    if (path === `/v1/jobs/${jobId}/uploads`) return route.fulfill({ headers, json: { job: job(), uploads: uploads() } });
    if (path === `/v1/jobs/${jobId}/submit`) {
      state.submits++;
      if (state.credit) return route.fulfill({ status: 402, headers, json: { error: 'Insufficient credit. Add credit to continue.' } });
      status = 'validating';
      if (options.lostSubmit) return route.abort('failed');
      return route.fulfill({ headers, json: { job: job() } });
    }
    if (path === `/v1/jobs/${jobId}/image-assets`) return route.fulfill({ headers, json: { assets: state.assets } });
    if (path === '/v1/image-assets') {
      const asset = { id: `40000000-0000-4000-8000-${String(state.assets.length + 1).padStart(12, '0')}`, ...request.postDataJSON() };
      state.assets.push(asset);
      return route.fulfill({ headers, json: { asset: { ...asset, state: 'uploading', expires_at: '2099-01-01T00:00:00Z' }, upload: grant(`zils-images/${owner}/${asset.id}/source`) } });
    }
    if (/\/v1\/image-assets\/[^/]+\/complete$/.test(path)) return route.fulfill({ headers, json: { id: path.split('/').at(-2), state: 'ready', expires_at: '2099-01-01T00:00:00Z', sha256: 'a'.repeat(64), width: 8, height: 8 } });
    if (/\/v1\/image-assets\/[^/]+\/resume$/.test(path)) return route.fulfill({ headers, json: { asset: { id: path.split('/').at(-2), state: 'ready', expires_at: '2099-01-01T00:00:00Z' }, uploaded: true } });
    if (request.method() === 'PUT') {
      expect(request.headers().authorization).toBeUndefined();
      expect(request.headers().cookie).toBeUndefined();
      if (path.endsWith('.jsonl')) {
        const split = path.split('/').at(-1)!.replace('.jsonl', ''); state.putAttempts.push(split);
        if (split === 'calibration' && failUpload) { failUpload = false; return route.fulfill({ status: 503, headers }); }
        state.uploads[split] = request.postData()!;
      }
      return route.fulfill({ headers, json: {} });
    }
    return route.fulfill({ status: 404, headers, json: {} });
  });
  await page.goto('/train/teach');
  return { state, created: () => created };
}

async function prepared(page: Page) {
  await page.getByRole('button', { name: 'I have training data', exact: true }).click();
  await page.getByLabel('Run name', { exact: true }).fill('prepared-live');
  for (const split of splits) {
    const data = [0, 1].map(i => ({ id: `${split}-${i}`, group_id: `${split}-${i}`, family: 'routing', state: `Message ${split} ${i}`, question: { type: 'choice', criteria: { Billing: 'Billing', Support: 'Support' } }, label: i ? 'Support' : 'Billing' }));
    await page.locator(`#prepared-${split}`).setInputFiles({ name: `${split}.jsonl`, mimeType: 'application/x-ndjson', buffer: Buffer.from(data.map(row => JSON.stringify(row)).join('\n')) });
  }
  await page.getByRole('button', { name: 'Validate and review' }).click();
  await expect(page.getByRole('region', { name: 'Submit training run' })).toBeVisible();
}

async function consent(page: Page) {
  await page.getByLabel('I am authorized to share these examples.', { exact: false }).check();
}

test('saved text uploads recover from the run page without classic setup', async ({ page }) => {
  const { state } = await workspace(page, { failUpload: true });
  await prepared(page);
  await consent(page);
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Submit training run' }).getByRole('alert')).toBeVisible();
  const original: Record<string, string> = {};
  for (const split of splits) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${split}.jsonl`, exact: true }).click();
    original[split] = await readFile((await (await download).path())!, 'utf8');
  }
  await page.goto(`/train?run=${jobId}`);
  await expect(page.getByRole('button', { name: 'Classic setup', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume missing uploads', exact: true }).click();
  await page.getByRole('button', { name: 'Use prepared files', exact: true }).click();
  for (const split of splits) {
    await page.locator(`#dataset-${split}`).setInputFiles({ name: `${split}.jsonl`, mimeType: 'application/x-ndjson', buffer: Buffer.from(original[split]) });
  }
  await page.getByRole('button', { name: 'Close training setup', exact: true }).click();
  await page.getByRole('button', { name: 'Resume missing uploads', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume missing uploads', exact: true })).toHaveCount(0);
  expect(state.creates).toBe(1);
  expect(state.submits).toBe(1);
  expect(state.putAttempts).toEqual(['train', 'calibration', 'calibration', 'test']);
  expect(state.uploads).toEqual(original);
});

for (const recover of [false, true]) test(`reviewed examples submit without leaking metadata, with recovery (${recover})`, async ({ page }) => {
  const { state, created } = await workspace(page, { failUpload: recover });
  await page.goto('/train');
  await page.getByRole('link', { name: 'Train a model', exact: true }).click();
  await expect(page).toHaveURL(/\/train\/teach$/);
  await page.getByRole('button', { name: 'Sort or make a decision', exact: false }).click();
  await page.getByRole('button', { name: 'Bring my first example', exact: true }).click();
  await page.getByRole('button', { name: 'Add sample examples', exact: true }).click();
  await page.getByRole('button', { name: 'Review my examples' }).click();
  await page.getByRole('button', { name: 'Review manually', exact: true }).click();
  for (let i = 0; i < 9; i++) await page.getByRole('button', { name: 'This answer is right' }).click();
  await page.getByRole('button', { name: 'Check for gaps' }).click();
  await page.getByRole('button', { name: 'Preview my test' }).click();
  await page.getByLabel('Training run name', { exact: true }).fill('reviewed-live');
  expect(state.mutations).toEqual([]);
  await expect(page.getByRole('button', { name: 'Start training', exact: true })).toBeDisabled();
  await consent(page);
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  const downloaded: Record<string, string> = {};
  if (recover) {
    await expect(page.getByRole('region', { name: 'Submit training run' }).getByRole('alert')).toBeVisible();
    for (const split of splits) {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: `Download ${split}.jsonl`, exact: true }).click();
      downloaded[split] = await readFile((await (await download).path())!, 'utf8');
    }
    expect(downloaded.train).toBe(state.uploads.train);
    await page.getByRole('button', { name: 'Resume training submission', exact: true }).click();
  }
  await expect(page).toHaveURL(`/train?run=${jobId}`);
  if (recover) expect(downloaded).toEqual(state.uploads);
  expect(state.creates).toBe(1); expect(state.submits).toBe(1);
  expect(created()).toMatchObject({ name: 'reviewed-live', allow_training_data_export: true });
  expect(created()).not.toHaveProperty('allow_jev_comparison');
  const rows = Object.values(state.uploads).flatMap(file => file.trim().split('\n').map(line => JSON.parse(line)));
  expect(rows).toHaveLength(9);
  expect(rows.every(row => typeof row.state === 'string' && row.question.criteria[row.label] === row.label && !row.source && !row.reviewed)).toBe(true);
});

for (const failure of ['upload', 'credit', 'lost-submit'] as const) test(`prepared run recovers from ${failure} without another job or repeated uploads`, async ({ page }) => {
  const { state } = await workspace(page, { failUpload: failure === 'upload', credit: failure === 'credit', lostSubmit: failure === 'lost-submit' });
  await prepared(page); await consent(page);
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Submit training run' }).getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Images', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Training run name', { exact: true })).toBeDisabled();
  if (failure === 'credit') {
    await expect(page.getByRole('link', { name: 'Add credit', exact: true })).toHaveAttribute('target', '_blank');
    const before = page.url();
    const popup = page.waitForEvent('popup');
    await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Models', exact: true }).click();
    expect(new URL((await popup).url()).pathname).toBe('/models');
    expect(page.url()).toBe(before);
    await expect(page.getByRole('button', { name: 'Resume training submission', exact: true })).toBeVisible();
    state.credit = false;
  }
  await page.getByRole('button', { name: 'Resume training submission', exact: true }).click();
  await expect(page).toHaveURL(`/train?run=${jobId}`);
  expect(state.creates).toBe(1);
  expect(state.putAttempts).toEqual(failure === 'upload' ? ['train', 'calibration', 'calibration', 'test'] : ['train', 'calibration', 'test']);
  expect(state.submits).toBe(failure === 'credit' ? 2 : 1);
});

for (const lostCreate of [true, 400, 409] as const) test(`an uncertain create response (${lostCreate}) blocks resubmission and links to existing runs`, async ({ page }) => {
  const { state } = await workspace(page, { lostCreate });
  await prepared(page); await consent(page);
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await expect(page.getByText('The service may have saved your run.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume training submission' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Check my runs' })).toHaveAttribute('href', '/train');
  expect(state.creates).toBe(1); expect(state.putAttempts).toEqual([]);
});

test('the teach flow sits inside the workspace with Train selected', async ({ page }) => {
  await workspace(page, {});
  await expect(page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Train', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Back to training' })).toHaveAttribute('href', '/train');
  await page.screenshot({ path: '.private/teach-in-console-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.private/teach-in-console-mobile.png', fullPage: true });
});

test('anonymous preparation stays local and sign-in opens separately to preserve files', async ({ page }) => {
  const { state } = await workspace(page, { signedIn: false });
  await prepared(page);
  await expect(page.getByRole('link', { name: 'Sign in to train' })).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('button', { name: 'Start training', exact: true })).toHaveCount(0);
  expect(state.mutations).toEqual([]);
});

for (const [enabled, pools] of [[true, false], [false, false], [true, true]]) test(`image teaching respects service availability (${enabled}, pools=${pools}) and submits reviewed photos`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { state, created } = await workspace(page, { imagesEnabled: enabled, pools });
  await page.getByRole('button', { name: 'Images', exact: true }).click();
  await page.getByLabel('What should the model decide?', { exact: true }).fill('Is this item damaged?');
  const photos = await page.evaluate(() => Array.from({ length: 6 }, (_, i) => { const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8; const context = canvas.getContext('2d')!; context.fillStyle = `rgb(${i * 31},30,80)`; context.fillRect(0, 0, 8, 8); return canvas.toDataURL().split(',')[1]; }));
  await page.locator('#teaching-photos').setInputFiles(photos.map((data, i) => ({ name: `photo-${i}.png`, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') })));
  await expect(page.getByLabel('Answer for photo-5.png', { exact: true })).toBeVisible();
  for (let i = 0; i < 6; i++) await page.getByLabel(`Answer for photo-${i}.png`, { exact: true }).selectOption(i % 2 ? 'Damaged' : 'Normal');
  await page.getByLabel('I checked the included photos, answers, and item references.').check();
  await page.getByRole('button', { name: 'Preview image splits' }).click();
  await page.getByLabel('Training run name', { exact: true }).fill('image-live');
  await expect(page.getByLabel('Answer the model must catch')).toHaveCount(0);
  expect(state.mutations).toEqual([]);
  if (pools) await page.getByLabel('Model pool', { exact: true }).selectOption('d3-lite');
  await consent(page);
  await page.screenshot({ path: '.private/teaching-live-review-mobile.png', fullPage: true });
  expect(await page.locator('body').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  if (!enabled) {
    await expect(page.getByRole('region', { name: 'Submit training run' }).getByRole('alert')).toContainText('Image training is unavailable');
    expect(state.creates).toBe(0);
    return;
  }
  await expect(page).toHaveURL(`/train?run=${jobId}`);
  expect(created()).toMatchObject({ model: pools ? lite.id : mini.id });
  expect(created()!.acceptance).toEqual({ min_accuracy: .8, min_brier_improvement: .01 });
  expect(state.assets).toHaveLength(6);
  const rows = Object.values(state.uploads).flatMap(file => file.trim().split('\n').map(line => JSON.parse(line)));
  expect(rows).toHaveLength(6);
  for (const row of rows) { expect(row.state).toEqual({}); expect(row.image.asset_id).toBeTruthy(); expect(row).not.toHaveProperty('filename'); }
});


test('pool selection remains fixed through interrupted text upload', async ({ page }) => {
  const { state, created } = await workspace(page, { pools: true, failUpload: true });
  await prepared(page);
  const pool = page.getByLabel('Model pool', { exact: true });
  await expect(pool).toHaveValue('d3-mini');
  await expect(pool.locator('option[value="d3-mini"]')).toContainText('z3-mini');
  await expect(pool.locator('option[value="d3-lite"]')).toContainText('z3-lite');
  await expect(pool.locator('option[value="d3-nano"]')).toBeDisabled();
  await pool.selectOption('d3-lite');
  await page.getByLabel('Base channel', { exact: true }).selectOption('latest');
  await consent(page);
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Submit training run' }).getByRole('alert')).toBeVisible();
  await expect(pool).toBeDisabled();
  expect(created()).toMatchObject({ pool: 'd3-lite', base_channel: 'latest', model: lite.id });
  await page.getByRole('button', { name: 'Resume training submission', exact: true }).click();
  await expect(page).toHaveURL(`/train?run=${jobId}`);
  expect(state.creates).toBe(1);
});

import { test, expect, type Page } from '@playwright/test';

const owner = '10000000-0000-4000-8000-000000000002';
const asset = '10000000-0000-4000-8000-000000000001';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGPkEpFjwAaYsIoOWgkANVwATIkpP+sAAAAASUVORK5CYII=', 'base64');
function session(id = owner, tag = 'initial') {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const user = { id, email: `${id}@example.com`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: expires, tag })).toString('base64url')}.fixture`;
  return { user, access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires };
}
async function workspace(page: Page, options: { expired?: boolean; disabled?: boolean; holdUpload?: boolean } = {}) {
  const mutations: string[] = [];
  let releaseUpload: (() => void) | undefined;
  await page.addInitScript(value => localStorage.setItem('zils-training-auth', JSON.stringify(value)), session());
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === 'http://127.0.0.1:3107') {
      if (url.pathname === '/api/access/session') return route.fulfill({ json: { status: 'active' } });
      return route.continue();
    }
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: session().user, headers });
    if (req.method() !== 'GET') mutations.push(req.method() + ' ' + url.pathname);
    if (url.pathname === '/v1/jobs') return route.fulfill({ json: { jobs: [] }, headers });
    if (url.pathname === '/v1/image-models') return route.fulfill({ status: options.disabled ? 503 : 200, json: { models: [{ name: 'image-stock', stock: true, capabilities: { modalities: ['image', 'text'] } }], training_enabled: false }, headers });
    if (url.pathname === '/v1/image-assets') return route.fulfill({ status: 201, headers, json: { asset: { id: asset, state: 'uploading', expires_at: '2099-01-01T00:00:00Z' }, upload: { url: `http://127.0.0.1:8998/storage/v1/object/upload/sign/zils-images/${owner}/${asset}/source?token=fixture`, method: 'PUT', headers: { 'x-upsert': 'false', 'Content-Type': 'application/octet-stream' } } } });
    if (req.method() === 'PUT') {
      if (options.holdUpload) await new Promise<void>(resolve => { releaseUpload = resolve; });
      return route.fulfill({ json: {}, headers }).catch(() => {});
    }
    if (url.pathname.endsWith('/complete')) return route.fulfill({ status: options.expired ? 401 : 200, headers, json: options.expired ? { error: { message: 'Session expired' } } : { id: asset, state: 'ready', sha256: 'a'.repeat(64), width: 1, height: 1, expires_at: '2099-01-01T00:00:00Z' } });
    if (req.method() === 'DELETE') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/v1/image-decisions') return route.fulfill({ headers, json: { model: 'image-stock', answers: { inspection: { type: 'choice', choice: 'Damaged', probabilities: { Normal: .4, Damaged: .6 }, confidence: .1, unknown_probability: .5, abstained: true } }, usage: { input_tokens: 442, output_tokens: 0 } } });
    return route.fulfill({ status: 404, json: {}, headers });
  });
  await page.goto('/train');
  await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
  return { mutations, release: () => releaseUpload?.() };
}
async function enterPhoto(page: Page) {
  await page.getByRole('tab', { name: 'Images', exact: true }).click();
  await page.getByLabel('Photo', { exact: true }).setInputFiles({ name: 'inspection.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Image decision', { exact: true }).fill('Is the product damaged?');
  await page.getByLabel('Possible answers', { exact: true }).fill('Normal\nDamaged');
}
async function changeSession(page: Page, id: string, tag: string) {
  await page.evaluate(value => {
    localStorage.setItem('zils-training-auth', JSON.stringify(value));
    const channel = new BroadcastChannel('zils-training-auth');
    channel.postMessage({ event: 'TOKEN_REFRESHED', session: value });
    setTimeout(() => channel.close(), 100);
  }, session(id, tag));
}

test('signed-in photo prediction displays Needs review and creates no key', async ({ page }) => {
  const { mutations } = await workspace(page);
  await enterPhoto(page);
  await page.getByRole('button', { name: 'Analyze image', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Needs review' })).toBeVisible();
  await expect(page.getByTestId('image-answer')).toHaveText('Needs review');
  expect(mutations.some(path => path.includes('/v1/keys'))).toBe(false);
  expect(mutations.some(path => path.includes('/api/playground'))).toBe(false);
});

test('expired finalize offers sign-in and corrupt image offers replacement', async ({ page }) => {
  await workspace(page, { expired: true });
  await enterPhoto(page);
  await page.getByRole('button', { name: 'Analyze image' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'sign in again' })).toBeVisible();
  await page.getByLabel('Photo', { exact: true }).setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('bad') });
  await expect(page.getByRole('alert').filter({ hasText: 'JPEG or PNG' })).toBeVisible();
});

test('same-owner token refresh preserves the photo and question on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await workspace(page); await enterPhoto(page);
  await changeSession(page, owner, 'refreshed');
  await expect(page.getByLabel('Image decision', { exact: true })).toHaveValue('Is the product damaged?');
  await expect(page.getByText('inspection.png', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Analyze image' }).click();
  await expect(page.getByTestId('image-answer')).toHaveText('Needs review');
  expect(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.private/image-mobile.png', fullPage: true });
});

test('switching owners during upload clears private state and stops prediction', async ({ page }) => {
  const { mutations, release } = await workspace(page, { holdUpload: true });
  await enterPhoto(page); await page.getByRole('button', { name: 'Analyze image' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Uploading photo' })).toBeVisible();
  await expect(page.getByLabel('Photo', { exact: true })).toBeDisabled();
  await changeSession(page, '20000000-0000-4000-8000-000000000002', 'switched');
  release();
  await expect(page.getByText('inspection.png', { exact: true })).not.toBeVisible();
  expect(mutations.some(path => path.endsWith('/v1/image-decisions'))).toBe(false);
});

test('unavailable image capability leaves text training usable', async ({ page }) => {
  await workspace(page, { disabled: true });
  await expect(page.getByRole('button', { name: 'Train a model', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Images', exact: true })).not.toBeVisible();
});

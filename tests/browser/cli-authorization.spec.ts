import { test, expect, type Page } from '@playwright/test';

const id = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const path = `/cli/authorize?authorization_id=${id}`;
const callback = 'http://127.0.0.1:43187/callback';
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const details = { authorization_id: id, redirect_uri: callback, client: { id: clientId, name: 'Zils CLI' }, user: { id, email: 'invited@example.com' }, scope: 'email' };

async function signedIn(page: Page) {
  await page.addInitScript(({ id }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const user = { id, email: 'invited@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
    const token = `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({ sub: id, exp: expires }))}.fixture`;
    localStorage.setItem('zils-training-auth', JSON.stringify({ user, access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires }));
  }, { id });
}

for (const action of ['Approve', 'Deny']) test(`signed-in CLI ${action.toLowerCase()} returns only the authorization result`, async ({ page }) => {
  await signedIn(page);
  let decisions = 0;
  await page.route('http://127.0.0.1:8998/auth/v1/oauth/authorizations/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ action: action.toLowerCase() });
      decisions++;
      return route.fulfill({ headers, json: { redirect_url: `${callback}?${action === 'Approve' ? 'code=fixture-code' : 'error=access_denied'}&state=expected` } });
    }
    return route.fulfill({ headers, json: details });
  });
  await page.route(callback + '**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Return to your terminal</h1>' }));
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toContainText('invited@example.com');
  await page.getByRole('button', { name: action, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Return to your terminal' })).toBeVisible();
  expect(decisions).toBe(1);
  expect(page.url()).not.toContain('access_token');
});

test('email sign-in preserves the CLI request and never creates accounts', async ({ page }) => {
  await page.route('http://127.0.0.1:8998/auth/v1/otp**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    expect(route.request().postDataJSON()).toMatchObject({ email: 'invited@example.com', create_user: false });
    expect(new URL(route.request().url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:3107' + path);
    return route.fulfill({ headers, json: {} });
  });
  await page.goto(path);
  await page.getByRole('textbox', { name: 'Email address' }).fill('invited@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Check your email');
});

test('Google sign-in preserves the CLI request', async ({ page }) => {
  await page.route('http://127.0.0.1:8998/auth/v1/authorize?**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Provider handoff</h1>' }));
  await page.goto(path);
  await page.getByRole('button', { name: 'Sign in with Google', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Provider handoff' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:3107' + path);
});

for (const bad of ['client', 'redirect', 'expired', 'unsafe-response']) test(`CLI approval rejects ${bad}`, async ({ page }) => {
  await signedIn(page);
  await page.route('http://127.0.0.1:8998/auth/v1/oauth/authorizations/**', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const json = bad === 'client' ? { ...details, client: { id } } : bad === 'redirect' ? { ...details, redirect_uri: 'https://attacker.example' } : bad === 'unsafe-response' ? { redirect_url: 'https://attacker.example?code=private-code' } : { error: 'expired' };
    return route.fulfill({ headers, status: bad === 'expired' ? 400 : 200, json });
  });
  await page.goto(path);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Start again with zils login');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
  expect(page.url()).toContain('/cli/authorize');
});

test('missing request and provider denial have clear recovery', async ({ page }) => {
  await page.goto('/cli/authorize');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Start again with zils login');
  await page.goto(path + '#error=access_denied&error_description=denied');
  await expect(page.getByRole('main').getByRole('alert')).toContainText("Sign-in wasn't completed");
});


test('legacy CLI product links still redirect while approval stays local', async ({ request }) => {
  for (const path of ['/cli', '/cli/install']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe('https://fez.chat' + path);
  }
  const approval = await request.get('/cli/authorize', { maxRedirects: 0 });
  expect(approval.status()).toBe(200);
});

test('CLI sign-in hydrates without replacing the server page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => { if (/hydrat/i.test(error.message)) errors.push(error.message); });
  page.on('console', message => { if (message.type() === 'error' && /hydrat/i.test(message.text())) errors.push(message.text()); });
  await page.goto(path);
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a previously consented request returns to the fixed CLI callback', async ({ page }) => {
  await signedIn(page);
  await page.route('http://127.0.0.1:8998/auth/v1/oauth/authorizations/**', route => route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers }) : route.fulfill({ headers, json: { redirect_url: callback + '?code=existing&state=expected' } }));
  await page.route(callback + '**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Return to your terminal</h1>' }));
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Return to your terminal' })).toBeVisible();
});

test('approval validates the returned redirect before the SDK can navigate', async ({ page }) => {
  await signedIn(page);
  await page.route('http://127.0.0.1:8998/auth/v1/oauth/authorizations/**', route => route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers }) : route.fulfill({ headers, json: route.request().method() === 'POST' ? { redirect_url: 'https://attacker.example?code=private-code' } : details }));
  await page.goto(path);
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Start again with zils login');
  expect(page.url()).toContain('/cli/authorize');
});

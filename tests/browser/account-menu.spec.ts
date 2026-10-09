import { test, expect, type Page } from '@playwright/test';

async function account(page: Page, signedIn = true, failSignOut = false) {
  const user = { id: '10000000-0000-4000-8000-000000000002', email: 'client@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString('base64url')}.browser-test`;
  if (signedIn) await page.addInitScript(({ user, token, expires }) => {
    if (!sessionStorage.getItem('account-fixture-seeded')) {
      localStorage.setItem('zils-training-auth', JSON.stringify({ user, access_token: token, refresh_token: 'browser-test', token_type: 'bearer', expires_in: 3600, expires_at: expires }));
      sessionStorage.setItem('account-fixture-seeded', 'true');
    }
  }, { user, token, expires });
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests.push(`${route.request().method()} ${url.pathname}`);
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: failSignOut ? 500 : 204, ...(failSignOut ? { json: { message: 'Test failure' } } : {}), headers });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user, headers });
    if (url.pathname === '/v1/jobs') return route.fulfill({ json: { jobs: [] }, headers });
    return route.fulfill({ status: 404, json: { error: 'Unexpected test request' }, headers });
  });
  return { requests, errors };
}

test('signed-out visitors join early access and invited users can find sign-in', async ({ page }) => {
  const { errors } = await account(page, false);
  await page.goto('/model');
  await page.locator('header').getByRole('link', { name: 'Early access', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Join Zils early access' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in to your workspace.' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Zils', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('account menu follows navigation and signing out clears both header and workspace', async ({ page }) => {
  const { requests, errors } = await account(page);
  await page.goto('/model');
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.getByText('client@example.com', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Your workspace', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Train a model', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.screenshot({ path: '.private/account-desktop.png' });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.locator('header').getByRole('link', { name: 'Early access', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in to Zils', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Train a model', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('header').getByRole('link', { name: 'Early access', exact: true })).toBeVisible();
  expect(requests.filter(request => request === 'POST /auth/v1/logout')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('server sign-out failure reports local sign-out honestly', async ({ page }) => {
  await account(page, true, true);
  await page.goto('/model');
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.locator('header').getByRole('alert')).toHaveText('Signed out on this device. Server sign-out could not be confirmed.');
  await expect(page.locator('header').getByRole('link', { name: 'Early access', exact: true })).toBeVisible();
});

test('account controls stay at the top on mobile and support keyboard dismissal', async ({ page }) => {
  await account(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/train');
  const trigger = page.getByRole('button', { name: 'Account', exact: true });
  await expect(trigger).toBeVisible();
  expect((await trigger.boundingBox())!.y).toBeLessThan(100);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.screenshot({ path: '.private/account-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await page.getByRole('heading', { name: 'Training', exact: true }).click({ position: { x: 5, y: 5 } });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

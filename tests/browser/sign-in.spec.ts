import { test, expect } from '@playwright/test';
import { signIn } from './signed-in';

test('Continue with Google starts OAuth and returns to /train', async ({ page }) => {
  await page.route('http://127.0.0.1:8998/auth/v1/authorize?**', route => route.fulfill({ contentType: 'text/html', body: '<h1>OAuth provider handoff</h1>' }));
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'OAuth provider handoff' })).toBeVisible();
  const url = new URL(page.url());
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:3107/train');
});

test('an emailed link never creates accounts; invite-only and success states show', async ({ page }) => {
  let attempts = 0;
  await page.route('http://127.0.0.1:8998/auth/v1/otp**', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'x-supabase-api-version', 'x-supabase-api-version': '2024-01-01' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    expect(route.request().postDataJSON()).toMatchObject({ email: 'invited@example.com', create_user: false });
    expect(new URL(route.request().url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:3107/train');
    attempts++;
    await route.fulfill({ headers, status: attempts === 1 ? 400 : 200, json: attempts === 1 ? { code: 'otp_disabled', msg: 'Signups not allowed for otp' } : {} });
  });
  await page.goto('/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).fill('invited@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('invite-only');
  await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue('invited@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your email.' })).toBeVisible();
  await expect(page.getByRole('status')).toBeFocused();
  expect(attempts).toBe(2);
});

test('a signed-in visitor goes straight to the workspace', async ({ page }) => {
  await signIn(page);
  await page.addInitScript(() => {
    (window as unknown as { seen: boolean }).seen = false;
    new MutationObserver(() => { if (document.getElementById('sign-in-email')) (window as unknown as { seen: boolean }).seen = true; }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/sign-in');
  await expect(page).toHaveURL(/\/train$/);
  expect(await page.evaluate(() => (window as unknown as { seen: boolean }).seen)).toBe(false);
});

test('the page has its own theme toggle and the early-access link', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('link', { name: 'Get early access', exact: true })).toHaveAttribute('href', '/early-access');
  await expect(page.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
});

test('the tags light in turn, and stay still under reduced motion', async ({ page }) => {
  await page.goto('/sign-in');
  const lit = () => page.locator('[class*="lit"]').first().textContent();
  const first = await lit();
  await expect.poll(lit, { timeout: 5000 }).not.toBe(first);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const still = await lit();
  await page.waitForTimeout(2200);
  expect(await lit()).toBe(still);
});

test.describe('phones', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  test('the halves stack, the tags drop and nothing scrolls sideways', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByText('Account changes', { exact: true })).toBeHidden();
    const art = await page.getByText('System 01').boundingBox();
    const heading = await page.getByRole('heading', { name: 'Sign in.' }).boundingBox();
    expect(heading!.y).toBeGreaterThan(art!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test('the empty status wrapper adds no height above the form', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('form', { name: 'Sign in to Zils' })).toBeVisible();
  expect((await page.getByRole('main').getByRole('status').boundingBox())!.height).toBe(0);
});

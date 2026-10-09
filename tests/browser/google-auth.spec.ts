import { test, expect } from '@playwright/test';

test('Google sign-in uses the existing auth project and returns to this website', async ({ page }) => {
  await page.route('http://127.0.0.1:8998/auth/v1/authorize?**', route => route.fulfill({
    contentType: 'text/html', body: '<h1>OAuth provider handoff</h1>',
  }));
  await page.goto('/train');
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in with Google', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'OAuth provider handoff' })).toBeVisible();
  const url = new URL(page.url());
  expect(url.origin).toBe('http://127.0.0.1:8998');
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:3107/train');
});

test('a cancelled OAuth callback explains the failure and leaves both sign-in options available', async ({ page }) => {
  await page.goto('/train#error=access_denied&error_description=The%20user%20denied%20access');
  await expect(page.getByRole('main').getByRole('alert')).toContainText("Sign-in wasn't completed");
  await expect(page.getByRole('button', { name: 'Sign in with Google', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Email me a sign-in link', exact: true })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeEnabled();
});

test('email sign-in never creates accounts and a rejected visitor can join the list', async ({ page }) => {
  let attempts = 0;
  await page.route('http://127.0.0.1:8998/auth/v1/otp**', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'x-supabase-api-version', 'x-supabase-api-version': '2024-01-01' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    expect(route.request().postDataJSON()).toMatchObject({ email: 'invited@example.com', create_user: false });
    expect(new URL(route.request().url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:3107/train');
    attempts++;
    await route.fulfill({ headers, status: attempts === 1 ? 400 : 200, json: attempts === 1 ? { code: 'otp_disabled', msg: 'Signups not allowed for otp' } : {} });
  });
  await page.goto('/train');
  await page.getByRole('textbox', { name: 'Email address' }).fill('invited@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Workspace access is by invitation');
  await expect(page.getByRole('link', { name: 'Join the early-access list', exact: true })).toHaveAttribute('href', '/early-access');
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue('invited@example.com');
  await page.screenshot({ path: '.private/invitation-only-sign-in.png' });
  await page.getByRole('button', { name: 'Email me a sign-in link', exact: true }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Check your email for a sign-in link');
  expect(attempts).toBe(2);
});

test('Google signup rejection explains invitation-only access without breaking sign-in', async ({ page }) => {
  await page.goto('/train#error=access_denied&error_code=signup_disabled&error_description=Signups%20not%20allowed%20for%20this%20instance');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Workspace access is by invitation');
  await expect(page.getByRole('button', { name: 'Sign in with Google', exact: true })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Join the early-access list', exact: true })).toBeVisible();
});

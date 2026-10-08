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
  await expect(page.getByRole('alert')).toContainText("Sign-in wasn't completed");
  await expect(page.getByRole('button', { name: 'Sign in with Google', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Email me a sign-in link', exact: true })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeEnabled();
});

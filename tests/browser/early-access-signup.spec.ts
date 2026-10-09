import { test, expect } from '@playwright/test';

test('new visitors join the email list while invited users can still sign in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('region', { name: 'Teach AI to make decisions your way.', exact: true }).getByRole('link', { name: 'Request early access', exact: true }).click();
  await expect(page).toHaveURL(/\/early-access$/);
  await expect(page.getByRole('form', { name: 'Join Zils early access' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in to your workspace.' }).click();
  await expect(page).toHaveURL(/\/train$/);
  await expect(page.getByText('Workspace access is by invitation. Sign in with the email address that was invited.')).toBeVisible();
  await page.getByRole('link', { name: 'Join the early-access list', exact: true }).click();
  await expect(page).toHaveURL(/\/early-access$/);
  await page.goto('/pricing');
  await expect(page.getByRole('link', { name: 'Request early access', exact: true }).first()).toHaveAttribute('href', '/early-access');
});

test('failed signup preserves the email and a retry confirms a successful save', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/email-signups', async route => {
    expect(route.request().postDataJSON()).toEqual({ email: 'builder@example.com', website: '' });
    attempts++;
    await route.fulfill({ status: attempts === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(attempts === 1 ? { error: 'Unavailable' } : { ok: true }) });
  });
  await page.goto('/early-access');
  await page.getByRole('textbox', { name: 'Email address' }).fill('builder@example.com');
  await page.getByRole('button', { name: 'Join early access', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText("Couldn't save your email");
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue('builder@example.com');
  await page.getByRole('button', { name: 'Join early access', exact: true }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText("You're on the early-access list");
  await expect(page.getByRole('button', { name: 'Join early access', exact: true })).toHaveCount(0);
  expect(attempts).toBe(2);
});

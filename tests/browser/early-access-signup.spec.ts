import { test, expect } from '@playwright/test';

test('the homepage opens training while early-access email signup remains available', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('region', { name: 'Teach AI to make decisions your way.', exact: true }).getByRole('link', { name: 'Train your own model', exact: true }).click();
  await expect(page).toHaveURL(/\/train$/);
  await expect(page.getByRole('heading', { name: 'Sign in to Zils', exact: true })).toBeVisible();
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Footer', exact: true }).getByRole('link', { name: 'Early access', exact: true }).click();
  await expect(page).toHaveURL(/\/early-access$/);
  await expect(page.getByRole('form', { name: 'Join Zils early access' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to your workspace.' })).toHaveAttribute('href', '/train');
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

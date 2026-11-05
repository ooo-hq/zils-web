import { test, expect } from '@playwright/test';

test('/early-access now sends visitors to sign up, and the CTAs go to sign-in', async ({ page }) => {
  await page.goto('/early-access');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Sign in.', level: 1 })).toBeVisible();
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'Get started', exact: true }).first().click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto('/pricing');
  await expect(page.getByRole('link', { name: 'Get started', exact: true }).first()).toHaveAttribute('href', '/sign-in');
  await expect(page.locator('a[href="/early-access"]')).toHaveCount(0);
});

test('the honeypot stays in the contact form but hidden', async ({ page }) => {
  await page.goto('/contact');
  const hp = page.getByRole('form', { name: 'Contact Zils' }).locator('input[name="website"]');
  await expect(hp).toHaveCount(1);
  await expect(hp).toBeHidden();
});

test('contact shows a confirmation once the message is sent', async ({ page }) => {
  await page.route('**/api/contact', route => route.fulfill({ json: { ok: true } }));
  await page.goto('/contact');
  await page.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('ada@example.com');
  await page.getByRole('textbox', { name: 'How can we help?' }).fill('Hello');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('heading', { name: 'Message sent.' })).toBeVisible();
  await expect(page.getByText('ada@example.com')).toBeVisible();
  await expect(page.getByRole('status')).toBeFocused();
});

test('the Company field shows Optional once and describes the input with it', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByText('Optional', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Optional', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Company' })).toHaveAccessibleDescription('Optional');
});

import { test, expect } from '@playwright/test';

test('new visitors join the email list while invited users can sign in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'Request early access', exact: true }).first().click();
  await expect(page).toHaveURL(/\/early-access$/);
  await expect(page.getByRole('form', { name: 'Join Zils early access' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in to your workspace' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Sign in.', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Get early access', exact: true }).click();
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
  await expect(page.getByRole('main').getByRole('status')).toContainText("You’re on the list.");
  await expect(page.getByRole('main').getByRole('status')).toContainText('We’ll email you with access updates.');
  await expect(page.getByRole('main').getByRole('status').locator('[tabindex="-1"]')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Join early access', exact: true })).toHaveCount(0);
  expect(attempts).toBe(2);
});

test('the honeypot stays in the form but hidden, on both forms', async ({ page }) => {
  for (const [path, form] of [['/early-access', 'Join Zils early access'], ['/contact', 'Contact Zils']]) {
    await page.goto(path);
    const hp = page.getByRole('form', { name: form }).locator('input[name="website"]');
    await expect(hp).toHaveCount(1);
    await expect(hp).toBeHidden();
  }
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

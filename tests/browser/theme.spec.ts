import { test, expect } from '@playwright/test';

test('theme follows the device until the visitor chooses, then survives navigation and reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toBeVisible();
  const lightBackground = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
  await page.screenshot({ path: '.private/theme-home-light-desktop.png', animations: 'disabled' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByRole('button', { name: 'Light mode', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(lightBackground);
  await page.screenshot({ path: '.private/theme-home-dark-desktop.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Light mode', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveCSS('background-color', lightBackground);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('body')).toHaveCSS('background-color', lightBackground);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'research' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', lightBackground);
  expect(errors).toEqual([]);
});

test('saved dark mode applies before hydration and synchronizes across tabs', async ({ context, page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  const second = await context.newPage();
  await second.emulateMedia({ colorScheme: 'light' });
  // Blocking app scripts leaves only the inline theme bootstrap running.
  await second.route('**/_next/**/*.js*', route => route.abort());
  await second.goto('/contact');
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(second.getByRole('textbox', { name: 'Name', exact: true })).toHaveCSS('color-scheme', 'dark');
  await second.unroute('**/_next/**/*.js*');
  await second.reload();
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Dark mode', exact: true })).toBeVisible();
});

test('mobile dark mode covers public pages without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const route of ['/', '/model', '/playground', '/train', '/contact']) {
    await page.goto(route);
    await expect(page.getByRole('button', { name: 'Light mode', exact: true })).toBeVisible();
    const background = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    await expect(page.locator('body > div:visible').first()).toHaveCSS('background-color', background);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.private/theme-${route.slice(1) || 'home'}-mobile.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('theme still switches when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'research' }).click();
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toBeVisible();
});

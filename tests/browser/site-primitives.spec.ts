import { test, expect } from '@playwright/test';

const URL = '/dev-preview/site-primitives';

test('reduced motion: reveals are in and CountUp shows its final value', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL);
  const reveals = page.locator('[data-reveal]');
  expect(await reveals.count()).toBeGreaterThan(0);
  for (const el of await reveals.all()) await expect(el).toHaveAttribute('data-in', '');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('79.2%');
});

test('score bar fills reach full width after scrolling into view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(URL);
  const fills = page.locator('[data-fill]');
  await expect(fills.first()).toHaveCSS('transform', 'matrix(0, 0, 0, 1, 0, 0)');
  await page.locator('#bars-fixture').scrollIntoViewIfNeeded();
  for (const el of await fills.all()) await expect(el).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)', { timeout: 2000 });
});

test('DetailsRow opens on Enter', async ({ page }) => {
  await page.goto(URL);
  const summary = page.locator('details > summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details')).toHaveAttribute('open', '');
});

test('no horizontal overflow at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(URL);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('reduced motion: score bars are full width without scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL);
  for (const el of await page.locator('[data-fill]').all()) await expect(el).toHaveCSS('transform', /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('reveals are visible and CountUp shows its final value', async ({ page }) => {
    await page.goto(URL);
    for (const el of await page.locator('[data-reveal]').all()) await expect(el).toHaveCSS('opacity', '1');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('79.2%');
    for (const el of await page.locator('[data-fill]').all()) await expect(el).toHaveCSS('transform', /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });
});

import { test, expect } from '@playwright/test';
import baseline from './fixtures/content-baseline.json';

for (const route of ['privacy', 'terms'] as const) {
  test(`/${route} index lists the H2s in order and keeps paragraph count`, async ({ page }) => {
    await page.goto(`/${route}`);
    const items = await page.getByRole('navigation', { name: 'On this page' }).locator('a').allInnerTexts();
    expect(items.map(t => t.replace(/^\d+\s*/, '').trim())).toEqual(baseline[route].h2);
    expect(await page.locator('main h2').allInnerTexts()).toEqual(baseline[route].h2);
    expect(await page.locator('main p').count()).toBe(baseline[route].paragraphs);
  });
}

test('unknown route is a 404 with a way back', async ({ page }) => {
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No decision for this page.');
  await expect(page.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'See examples' })).toHaveAttribute('href', '/examples');
});

test('at 930px the empty index column is gone and nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 930, height: 900 });
  await page.goto('/privacy');
  const article = page.locator('main article');
  const box = (await article.boundingBox())!;
  const main = (await page.locator('main').boundingBox())!;
  expect(await page.locator('main aside').evaluate(el => getComputedStyle(el).display)).toBe('none');
  expect(box.x).toBeLessThanOrEqual(main.x + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

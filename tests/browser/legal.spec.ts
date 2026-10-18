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

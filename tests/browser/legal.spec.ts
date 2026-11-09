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

test('privacy and terms commit to not storing paid real-time text requests', async ({ page }) => {
  await page.goto('/privacy');
  const kept = page.locator('#what-we-keep-from-model-requests');
  await expect(kept).toContainText('we do not store what you send or the predictions we return');
  await expect(kept).toContainText('token counts');
  await expect(kept).toContainText('seven days');
  await expect(kept.getByRole('link', { name: 'free tier terms' })).toHaveAttribute('href', '/free-tier-terms');
  await expect(page.getByText('Updated 7 November 2026')).toBeVisible();
  await page.goto('/terms');
  const data = page.locator('#your-request-data');
  await expect(data).toContainText('does not store the content of the request or the predictions it returns');
  await expect(data.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/privacy#what-we-keep-from-model-requests');
  await expect(page.getByText('its model files cannot be downloaded')).toBeVisible();
  await expect(page.getByText('Updated 9 November 2026')).toBeVisible();
});

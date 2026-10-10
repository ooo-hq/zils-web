import { test, expect } from '@playwright/test';

test('research links to the B300 study and its downloadable evidence', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/model');
  await page.getByRole('link', { name: 'Practical models for miners', exact: true }).click();
  await expect(page).toHaveURL(/\/model\/b300-study$/);
  await expect(page.getByRole('heading', { name: 'Practical models for miners.', exact: true })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://zils.ai/model/b300-study');
  const scores = page.getByRole('region', { name: 'Miner model scores', exact: true });
  for (const count of ['415 / 500', '412 / 500', '404 / 500']) await expect(scores).toContainText(count);
  await expect(page.locator('#miner-results')).toContainText('Both cohorts were reused');
  await page.getByText('Numerical checks, recovery, and calibration limits', { exact: true }).click();
  await expect(page.locator('#method')).toContainText('FP32 equivalence was not established');
  const links = await page.getByRole('navigation', { name: 'B300 study evidence' }).getByRole('link').evaluateAll(elements => elements.map(el => el.getAttribute('href')!));
  expect(links).toHaveLength(8);
  for (const href of links) expect((await request.get(href)).ok(), href).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: '.private/b300-desktop.png', fullPage: true });
});

test('B300 tables are keyboard scrollable without overflowing mobile screens', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/model/b300-study');
    await page.getByText('Numerical checks, recovery, and calibration limits', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const scores = page.getByRole('region', { name: 'Miner model scores', exact: true });
    await scores.focus();
    await page.keyboard.press('End');
    await expect(scores).toBeFocused();
    expect(await scores.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.screenshot({ path: `.private/b300-mobile-${width}.png`, fullPage: true });
  }
});

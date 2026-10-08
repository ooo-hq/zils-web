import { test, expect } from '@playwright/test';

test('research links to the complete chess comparison and its downloadable evidence', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/model');
  const summary = page.locator('#chess-study');
  await expect(summary).toContainText('260 of 512');
  await expect(summary).toContainText('100%');
  await summary.getByRole('link', { name: 'Read the chess study' }).click();
  await expect(page).toHaveURL(/\/model\/chess-study$/);
  await expect(page.getByRole('heading', { name: 'Mate-in-one chess study.', exact: true })).toBeVisible();
  // Streamed metadata can briefly overlap the previous route during navigation.
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://zils.ai/model/chess-study');
  for (const score of ['50.78%', '43.55%', '42.97%']) {
    await expect(page.locator('figure').getByText(score, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Paired 95% interval: \+3.32 to \+12.11/)).toBeVisible();
  await expect(page.getByText(/Paired 95% interval: \+2.15 to \+12.30/)).toBeVisible();
  await page.screenshot({ path: '.private/chess-desktop.png', fullPage: true });
  await page.getByText('All scores, training method, and reliability', { exact: true }).click();
  const table = page.getByRole('region', { name: 'Chess study model scores' });
  for (const count of ['260 / 512', '223 / 512', '220 / 512']) await expect(table).toContainText(count);
  const evidence = page.getByRole('navigation', { name: 'Chess study evidence' });
  const links = await evidence.getByRole('link').evaluateAll(elements => elements.map(element => element.getAttribute('href')!));
  expect(links).toHaveLength(5);
  for (const href of links) {
    const response = await request.get(href);
    expect(response.ok(), href).toBe(true);
    expect(await response.text(), href).toContain('chess-001');
  }
  expect(errors).toEqual([]);
});

test('chess scores and expanded evidence fit narrow screens in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/model/chess-study');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByText('All scores, training method, and reliability', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const scores = page.getByRole('region', { name: 'Chess study model scores' });
    await scores.focus();
    await page.keyboard.press('End');
    await expect(scores).toBeFocused();
    await page.screenshot({ path: `.private/chess-mobile-${width}.png`, fullPage: true });
  }
});

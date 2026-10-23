import { expect, test } from '@playwright/test';

test('z3 launch distinguishes the founding baseline from planned and elected releases', async ({ page }) => {
  await page.goto('/z3');
  await expect(page).toHaveTitle('z3 — the Zils decision-model line');
  await expect(page.getByRole('heading', { name: 'z3', exact: true })).toBeVisible();
  const lineup = page.getByRole('table', { name: 'z3 model line and release status' });
  await expect(lineup.getByRole('row')).toHaveCount(6);
  await expect(lineup.getByRole('row', { name: /z3-mini/ })).toContainText('v1 · Founding baseline');
  await expect(lineup.getByText('Planned release', { exact: true })).toHaveCount(4);
  await expect(page.getByText('It was not trained by Zils or elected as a miner winner.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore the founding weights on Hugging Face' })).toHaveAttribute('href', /d3-mini-4\.5b-v1\/tree\/b54402a963373cc44713f18c9596c580e31cc68b$/);
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'z3 models' })).toHaveAttribute('aria-current', 'page');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('the homepage leads to z3 while existing research routes remain available', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Explore z3 models', exact: true }).click();
  await expect(page).toHaveURL('/z3');
  await page.getByRole('link', { name: 'Read the research', exact: true }).click();
  await expect(page).toHaveURL('/model');
  await expect(page.getByRole('link', { name: 'z3, the Zils model line', exact: true })).toBeVisible();
});

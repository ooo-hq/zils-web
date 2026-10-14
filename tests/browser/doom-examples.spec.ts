import { test, expect } from '@playwright/test';

test('Doom comparison opens first with both recordings, outcomes on end, and the full table', async ({ page }) => {
  await page.goto('/examples');
  await expect(page.getByRole('button', { name: /Survive Doom/ })).toHaveAttribute('aria-pressed', 'true');
  const zils = page.getByRole('region', { name: 'Zils recording', exact: true });
  const jev = page.getByRole('region', { name: 'TypeSafe JEV recording', exact: true });
  await expect(zils.getByRole('definition').first()).toHaveText('9.7 s');
  await expect(jev.getByRole('definition').first()).toHaveText('2.2 s');
  await expect(zils).toContainText('162');
  await page.evaluate(() => document.querySelectorAll('video').forEach(video => video.dispatchEvent(new Event('ended'))));
  await expect(zils).toContainText('Collected the armor at 9.7 s');
  await expect(jev).toContainText('Died at 2.2 s');
  await page.getByText('Behind this game', { exact: true }).click();
  await expect(page.getByText(/Test seed 100001 is a selected highlight/)).toBeVisible();
  await page.getByText('Compare scores and read study details', { exact: true }).click();
  await expect(page.getByRole('table').first()).toContainText('Scripted reference');
  await expect(page.getByRole('table').first()).toContainText('97/100');
  await expect(page.getByText(/seed 100085, was an operator-interrupted episode/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'All 100 starts (CSV)' })).toHaveAttribute('href', '/examples/doom/all-100-seeds.csv');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(zils).toContainText('Ready');
});

test('Doom comparison stacks on a phone without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/examples');
  await expect(page.getByRole('region', { name: 'TypeSafe JEV recording', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

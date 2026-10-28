import { test, expect } from '@playwright/test';
import { signIn } from './signed-in';

// An invited account with no runs lands on the empty Training workspace, so it must offer a next step (ZIL-45).
test('empty Training workspace welcomes the account with three starting points', async ({ page }) => {
  await signIn(page);
  await page.route('**/v1/jobs*', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' },
    json: { jobs: [], models: [] },
  }));
  await page.goto('/train');
  await expect(page.getByRole('heading', { name: 'Welcome to Zils.' })).toBeVisible();
  const choices = page.getByRole('main').getByRole('link').filter({ has: page.getByRole('strong') });
  await expect(choices).toHaveCount(3);
  expect(await choices.evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(['/train/teach', '/playground', '/keys']);
  await expect(choices.getByRole('strong')).toHaveText(['Start training', 'Try a model', 'Create an API key']);
  // Three columns collapse to one on a phone instead of scrolling sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await expect(page.getByRole('main').getByRole('link').filter({ has: page.getByRole('strong') })).toHaveCount(3);
});

import { test, expect } from '@playwright/test';
import { signIn } from './signed-in';

test.use({ storageState: { cookies: [], origins: [] } });

// An invited account with no runs is welcomed once by a dialog offering three next steps (ZIL-45).
test('empty Training workspace opens a one-time welcome dialog with three starting points', async ({ page }) => {
  await signIn(page);
  await page.route('**/v1/jobs*', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' },
    json: { jobs: [], models: [] },
  }));
  await page.goto('/train');
  const dialog = page.getByRole('dialog', { name: 'Welcome to Zils.' });
  await expect(dialog).toBeVisible();
  const choices = dialog.getByRole('link');
  await expect(choices).toHaveCount(3);
  expect(await choices.evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(['/train/teach', '/playground', '/keys']);
  await expect(choices.getByRole('strong')).toHaveText(['Start training', 'Try a model', 'Create an API key']);
  // The dialog fits a phone without sideways scrolling.
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  // Closing leaves the ordinary empty workspace, and the welcome does not return.
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Train your first model.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Train your first model.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

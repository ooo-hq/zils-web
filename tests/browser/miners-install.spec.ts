import { test, expect } from '@playwright/test';

test('miners page shows the install command and copies it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/miners');
  const install = page.getByRole('region', { name: 'Start mining' });
  await expect(install.getByLabel('Miner install command')).toHaveText('$ curl -fsSL https://zils.ai/install.sh | sh');
  await install.getByRole('button', { name: 'Copy' }).click();
  await expect(install.getByRole('status')).toHaveText('Install command copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('curl -fsSL https://zils.ai/install.sh | sh');
});

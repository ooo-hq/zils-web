import { test, expect } from '@playwright/test';
import { signIn } from './signed-in';

test.use({ storageState: { cookies: [], origins: [] } });

// Most customers will train through an agent: the Training page gives the one-line MCP setup and what to ask.
test('Training offers the commands to train with Claude Code or Codex', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page);
  await page.route('**/v1/jobs*', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' },
    json: { jobs: [], models: [] },
  }));
  await page.goto('/train');
  await page.getByRole('dialog', { name: 'Welcome to Zils.' }).getByRole('button', { name: 'Close' }).click();

  const card = page.getByRole('region', { name: 'Train with your agent' });
  await expect(card).toBeVisible();
  // It leads the page, above the first-run prompt and any runs.
  const below = (await page.getByRole('heading', { name: 'Train your first model.' }).boundingBox())!.y;
  expect((await card.boundingBox())!.y).toBeLessThan(below);
  await expect(card.getByRole('button', { name: 'Claude Code' })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByLabel('Add Zils to your agent')).toHaveText('$ claude mcp add zils -- npx -y @zils/cli mcp');
  await expect(card.getByLabel('Sign in once')).toHaveText('$ npx -y @zils/cli login');
  await expect(card).toContainText('Train a Zils model on tickets.csv that decides the team.');

  await card.getByRole('button', { name: 'Codex' }).click();
  await expect(card.getByRole('button', { name: 'Codex' })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByLabel('Add Zils to your agent')).toHaveText('$ codex mcp add zils -- npx -y @zils/cli mcp');
  await card.getByRole('button', { name: 'Copy' }).first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('codex mcp add zils -- npx -y @zils/cli mcp');

  // It fits a phone without sideways scrolling.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

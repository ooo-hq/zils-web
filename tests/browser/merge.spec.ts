import { expect, test, type Page } from '@playwright/test';

const command = (page: Page) => page.locator('pre[aria-label="Merge command"] code');
const stage = (page: Page) => page.locator('[data-merge-stage]');

test('the mix starts from the house models and the market adds to it', async ({ page }) => {
  await page.goto('/merge');
  await expect(command(page)).toHaveText('npx @zils/cli merge vllm-sr/d3-lite internlm/Intern-Decision-0.8B --out ./my-merge');
  await expect(stage(page).locator('svg path')).toHaveCount(2);

  await page.getByRole('button', { name: 'Add jiwo to the mix' }).click();
  await expect(command(page)).toHaveText('npx @zils/cli merge vllm-sr/d3-lite internlm/Intern-Decision-0.8B eljiwo/jiwo-0.8b --out ./my-merge');
  await expect(stage(page).locator('svg path')).toHaveCount(3);
  await expect(page.getByRole('list', { name: 'In the mix' }).getByRole('listitem')).toHaveCount(3);
});

test('parts, the first model and taking one out change the command', async ({ page }) => {
  await page.goto('/merge');
  await page.getByRole('button', { name: 'Add jiwo to the mix' }).click();
  await page.getByRole('button', { name: 'More jiwo' }).click();
  await expect(command(page)).toContainText('--weights 1,1,2');
  await expect(stage(page)).toContainText('1:1:2');

  await page.getByRole('button', { name: 'Make Intern Decision first' }).click();
  await expect(command(page)).toContainText('merge internlm/Intern-Decision-0.8B vllm-sr/d3-lite eljiwo/jiwo-0.8b ');

  await page.getByRole('button', { name: 'Take d3-lite out' }).click();
  await expect(command(page)).toHaveText('npx @zils/cli merge internlm/Intern-Decision-0.8B eljiwo/jiwo-0.8b --out ./my-merge --weights 1,2');
});

test('the mix holds five, and SLERP needs exactly two', async ({ page }) => {
  await page.goto('/merge');
  const slerp = page.getByRole('radio', { name: /SLERP/ });
  await slerp.check();
  await expect(stage(page)).toHaveAttribute('data-method', 'slerp');
  await expect(command(page)).toContainText('--method slerp');
  for (const name of ['jiwo', 'Cribl Decision 2', 'Matilda Edge']) await page.getByRole('button', { name: `Add ${name} to the mix` }).click();
  await expect(slerp).toBeDisabled();
  await expect(stage(page)).toHaveAttribute('data-method', 'linear');
  await expect(command(page)).not.toContainText('--method');
  await expect(page.getByRole('button', { name: 'Add decider to the mix' })).toBeDisabled();
});

test('specialties filter the market, and Mini starts from its house models', async ({ page }) => {
  await page.goto('/merge');
  await page.getByRole('radio', { name: 'Chinese' }).check();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'KnowLine Gen1' })).toBeVisible();

  await page.getByRole('radio', { name: /Mini/ }).check();
  await expect(command(page)).toHaveText('npx @zils/cli merge vllm-sr/d3-mini perplexity-ai/pplx-decider-flash-v1.2 torchcast-ai/torchcast-decision-4b Maincode/Matilda-Decision-v1-Mini PelaAI/KnowLine-4B-Gen5 --out ./my-merge');
  await expect(page.getByRole('button', { name: 'Add jiwo to the mix' })).toHaveCount(0);
});

test('fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/merge');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(stage(page).locator('svg path')).toHaveCount(2);
});

test('the header merges five colours into one tile, and stays still for reduced motion', async ({ page }) => {
  await page.goto('/merge');
  await expect(page.getByRole('heading', { level: 1, name: 'Merge models' })).toBeVisible();
  const art = page.locator('[data-merge-hero]');
  await expect(art).toHaveAttribute('aria-hidden', 'true');
  await expect(art.locator('[data-sheet]')).toHaveCount(5);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(art.locator('[data-merged]')).toHaveCSS('opacity', '1');
});

test('hovering the header splits the tile back into its five colours', async ({ page }) => {
  await page.goto('/merge');
  const art = page.locator('[data-merge-hero]');
  await expect(art.locator('[data-merged]')).toHaveCSS('opacity', '1', { timeout: 5000 });
  await page.locator('header', { has: page.getByRole('heading', { level: 1 }) }).hover();
  await expect(art.locator('[data-merged]')).toHaveCSS('opacity', '0');
  await expect(art.locator('[data-sheet="1"]')).not.toHaveCSS('opacity', '0');
  await page.mouse.move(0, 0);
  await expect(art.locator('[data-merged]')).toHaveCSS('opacity', '1');
});

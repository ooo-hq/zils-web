import { expect, test } from '@playwright/test';

test('/soup explains the greedy soup: seats, crown, house rules and the measured result', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', e => errors.push(e));
  await page.goto('/soup');
  await expect(page).toHaveTitle('Greedy soup — how z3-mini is made');
  await expect(page.getByRole('heading', { name: 'Greedy soup.', level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: /bowl of soup/i })).toBeVisible();

  const steps = page.getByRole('list', { name: 'How a soup is made' }).getByRole('listitem');
  await expect(steps).toHaveCount(5);
  await expect(steps.nth(2)).toContainText('only if the soup scores at least 0.3 points higher');

  const bill = page.getByRole('table', { name: 'Who gets paid' });
  await expect(bill.getByRole('row', { name: /Soup seats/ })).toContainText('80%');
  await expect(bill.getByRole('row', { name: /Solo crown/ })).toContainText('20%');
  for (const [who, rate] of [['Trainer', '1×'], ['Scout', '0.25×'], ['House model', '0']]) {
    await expect(page.getByRole('table', { name: 'Seat rates' }).getByRole('row', { name: new RegExp(who) })).toContainText(rate);
  }

  await expect(page.locator('main code', { hasText: 'Qwen/Qwen3.5-4B' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read the miner guide' })).toHaveAttribute('href', 'https://docs.zils.ai/operations/soup');
  await expect(page.locator('#start')).toContainText('zils commit-body');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Miners' })).toHaveAttribute('aria-current', 'page');

  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('/miners and /z3 point to the soup', async ({ page }) => {
  await page.goto('/z3');
  await page.getByRole('link', { name: 'How the soup is made', exact: true }).click();
  await expect(page).toHaveURL('/soup');
  await page.goto('/miners');
  await expect(page.getByRole('link', { name: 'Bring a body to the soup', exact: true })).toHaveAttribute('href', '/soup');
});

// zils origin/main 16b87a6: zils/data/soup-house.json and docs/mining.md "Soup pool".
const HOUSE = [
  ['d3-mini', 'vllm-sr/d3-mini'],
  ['pplx-decider-flash-v1.2', 'perplexity-ai/pplx-decider-flash-v1.2'],
  ['torchcast-decision-4b', 'torchcast-ai/torchcast-decision-4b'],
  ['Matilda-Decision-v1-Mini', 'Maincode/Matilda-Decision-v1-Mini'],
  ['KnowLine-4B-Gen5', 'PelaAI/KnowLine-4B-Gen5'],
];

async function expectIngredients(page: import('@playwright/test').Page) {
  const built = page.getByRole('region', { name: 'What the mini soup is built from' });
  await expect(built.getByRole('link', { name: 'Qwen/Qwen3.5-4B' })).toHaveAttribute('href', /huggingface\.co\/Qwen\/Qwen3\.5-4B/);
  for (const [name, repo] of HOUSE) {
    await expect(built.getByRole('link', { name })).toHaveAttribute('href', new RegExp(`huggingface\\.co/${repo.replace('.', '\\.')}`));
  }
  await expect(built).toContainText('never paid');
}

test('/soup states the crown bar, house rates and house models without internal scores or dates', async ({ page }) => {
  await page.goto('/soup');
  const crown = page.getByRole('table', { name: 'Who gets paid' }).getByRole('row', { name: /Solo crown/ });
  await expect(crown).toContainText('beats every house model and the current soup by at least 0.3');
  await expect(page.getByRole('table', { name: 'Seat rates' }).getByRole('row', { name: /House mix/ })).toContainText('0.25×');
  await expectIngredients(page);
  const text = await page.locator('main').innerText();
  for (const banned of ['+4.26', '+6.63', 'as of', '30 Oct', 'testnet']) expect(text).not.toContain(banned);
});

test('/miners shows the mini soup and its ingredients; other pools stay king of the hill', async ({ page }) => {
  await page.goto('/miners');
  const lane = page.getByRole('heading', { name: 'Three ways to earn' }).locator('..').locator('..').getByRole('listitem').filter({ hasText: 'Base tier' }).first();
  await expect(lane).toContainText('Soup seats and a crown');
  await expect(lane).toContainText('Last five kings');
  await expect(lane).not.toContainText('testnet');
  const base = page.locator('div#base-tier');
  await expect(base).toContainText('Lite, nano, flash and z3 stay king of the hill');
  await expect(base).not.toContainText('testnet');
  await expectIngredients(page);
  await expect(page.locator('main')).not.toContainText('status as of');
  await expect(page.getByRole('heading', { name: 'Start mining' }).locator('..')).toContainText('zils commit-body');
});

test('/z3 explains that a z3-mini release is a soup that passed the release gate', async ({ page }) => {
  await page.goto('/z3');
  const releases = page.getByRole('region', { name: 'Each new release earns its place.' });
  await expect(releases).toContainText('release gate');
  await expectIngredients(page);
  await expect(page.locator('main')).not.toContainText('testnet');
});

test('/z3 separates the nightly soup from the release window and records soup members', async ({ page }) => {
  await page.goto('/z3');
  await expect(page.getByText(/approved winners \(for mini, the best soup\)/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start mining', exact: true })).toHaveAttribute('href', '/miners');
  const current = page.getByRole('region', { name: 'v1 today, a soup next.' });
  await expect(current).toContainText('current release');
  await expect(current).toContainText('one of the five house models');
  await expect(page.locator('main')).not.toContainText('A documented starting point');
  const steps = page.getByRole('region', { name: 'Each new release earns its place.' }).getByRole('list').first().getByRole('listitem');
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(1)).toContainText('Every night');
  await expect(steps.nth(2)).toContainText('Every 14 to 28 days');
  await expect(steps.nth(3)).toContainText('member list');
  await expect(page.getByRole('figure', { name: 'Release cadence' })).toContainText('Release window');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

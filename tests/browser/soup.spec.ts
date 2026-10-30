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
  // zils soup_round.crown_weight: the best solo body that is not a house ingredient, times its rate; no margin.
  await expect(bill.getByRole('row', { name: /Solo crown/ })).toContainText('best single body that is not a house ingredient');
  await expect(bill).not.toContainText('beats every house body');
  for (const [who, rate] of [['Trainer', '1×'], ['Scout', '0.25×'], ['House ingredient', '0']]) {
    await expect(page.getByRole('table', { name: 'Seat rates' }).getByRole('row', { name: new RegExp(who) })).toContainText(rate);
  }

  // The 30 Oct result was outside open models, not miners, and not a release.
  const taste = page.getByRole('region', { name: 'Taste test' });
  await expect(taste).toContainText('+4.26');
  await expect(taste).toContainText('+6.63');
  await expect(taste).toContainText('not miner submissions');
  await expect(taste).toContainText('not a release');

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

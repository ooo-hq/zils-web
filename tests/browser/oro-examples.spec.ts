import { test, expect } from '@playwright/test';

test('shopper story teaches a direct question before comparing the quoted-question mistake', async ({ page }) => {
  const inferenceRequests: string[] = [];
  page.on('request', req => { if (/systemone|chat\/completions/.test(req.url())) inferenceRequests.push(req.url()); });
  await page.goto('/examples');
  const zils = page.getByRole('region', { name: 'Zils shopper outcome', exact: true });
  const jev = page.getByRole('region', { name: 'TypeSafe JEV shopper outcome', exact: true });
  const compare = page.getByRole('button', { name: 'Compare Zils and JEV', exact: true });
  await expect(page.getByRole('button', { name: /Guide a shopper/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/ORO tests shopping AIs with a simulated shopper/)).toBeVisible();
  await expect(page.getByLabel('Try a situation')).toHaveValue('0');
  await expect(zils).toHaveCount(0);
  await compare.focus();
  await page.keyboard.press('Enter');
  for (const model of [zils, jev]) {
    await expect(model).toContainText('Shopper shares the answer');
    await expect(model).toContainText('Correct');
    await expect(model).toContainText('Pattern: stripes');
  }
  await page.getByRole('button', { name: 'Try the quoted review' }).click();
  await expect(compare).toBeFocused();
  await expect(zils).toHaveCount(0);
  await expect(page.getByLabel('Try a situation')).toHaveValue('1');
  await expect(page.getByText(/This is somebody else’s question inside a review/)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(zils).toContainText('Shopper keeps the answer hidden');
  await expect(zils).toContainText('Nothing yet');
  await expect(jev).toContainText('Incorrect');
  await expect(jev).toContainText('Pattern: stripes');
  await expect(page.getByText(/JEV gives the assistant an answer it never asked/)).toBeVisible();
  await page.getByText('Behind this decision', { exact: true }).click();
  await expect(page.getByRole('table').first()).toContainText('77.0% yes');
  await page.getByRole('button', { name: 'Try two questions at once' }).click();
  await compare.click();
  for (const model of [zils, jev]) {
    await expect(model).toContainText('Shopper asks for one question');
    await expect(model).toContainText('Correct');
    await expect(model).toContainText('Nothing yet');
  }
  await page.getByRole('button', { name: 'Reset comparison' }).click();
  await expect(zils).toHaveCount(0);
  await page.getByLabel('Try a situation').selectOption('0');
  await compare.click();
  await expect(zils).toContainText('Shopper shares the answer');
  await page.getByRole('button', { name: /Play a move/ }).click();
  await expect(page.getByText('One move to win', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Guide a shopper/ }).click();
  await expect(zils).toHaveCount(0);
  expect(inferenceRequests).toEqual([]);
});

test('shopper story and evidence fit a narrow screen with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/examples');
  await page.getByRole('button', { name: 'Compare Zils and JEV', exact: true }).click();
  await page.getByRole('button', { name: 'Try the quoted review' }).click();
  await page.getByRole('button', { name: 'Compare Zils and JEV', exact: true }).click();
  await page.getByText('Behind this decision', { exact: true }).click();
  await page.getByText('Compare scores and read study details', { exact: true }).click();
  await expect(page.getByText(/180\/180/).first()).toBeVisible();
  await expect(page.getByText(/An untrained baseline was not measured/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

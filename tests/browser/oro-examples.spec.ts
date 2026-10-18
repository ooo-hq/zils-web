import { test, expect } from '@playwright/test';
import oro from '../../data/oro-examples.json';

test('shopper demo shows the quoted-question disagreement, then cycles recorded situations', async ({ page }) => {
  const inferenceRequests: string[] = [];
  page.on('request', req => { if (/systemone|chat\/completions/.test(req.url())) inferenceRequests.push(req.url()); });
  await page.goto('/examples#oro');
  await expect(page.getByRole('button', { name: /Referee a shopping AI/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-oro-message]')).toContainText(oro.cases[0].message);
  const zils = page.locator('[data-verdict="zils"]');
  const jev = page.locator('[data-verdict="jev"]');
  await expect(zils).toContainText('Wait');
  await expect(zils).toContainText('Right');
  await expect(jev).toContainText('Answer');
  await expect(jev).toContainText('Wrong');
  await expect(page.getByText(oro.cases[0].explanation.split('. ')[0])).toBeVisible();
  await page.getByRole('button', { name: /Next situation/ }).click();
  await expect(page.locator('[data-oro-message]')).toContainText(oro.cases[1].message);
  await expect(zils).toContainText('Right');
  await expect(jev).toContainText('Right');
  await page.getByRole('button', { name: /Next situation/ }).click();
  await page.getByRole('button', { name: /Next situation/ }).click();
  await expect(page.locator('[data-oro-message]')).toContainText(oro.cases[0].message);
  await expect(page.getByRole('button', { name: /Next situation/ })).toBeVisible();
  await page.getByRole('button', { name: /Next situation/ }).click();
  await page.getByText('Behind this decision', { exact: true }).click();
  await expect(page.getByRole('table').first()).toContainText('96.7% yes');
  expect(inferenceRequests).toEqual([]);
});

test('shopper demo and evidence fit a narrow screen with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/examples#oro');
  await page.getByText('Full test details', { exact: true }).click();
  await expect(page.getByText(/180\/180/).first()).toBeVisible();
  await expect(page.getByText(/An untrained baseline was not measured/).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

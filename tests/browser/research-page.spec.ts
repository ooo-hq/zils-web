import { test, expect } from '@playwright/test';

test('research readers can move from findings to evidence and the metric reference', async ({ page, request }) => {
  await page.goto('/model');
  await page.getByRole('link', { name: 'Explore the findings', exact: true }).click();
  const findings = page.getByRole('region', { name: 'What we’ve measured.', exact: true });
  await expect(findings).toBeInViewport();
  await expect(findings).toContainText('not independent replications');
  await findings.getByRole('link', { name: 'Choose the next support action', exact: true }).click();
  const comparison = page.locator('#jev-comparison');
  await expect(comparison.getByRole('heading').first()).toBeInViewport();
  await comparison.getByText('All scores, API checks, and method', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Jev comparison full test scores' })).toBeVisible();
  await comparison.getByRole('link', { name: 'Original training study', exact: true }).click();
  await page.getByText('Training protocol, checkpoint selection, and full evaluation', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Support study final test scores' })).toBeVisible();
  await page.getByText('Inspect recorded decisions: three corrections and one new mistake', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A mistake training introduced', exact: true })).toBeVisible();
  const evidence = await page.getByRole('link', { name: 'Recorded example predictions (JSON)', exact: true }).getAttribute('href');
  const response = await request.get(evidence!);
  expect(response.ok()).toBe(true);
  expect((await response.json()).examples).toHaveLength(4);
  await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Metric guide' }).click();
  await page.getByText('Technical reference: Brier, F1, ROC-AUC, NLL, and intervals', { exact: true }).click();
  await expect(page.getByText('Paired 95% bootstrap intervals', { exact: true })).toBeVisible();
});

test('research overview and expanded technical tables fit mobile in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/model');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const nav = page.getByRole('navigation', { name: 'On this page' });
    for (const link of await nav.getByRole('link').all()) {
      const href = await link.getAttribute('href');
      await expect(page.locator(href!)).toHaveCount(1);
    }
    await page.getByText('Model names, comparison controls, and deployment status', { exact: true }).click();
    await page.getByText('Training protocol, checkpoint selection, and full evaluation', { exact: true }).click();
    await page.getByText('Technical reference: Brier, F1, ROC-AUC, NLL, and intervals', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const scores = page.getByRole('region', { name: 'Support study final test scores' });
    await scores.focus();
    await page.keyboard.press('End');
    await expect(scores).toBeFocused();
    expect(await scores.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  }
});

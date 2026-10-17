import { test, expect } from '@playwright/test';
import study from '../../public/model/abcd-002-jev.json';
import training from '../../public/model/abcd-002.json';
import examples from '../../public/model/abcd-002-examples.json';

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
  await expect(page.getByRole('region', { name: 'JEV comparison full test scores' })).toBeVisible();
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


test('research hero separates full-test accuracy from a recorded correction', async ({ page }) => {
  await page.goto('/model');
  const hero = page.locator('main header');
  const figure = hero.getByRole('figure', { name: /Learning a customer-support task/ });
  const scores = figure.getByLabel('Accuracy before and after training', { exact: true });
  for (const metrics of [training.test.metrics.base, training.test.metrics.candidate]) {
    await expect(scores).toContainText(`${(metrics.accuracy * 100).toFixed(1)}%`);
  }
  const example = examples.examples.find(row => row.id === 'abcd-test-4827-turn-15')!;
  expect(example.unchanged.choice).not.toBe(example.expected_action);
  expect(example.trained.choice).toBe(example.expected_action);
  const correction = figure.locator(`[data-example-id="${example.id}"]`);
  await expect(correction).toContainText(example.context_summary);
  for (const choice of [example.unchanged.choice, example.trained.choice]) {
    await expect(correction).toContainText(examples.action_labels[choice as keyof typeof examples.action_labels]);
  }
  await expect(correction).toContainText('Context paraphrased');
  await expect(hero.getByRole('figure', { name: /One test. 500 support decisions/ })).toHaveCount(0);
  await correction.getByRole('link', { name: 'Read the training study', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'How the support model learned.', exact: true })).toBeInViewport();
});

test('detailed JEV comparison accounts for all paired support decisions', async ({ page }) => {
  await page.goto('/model');
  const figure = page.locator('#jev-comparison').getByRole('figure', { name: /One test. 500 support decisions/ });
  await expect(figure.locator('rect')).toHaveCount(study.test.metrics.trained_jevk5.n);
  const paired = study.test.comparisons.trained_vs_jev;
  for (const [label, count] of Object.entries({
    'Both correct': paired.both_correct,
    'Only trained model correct': paired.trained_correct_other_wrong,
    'Only JEV correct': paired.other_correct_trained_wrong,
    'Both incorrect': paired.both_wrong,
  })) {
    await expect(figure.locator(`g[data-outcome="${label}"] rect`)).toHaveCount(count);
  }
  await expect(figure.getByRole('link', { name: 'View all 500 predictions' })).toHaveAttribute('href', '/model/abcd-002-jev-predictions.json');
});

test('the miners page labels the testnet, survives an offline API and keeps the base-model timeline honest', async ({ page }) => {
  await page.goto('/miners');
  await expect(page.getByRole('heading', { name: 'Miners', level: 1 })).toBeVisible();
  await expect(page.getByText(/Subnet 579 on the Bittensor testnet\. All miners are currently run by Zils/)).toBeVisible();
  await expect(page.getByText(/Live miner data is unavailable right now/)).toBeVisible();
  await expect(page.getByText(/Live status is unavailable right now/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 4 })).toHaveCount(6);
  await expect(page.getByText('A tie, so no winner', { exact: true })).toBeVisible();
  await expect(page.getByText(/recorded as an override of the promotion rule, not a win under it/)).toBeVisible();
  await page.screenshot({ path: '.private/miners-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

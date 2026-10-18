import { test, expect } from '@playwright/test';
import study from '../../public/model/abcd-002-jev.json';
import training from '../../public/model/abcd-002.json';
import examples from '../../public/model/abcd-002-examples.json';
import manifest from '../../public/model/flight-delay-001-manifest.json';
import baseline from './fixtures/content-baseline.json';

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

test('detailed JEV comparison accounts for all paired support decisions in a 500-cell outcome grid', async ({ page }) => {
  await page.goto('/model');
  const figure = page.locator('#jev-comparison').getByRole('figure', { name: /One test. 500 support decisions/ });
  const grid = figure.locator('[data-outcome-grid]');
  await expect(grid.locator('[data-outcome]')).toHaveCount(study.test.metrics.trained_jevk5.n);
  const paired = study.test.comparisons.trained_vs_jev;
  for (const [label, count] of Object.entries({
    'Both correct': paired.both_correct,
    'Only trained model correct': paired.trained_correct_other_wrong,
    'Only JEV correct': paired.other_correct_trained_wrong,
    'Both incorrect': paired.both_wrong,
  })) {
    await expect(grid.locator(`[data-outcome="${label}"]`)).toHaveCount(count);
  }
  const columns = () => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(await columns()).toBe(50);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await columns()).toBe(25);
  await expect(figure.getByRole('link', { name: 'View all 500 predictions' })).toHaveAttribute('href', '/model/abcd-002-jev-predictions.json');
});

test('the outcome grid paints in on reveal and shows its final state under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/model');
  const grid = page.locator('[data-outcome-grid]');
  await expect(grid).toHaveAttribute('data-in', '');
  await expect(grid.locator('[data-outcome]').first()).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/model');
  await grid.scrollIntoViewIfNeeded();
  await expect(grid).toHaveAttribute('data-in', '');
  await expect(grid.locator('[data-outcome]').last()).toHaveCSS('opacity', '1');
});

test('flights show filling bars and the January to March timeline from the data', async ({ page }) => {
  await page.goto('/model');
  const flights = page.locator('#flight-study');
  await flights.scrollIntoViewIfNeeded();
  const fills = flights.locator('[data-fill]');
  await expect(fills).toHaveCount(3);
  for (const c of [manifest.splits.train.count, manifest.splits.calibration.count, manifest.splits.test.count]) {
    await expect(flights.locator('ol')).toContainText(`${c.toLocaleString('en-US')} flights`);
  }
});

test('light-theme accent text on /model meets 4.5:1 on panel and raised', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('zils-theme', 'light'));
  await page.goto('/model');
  const link = page.getByRole('link', { name: 'Read the training study', exact: true });
  const rgb = await link.evaluate(el => getComputedStyle(el).color.match(/\d+/g)!.slice(0, 3).map(Number));
  const lum = (c: number[]) => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  for (const bg of [[250, 249, 252], [241, 239, 246]]) expect(ratio(rgb, bg)).toBeGreaterThanOrEqual(4.5);
});

test('the sticky index lists the sections and marks the one in view', async ({ page }) => {
  await page.goto('/model');
  const index = page.getByRole('navigation', { name: 'On this page' });
  await expect(index.getByRole('link')).toHaveText(['02Findings', '03Approach', '04Support', '05Chess', '06Flights', '07Base tier', '08d3-mini evidence', '09Earlier benchmark', '10Metric guide']);
  for (const [id, name] of [['chess-study', 'Chess'], ['base-tier', 'Base tier'], ['metrics', 'Metric guide']]) {
    await page.evaluate(i => document.getElementById(i)!.scrollIntoView({ block: 'start' }), id);
    await expect(index.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(index.locator('[aria-current="true"]')).toHaveCount(1);
  }
  await page.setViewportSize({ width: 900, height: 800 });
  await expect(index).toBeHidden();
});

test('every table row from the pre-rebrand page is still on /model, and nothing overflows at 375px', async ({ page }) => {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/model');
  await page.locator('details').evaluateAll(els => els.forEach(d => ((d as HTMLDetailsElement).open = true)));
  const text = norm(await page.locator('main').innerText());
  const missing = baseline.model.tables.flatMap(t => t.rows.filter(row => !text.includes(row)).map(row => `${t.caption}: ${row}`));
  expect(missing).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('main').evaluate(m => m.scrollWidth <= m.clientWidth)).toBe(true);
});

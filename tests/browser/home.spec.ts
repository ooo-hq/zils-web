import { test, expect } from '@playwright/test';

const HEADINGS = [
  'Teach AI to make decisions your way.',
  'Show it what a good answer looks like.',
  'Same idea, different jobs.',
  'What you get.',
  'See what training changed.',
  'Start with a decision you know how to make.',
];

test('home headings appear in order', async ({ page }) => {
  await page.goto('/');
  const texts = await page.locator('main h1, main h2').allInnerTexts();
  expect(texts.map(t => t.replace(/\s+/g, ' ').trim())).toEqual(HEADINGS);
});

test('research bars show both percentages once in view', async ({ page }) => {
  await page.goto('/');
  const research = page.getByRole('region', { name: 'See what training changed.' });
  await research.scrollIntoViewIfNeeded();
  const chart = research.getByRole('figure');
  await expect(chart.getByText('70.6%', { exact: true })).toBeVisible();
  await expect(chart.getByText('79.2%', { exact: true })).toBeVisible();
});

test('reduced motion shows the research bars at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const research = page.getByRole('region', { name: 'See what training changed.' });
  await expect(research.locator('[data-fill]').first()).toHaveCSS('transform', 'none');
  await expect(research.getByRole('figure').getByText('70.6%', { exact: true })).toBeVisible();
});

test('Show another message cycles to a different message', async ({ page }) => {
  await page.goto('/');
  const cell = page.getByRole('region', { name: 'A new message comes in.' });
  const before = await cell.textContent();
  await cell.getByRole('button', { name: /Show another message/ }).click();
  await expect.poll(() => cell.textContent()).not.toBe(before);
});

test('Before you upload links to the data-handling page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Read how data is handled/ })).toHaveAttribute('href', '/privacy');
});

test('jobs section keeps the Rank options badge and the CTA pair', async ({ page }) => {
  await page.goto('/');
  const jobs = page.getByRole('region', { name: 'Same idea, different jobs.' });
  await expect(jobs.getByText('New in SDK 0.3.0 · Experimental', { exact: true })).toBeVisible();
  await expect(jobs.getByRole('heading', { name: 'Rank options.' })).toBeVisible();
  await expect(jobs.getByRole('link', { name: 'Request early access' })).toHaveAttribute('href', '/early-access');
  await expect(jobs.getByRole('link', { name: 'See examples' })).toHaveAttribute('href', '/examples');
});

test('section 04 readout cards are marked as placeholders', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('[data-readout]');
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    await expect(card).toHaveAttribute('data-placeholder', 'true');
    await expect(card.getByText('illustrative', { exact: true })).toBeVisible();
  }
  await expect(cards.nth(2)).toContainText('/v1/systemone');
  await expect(cards.nth(2)).not.toContainText('zils.decide');
});

test('no horizontal overflow at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('region', { name: 'Start with a decision you know how to make.' }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

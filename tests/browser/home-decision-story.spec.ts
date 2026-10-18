import { test, expect } from '@playwright/test';

const storyTitle = 'Show it what a good answer looks like.';

test('the illustrated story shows input and answer, separates training from shared-model testing, and never calls a model', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/setup', route => { requests++; return route.abort(); });
  await page.route('**/api/playground', route => { requests++; return route.abort(); });
  await page.goto('/#workflow');
  const story = page.getByRole('region', { name: storyTitle, exact: true });
  const newMessage = story.getByRole('region', { name: 'A new message comes in.' });
  await expect(newMessage).toContainText('My invoice page keeps crashing.');
  await expect(newMessage).toContainText('Technical support');
  await story.getByRole('button', { name: 'Show another message' }).click();
  await expect(newMessage).toContainText('I was charged twice for the same order.');
  await expect(newMessage).toContainText('Billing');
  await story.getByRole('button', { name: 'Show another message' }).click();
  await expect(newMessage).toContainText('Account changes');
  await story.getByRole('button', { name: 'Show another message' }).click();
  await expect(newMessage).toContainText('My invoice page keeps crashing.');
  await expect(story.getByText(/Illustrated workflow, not live predictions/)).toBeVisible();
  expect(requests).toBe(0);
});

test('mobile learning story fits without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#workflow');
  const story = page.getByRole('region', { name: storyTitle, exact: true });
  await story.getByRole('button', { name: 'Show another message' }).click();
  await expect(story.getByRole('button', { name: 'Show another message' })).toBeVisible();
  expect(await story.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

import { test, expect } from '@playwright/test';

const storyTitle = 'Show it what a good answer looks like.';
const starters = [
  { title: 'Customer message routing', id: 'customer-routing', question: 'Which team should handle this customer message?', sample: /entire team has been locked out/ },
  { title: 'Refund requests', id: 'refund-request', question: 'Is the customer explicitly asking for their money back?', sample: /replacement arrived broken/ },
  { title: 'Customer frustration', id: 'customer-frustration', question: 'How frustrated is the customer?', sample: /contacted support three times/ },
];

for (const starter of starters) {
  test(`saved ${starter.title} links still open editable questions without running a model`, async ({ page }) => {
    let requests = 0;
    await page.route('**/api/setup', route => { requests++; return route.abort(); });
    await page.route('**/api/playground', route => { requests++; return route.abort(); });
    await page.goto(`/playground?starter=${starter.id}`);
    await expect(page.getByRole('heading', { name: 'Make these questions yours.' })).toBeVisible();
    await expect(page.getByLabel('Question 1', { exact: true })).toHaveValue(starter.question);
    await page.getByLabel('Question 1', { exact: true }).fill('My own decision question?');
    await page.getByRole('button', { name: 'Try an example', exact: true }).click();
    await expect(page.getByLabel('Example to read')).toHaveValue(starter.sample);
    await page.getByRole('button', { name: 'Edit questions', exact: true }).click();
    await expect(page.getByLabel('Question 1', { exact: true })).toHaveValue('My own decision question?');
    expect(requests).toBe(0);
  });
}

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
  await expect(story.getByRole('link', { name: 'Request early access' })).toHaveAttribute('href', '/early-access');
  await story.getByRole('link', { name: 'Try the shared model' }).click();
  await expect(page.getByLabel('Question 1', { exact: true })).toHaveValue(starters[0].question);
  expect(requests).toBe(0);
});

test('unknown and ambiguous starter links open the ordinary describe flow', async ({ page }) => {
  for (const query of ['starter=not-a-template', 'starter=customer-routing&starter=refund-request']) {
    await page.goto(`/playground?${query}`);
    await expect(page.getByRole('heading', { name: 'Tell us what you have in mind.' })).toBeVisible();
    await expect(page.getByLabel('What would you like Zils to help with?')).toHaveValue('');
  }
});

test('mobile learning story fits without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#workflow');
  const story = page.getByRole('region', { name: storyTitle, exact: true });
  await story.getByRole('button', { name: 'Show another message' }).click();
  await expect(story.getByRole('link', { name: 'Request early access' })).toBeVisible();
  expect(await story.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

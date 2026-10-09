import { test, expect } from '@playwright/test';

const starters = [
  { title: 'Customer message routing', id: 'customer-routing', question: 'Which team should handle this customer message?', sample: /entire team has been locked out/ },
  { title: 'Refund requests', id: 'refund-request', question: 'Is the customer explicitly asking for their money back?', sample: /replacement arrived broken/ },
  { title: 'Customer frustration', id: 'customer-frustration', question: 'How frustrated is the customer?', sample: /contacted support three times/ },
];

for (const starter of starters) {
  test(`homepage opens ${starter.title} ready to edit without running a model`, async ({ page }) => {
    let requests = 0;
    await page.route('**/api/setup', route => { requests++; return route.abort(); });
    await page.route('**/api/playground', route => { requests++; return route.abort(); });
    await page.goto('/');
    const section = page.getByRole('region', { name: 'Try a decision of your own.' });
    const choice = section.getByRole('button', { name: new RegExp(starter.title) });
    await choice.click();
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await expect(section.getByText(starter.question, { exact: true })).toBeVisible();
    await section.getByRole('link', { name: 'Make this decision yours' }).click();
    await expect(page).toHaveURL(new RegExp(`/playground\\?starter=${starter.id}$`));
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

test('unknown and ambiguous starter links open the ordinary describe flow', async ({ page }) => {
  for (const query of ['starter=not-a-template', 'starter=customer-routing&starter=refund-request']) {
    await page.goto(`/playground?${query}`);
    await expect(page.getByRole('heading', { name: 'Tell us what you have in mind.' })).toBeVisible();
    await expect(page.getByLabel('What would you like Zils to help with?')).toHaveValue('');
  }
});

test('mobile homepage starter fits without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const section = page.getByRole('region', { name: 'Try a decision of your own.' });
  await section.getByRole('button', { name: /Refund requests/ }).click();
  await expect(section.getByRole('link', { name: 'Make this decision yours' })).toBeVisible();
  expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

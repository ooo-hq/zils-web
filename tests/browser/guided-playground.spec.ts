import { test, expect, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.route('**/api/setup', route => route.fulfill({ status: 503, json: { error: 'Assistant unavailable for this test.' } }));
  await page.route('**/api/playground', route => route.fulfill({ status: 503, json: { error: 'Model unavailable for this test.' } }));
  await page.goto('/playground');
}

test('starter edits survive navigation and saving; no JSON is needed', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Route customer messages/ }).click();
  await page.getByLabel('Answer 1 for question 1', { exact: true }).fill('Accounts');
  await page.getByRole('button', { name: 'Try an example', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Try your questions on one example.' })).toBeVisible();
  await page.getByLabel('Example to read').fill('Please send me the invoice.');
  await page.getByRole('button', { name: 'Edit questions', exact: true }).click();
  await expect(page.getByLabel('Answer 1 for question 1', { exact: true })).toHaveValue('Accounts');
  await page.getByRole('button', { name: 'Save setup', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved on this browser');
  await page.reload();
  await page.getByRole('button', { name: 'Open saved setup' }).click();
  await expect(page.getByLabel('Answer 1 for question 1', { exact: true })).toHaveValue('Accounts');
  await page.getByRole('button', { name: 'Try an example', exact: true }).click();
  await expect(page.getByLabel('Example to read')).toHaveValue('');
});

test('duplicate answer names block progression with useful feedback', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Route customer messages/ }).click();
  await page.getByLabel('Answer 2 for question 1', { exact: true }).fill('Billing');
  await page.getByRole('button', { name: 'Try an example', exact: true }).click();
  await expect(page.getByRole('alert', { name: 'Setup error' })).toContainText('different name');
  await expect(page.getByLabel('Answer 2 for question 1', { exact: true })).toBeVisible();
});

test('plain-language clarification and revision produce editable questions; failures preserve edits', async ({ page }) => {
  let calls = 0;
  await open(page);
  await page.route('**/api/setup', async route => {
    calls++;
    if (calls === 1) return route.fulfill({ json: { kind: 'clarify', message: 'Which teams receive messages?', choices: ['Billing and Support'] } });
    if (calls === 2) return route.fulfill({ json: { kind: 'draft', message: 'Review these questions.', draft: { title: 'Message routing', questions: [{ id: 'team', kind: 'choice', prompt: 'Which team should handle this?', options: [{ label: 'Billing', description: 'Invoices' }, { label: 'Support', description: 'Product issues' }] }] } } });
    return route.fulfill({ status: 502, json: { error: 'The assistant returned an incomplete setup. Try again.' } });
  });
  await page.getByLabel('What would you like Zils to help with?').fill('Sort our incoming customer messages.');
  await page.getByRole('button', { name: 'Suggest my questions' }).click();
  await page.getByRole('button', { name: 'Billing and Support', exact: true }).click();
  await expect(page.getByLabel('Question 1', { exact: true })).toHaveValue('Which team should handle this?');
  await page.getByLabel('Describe a change').fill('Rename Support to Product team.');
  await page.getByRole('button', { name: 'Update suggestions' }).click();
  await expect(page.getByRole('alert', { name: 'Setup error' })).toContainText('incomplete setup');
  await expect(page.getByLabel('Answer 2 for question 1', { exact: true })).toHaveValue('Support');
});

test('running uses edited questions and actual response; editing an example clears old results', async ({ page }) => {
  await open(page);
  let sent: Record<string, unknown> | undefined;
  await page.route('**/api/playground', async route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { model: sent!.model, answers: { refund: { type: 'noul', noul: .88 } }, usage: { input_tokens: 45, output_tokens: 0 } } });
  });
  await page.getByRole('button', { name: /Check a condition/ }).click();
  await page.getByLabel('Question 1', { exact: true }).fill('Does the customer want their money back?');
  await page.getByRole('button', { name: 'Try an example', exact: true }).click();
  await page.getByRole('button', { name: 'Run example', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your results' })).toBeVisible();
  expect(sent).toMatchObject({ questions: { refund: { type: 'noul', instructions: 'Does the customer want their money back?' } } });
  await expect(page.getByText('88%', { exact: true })).toBeVisible();
  await page.getByLabel('Example to read').fill('A different example');
  await expect(page.getByRole('heading', { name: 'Your results' })).toBeHidden();
});

test('mobile setup fits the screen and Advanced preserves the guided draft', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  await page.getByRole('button', { name: /Rate a message/ }).click();
  await page.getByLabel('Question 1', { exact: true }).fill('How upset is this customer?');
  await page.getByRole('button', { name: 'Advanced editor', exact: true }).click();
  await expect(page.getByLabel('Decisions yes/no, choice, or score')).toContainText('How upset is this customer?');
  await page.getByRole('button', { name: 'Back to guided setup', exact: true }).click();
  await expect(page.getByLabel('Question 1', { exact: true })).toHaveValue('How upset is this customer?');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('voice starts on demand, adds a transcript for review, and never sends it automatically', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: class {
      onresult?: (event: unknown) => void;
      onend?: () => void;
      start() { queueMicrotask(() => { this.onresult?.({ results: [[{ transcript: 'Sort customer messages by team.' }]] }); this.onend?.(); }); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    } });
  });
  let sent = 0;
  await open(page);
  await page.route('**/api/setup', route => { sent++; return route.fulfill({ status: 503, json: { error: 'Unexpected submission' } }); });
  await expect(page.getByLabel('What would you like Zils to help with?')).toHaveValue('');
  await page.getByRole('button', { name: 'Speak your goal' }).click();
  await expect(page.getByLabel('What would you like Zils to help with?')).toHaveValue('Sort customer messages by team.');
  await expect(page.getByRole('button', { name: 'Speak your goal' })).toHaveAttribute('aria-pressed', 'false');
  expect(sent).toBe(0);
});

test('canceled suggestions cannot replace an existing draft', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Check a condition/ }).click();
  let started!: () => void;
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/api/setup', async route => { started(); await new Promise(resolve => setTimeout(resolve, 300)); await route.fulfill({ json: { kind: 'clarify', message: 'Late response must not appear.', choices: [] } }); });
  await page.getByLabel('Describe a change').fill('Check whether they want a replacement instead.');
  await page.getByRole('button', { name: 'Update suggestions' }).click();
  await requested;
  await page.getByRole('button', { name: 'Cancel request' }).click();
  await expect(page.getByRole('status')).toContainText('Canceled');
  await expect(page.getByLabel('Question 1', { exact: true })).toHaveValue('Is the customer explicitly asking for their money back?');
  await expect(page.getByRole('heading', { name: 'Make these questions yours.' })).toBeVisible();
});

import { test, expect, type Page } from '@playwright/test';
import { signIn } from './signed-in';

const shadow = {
  field: 'intent', model: 'zils-task-fixture', since: '2026-11-14T15:57:00+00:00', asked: 24, agreed: 22, failed: 0,
  by_confidence: [[0.5, 24, 22], [0.8, 23, 21], [0.9, 22, 20], [0.95, 18, 17], [0.98, 14, 14], [0.99, 11, 11]].map(([confidence_at_least, asked, agreed]) => ({ confidence_at_least, asked, agreed })),
};
const report = {
  relay: true, saving_since: '2026-11-14T15:38:32+00:00', questions_total: 2,
  questions: [
    { id: 'e'.repeat(64), instructions: 'Pick the one intent that best matches what the customer wants.', fields: { intent: ['card_arrival', 'lost_card', 'other'] }, first_at: '2026-11-14T15:55:00+00:00', rows: 25, last_at: '2026-11-14T16:03:00+00:00', shadows: [shadow] },
    { id: 'f'.repeat(64), instructions: 'Is this ticket urgent?', fields: { urgent: [true, false] }, first_at: '2026-11-14T15:39:00+00:00', rows: 1, last_at: '2026-11-14T15:39:05+00:00', shadows: [] },
  ],
};

async function answer(page: Page, status: number, body: unknown) {
  await page.route('http://127.0.0.1:8999/v1/relay/report', route => route.fulfill({ status, json: body, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }));
}

test('shows each question with its saved messages and how the shadow model compares', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, report);
  await page.goto('/gateway');
  await expect(page.getByRole('heading', { level: 1, name: 'Gateway' })).toBeVisible();
  const first = page.getByRole('region', { name: 'Question 1' });
  await expect(first.getByText('Pick the one intent that best matches')).toBeVisible();
  await expect(first.getByText('25', { exact: true })).toBeVisible();
  await expect(first.getByText('intent: 3 answers')).toBeVisible();
  const sure = first.getByRole('row', { name: /99% or more/ });
  await expect(sure.getByRole('cell').nth(0)).toHaveText('11');
  await expect(sure.getByRole('cell').nth(1)).toHaveText('46%');
  await expect(sure.getByRole('cell').nth(2)).toHaveText('11 (100%)');
  await expect(first.getByRole('row', { name: /Any/ }).getByRole('cell').nth(2)).toHaveText('22 (92%)');
  const second = page.getByRole('region', { name: 'Question 2' });
  await expect(second.getByText('urgent: yes or no')).toBeVisible();
  await expect(second.getByText('No Zils model is being compared on this question yet.')).toBeVisible();
});

test('says so when the gateway is not set up, and when nothing has been saved', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: false, saving_since: null, questions_total: 0, questions: [] });
  await page.goto('/gateway');
  await expect(page.getByText('The gateway is not set up for this account yet.')).toBeVisible();
  await answer(page, 200, { relay: true, saving_since: '2026-11-14T15:38:32+00:00', questions_total: 0, questions: [] });
  await page.reload();
  await expect(page.getByText('No questions yet.')).toBeVisible();
});

test('a failed load is reported, never shown as an empty report', async ({ page }) => {
  await signIn(page);
  await answer(page, 500, { error: { code: 'internal' } });
  await page.goto('/gateway');
  await expect(page.getByRole('alert').filter({ hasText: 'The report could not be loaded.' })).toBeVisible();
  await expect(page.getByText('not set up')).toHaveCount(0);
});

test('asks a signed-out visitor to sign in', async ({ page }) => {
  await page.goto('/gateway');
  await expect(page.getByRole('link', { name: 'Sign in to Zils' })).toBeVisible();
});

const relayId = 'r'.repeat(40);
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

/** Answers the relay status and remembers each collection switch the page sends. */
async function relay(page: Page, collecting: string | null, id: string | null = relayId) {
  const sent: unknown[] = [];
  let since = collecting;
  await page.route('http://127.0.0.1:8999/v1/relay', route => route.fulfill({ json: { relay_id: id, collecting_since: since, terms_version: 't-1' }, headers: cors }));
  await page.route('http://127.0.0.1:8999/v1/relay/collection', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST' } });
    const body = route.request().postDataJSON();
    sent.push(body);
    since = body.collect ? '2026-11-14T20:00:00+00:00' : null;
    return route.fulfill({ json: { relay_id: id, collecting_since: since, terms_version: 't-1' }, headers: cors });
  });
  return sent;
}

test('shows the gateway address and starts collecting only after the terms are agreed to', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: true, saving_since: null, questions_total: 0, questions: [] });
  const sent = await relay(page, null);
  await page.goto('/gateway');
  const setup = page.getByRole('region', { name: 'Setup' });
  await expect(setup.getByText(`http://127.0.0.1:8999/relay/${relayId}/v1`)).toBeVisible();
  await expect(setup.getByText('Collection is off')).toBeVisible();
  const start = setup.getByRole('button', { name: 'Start collecting' });
  await expect(start).toBeDisabled();
  await setup.getByRole('checkbox', { name: /I agree/ }).check();
  await start.click();
  await expect(setup.getByText(/Collecting since/)).toBeVisible();
  expect(sent).toEqual([{ collect: true, terms_version: 't-1' }]);
});

test('stopping collection asks first, because it deletes what was saved', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, report);
  const sent = await relay(page, '2026-11-14T15:38:32+00:00');
  await page.goto('/gateway');
  const setup = page.getByRole('region', { name: 'Setup' });
  await setup.getByRole('button', { name: 'Stop collecting' }).click();
  expect(sent).toEqual([]);
  const confirm = setup.getByRole('group', { name: 'Confirm stopping collection' });
  await expect(confirm.getByText(/deletes every saved message/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Keep collecting' }).click();
  await expect(confirm).toHaveCount(0);
  await setup.getByRole('button', { name: 'Stop collecting' }).click();
  await setup.getByRole('button', { name: 'Stop and delete' }).click();
  await expect(setup.getByText('Collection is off')).toBeVisible();
  expect(sent).toEqual([{ collect: false }]);
});

test('an account without a relay sees no address and no switch', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: false, saving_since: null, questions_total: 0, questions: [] });
  await relay(page, null, null);
  await page.goto('/gateway');
  await expect(page.getByText('The gateway is not set up for this account yet.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Setup' })).toHaveCount(0);
});

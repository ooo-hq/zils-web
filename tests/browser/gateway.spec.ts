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

import { test, expect, type Page } from '@playwright/test';
import { signIn } from './signed-in';

// Train is the one place a model starts: the run in training, then four ways in, your coding agent first, each doing its
// first step in its own row. Everything already made is listed on Models. The gateway is one of the ways in, so it has no
// menu entry of its own.
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const result = (status: string) => ({ delivery: { status, uid: 1, acceptance: { min_accuracy: .8, min_brier_improvement: .01 } }, baseline: { accuracy: .8, brier: .3, skill: .3 }, miners: [{ uid: 1, status: 'evaluated', accuracy: .9, brier: .2 }], weights: {} });
const running = { id: '10000000-0000-4000-8000-000000000001', name: 'tone-check', status: 'running', created_at: '2026-11-15T12:00:00Z' };
const ready = { id: '20000000-0000-4000-8000-000000000002', name: 'support-routing', status: 'completed', created_at: '2026-11-14T12:00:00Z', workflow: { state: 'ready', model_id: 'support-routing-immutable', model_name: 'support-routing-v1' }, result: result('accepted') };
const failed = { id: '30000000-0000-4000-8000-000000000003', name: 'never-passed', status: 'completed', created_at: '2026-11-13T12:00:00Z', result: result('no_qualifying_model') };
const question = (id: string, rows: number, instructions: string) => ({ id: id.repeat(64), instructions, fields: { urgent: [true, false] }, first_at: '2026-11-14T15:39:00+00:00', rows, last_at: '2026-11-14T15:39:05+00:00', shadows: [] });
const collecting = { relay: true, saving_since: '2026-11-14T15:38:32+00:00', questions_total: 2, questions: [question('e', 250, 'Is this ticket urgent?'), question('f', 1, 'Is this a refund request?')] };

async function workspace(page: Page, report: unknown = collecting) {
  await signIn(page);
  await page.route('**/v1/jobs*', route => route.fulfill({ headers: cors, json: { jobs: [running, ready, failed], models: [ready] } }));
  await page.route('**/v1/relay/report', route => route.fulfill({ headers: cors, json: report }));
}

test('Train shows the run in training, then four ways to start, your coding agent first', async ({ page }) => {
  await workspace(page);
  await page.goto('/train');
  await expect(page.getByRole('heading', { level: 1, name: 'Train', exact: true })).toBeVisible();
  // The run in training stays in view; finished runs are on Models.
  await expect(page.locator('#current-run-title')).toHaveText('tone-check');
  await expect(page.getByRole('region', { name: 'Run history' })).toHaveCount(0);
  await expect(page.getByText('support-routing')).toHaveCount(0);
  const ways = page.getByRole('region', { name: 'Ways to start' });
  await expect(ways.getByRole('heading', { level: 3 })).toHaveText(['Your coding agent', 'From your gateway', 'Drop a file', 'Type examples']);
  const [agent, gateway, file, typed] = ['Your coding agent', 'From your gateway', 'Drop a file', 'Type examples'].map(name => ways.getByRole('region', { name, exact: true }));
  await expect(agent.getByText('Recommended', { exact: true })).toBeVisible();
  await expect(ways.getByText('Recommended', { exact: true })).toHaveCount(1);
  await expect(agent.getByLabel('Add Zils to your agent')).toHaveText('$ claude mcp add zils -- npx -y @zils/cli mcp');
  // The gateway's questions are listed in the row: one with enough saved answers starts in a click, the other says what it needs.
  await expect(gateway.getByRole('status')).toHaveText('Collecting. 251 answers saved from 2 questions.');
  await expect(gateway.getByRole('link', { name: 'Train on “Is this ticket urgent?”' })).toHaveAttribute('href', `/train?gateway=${'e'.repeat(64)}`);
  await expect(gateway.getByText('Is this a refund request?')).toBeVisible();
  await expect(gateway.getByRole('link', { name: /refund request/ })).toHaveCount(0);
  await expect(gateway.getByText('1 saved · opens at 200')).toBeVisible();
  await expect(gateway.getByRole('link', { name: 'Open the gateway' })).toHaveAttribute('href', '/gateway');
  await expect(file.getByLabel('Choose a file of examples')).toBeAttached();
  // Typing examples starts in its row: the kinds of task are the choices, nothing links away.
  await expect(typed.getByRole('button')).toHaveCount(4);
  await expect(typed.getByRole('link')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('picking a kind of task opens the step-by-step teaching in place, with a way back', async ({ page }) => {
  await workspace(page);
  await page.goto('/train');
  await page.getByRole('region', { name: 'Type examples', exact: true }).getByRole('button', { name: /Sort or make a decision/ }).click();
  await expect(page).toHaveURL('/train');
  await expect(page.getByRole('heading', { name: 'What would you like to teach?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sort or make a decision/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('What should your model do?')).toHaveValue('Send each customer request to the right team.');
  await expect(page.getByRole('region', { name: 'Ways to start' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Use another way' }).click();
  await expect(page.getByRole('region', { name: 'Ways to start' })).toBeVisible();
  await page.getByRole('button', { name: /Decide from photos/ }).click();
  await expect(page.getByRole('button', { name: 'Images', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('old training addresses land on Train with what they asked for', async ({ page }) => {
  await workspace(page);
  await page.goto('/train/teach');
  await expect(page).toHaveURL('/train?by=examples');
  await expect(page.getByRole('heading', { name: 'What would you like to teach?' })).toBeVisible();
  await page.goto('/train/new');
  await expect(page).toHaveURL('/train');
  await page.goto('/train/new?by=photos');
  await expect(page).toHaveURL('/train?by=photos');
  await expect(page.getByRole('button', { name: 'Images', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // Leaving the teaching clears the choice from the address, so a reload shows the ways again.
  await page.getByRole('button', { name: 'Use another way' }).click();
  await expect(page).toHaveURL('/train');
});

test('the gateway way says so when it is not set up or not collecting', async ({ page }) => {
  await workspace(page, { relay: false, saving_since: null, questions_total: 0, questions: [] });
  await page.goto('/train');
  const gateway = page.getByRole('region', { name: 'From your gateway', exact: true });
  await expect(gateway.getByRole('status')).toHaveText('Not set up yet.');
  await expect(gateway.getByRole('link', { name: 'Set up the gateway' })).toHaveAttribute('href', '/gateway');
  await page.route('**/v1/relay/report', route => route.fulfill({ headers: cors, json: { relay: true, saving_since: null, questions_total: 0, questions: [] } }));
  await page.reload();
  await expect(gateway.getByRole('status')).toHaveText('Set up. Not collecting.');
});

test('the gateway is part of Train: no menu entry, Train stays current, and a way back', async ({ page }) => {
  await workspace(page);
  await page.goto('/gateway');
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  await expect(nav.getByRole('link')).toHaveText(['Home', 'Train', 'Models', 'Playground', 'Usage', 'API keys', 'Documentation']);
  await expect(nav.getByRole('link', { name: 'Train', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1, name: 'Learning gateway', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Train' }).click();
  await expect(page).toHaveURL(/\/train$/);
});

test('Models lists everything made: in progress, ready, and runs that gave no model', async ({ page }) => {
  await workspace(page);
  await page.goto('/models');
  await expect(page.getByRole('region', { name: 'In progress' }).getByRole('link', { name: /tone-check.*Training/ })).toHaveAttribute('href', `/train?run=${running.id}`);
  await expect(page.getByRole('region', { name: 'Your models' }).getByRole('link', { name: 'support-routing', exact: true })).toHaveAttribute('href', `/models/${ready.id}`);
  await expect(page.getByRole('region', { name: 'No model' }).getByRole('link', { name: /never-passed.*No qualifying model/ })).toHaveAttribute('href', `/train?run=${failed.id}`);
  await expect(page.getByRole('region', { name: 'No model' }).getByText('support-routing')).toHaveCount(0);
});

test('Models follows a run in progress without a reload', async ({ page }) => {
  await workspace(page);
  await page.clock.install();
  await page.goto('/models');
  await expect(page.getByRole('region', { name: 'In progress' }).getByRole('link', { name: /tone-check/ })).toBeVisible();
  // The run finishes with a model: its row moves to the models by itself.
  const done = { ...ready, id: running.id, name: running.name, workflow: { state: 'ready', model_id: 'tone-check-immutable', model_name: 'tone-check-v1' } };
  await page.route('**/v1/jobs*', route => route.fulfill({ headers: cors, json: { jobs: [done, ready, failed], models: [done, ready] } }));
  await page.clock.runFor(10_000);
  await expect(page.getByRole('region', { name: 'Your models' }).getByRole('link', { name: 'tone-check', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'In progress' })).toHaveCount(0);
});

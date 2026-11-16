import { test, expect, type Page } from '@playwright/test';
import { signIn } from './signed-in';

// Train is where a model starts: it asks where the examples come from, the gateway first. Everything already made, in
// training or finished, is listed on Models. The gateway is one of Train's sources, so it has no menu entry of its own.
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const result = (status: string) => ({ delivery: { status, uid: 1, acceptance: { min_accuracy: .8, min_brier_improvement: .01 } }, baseline: { accuracy: .8, brier: .3, skill: .3 }, miners: [{ uid: 1, status: 'evaluated', accuracy: .9, brier: .2 }], weights: {} });
const running = { id: '10000000-0000-4000-8000-000000000001', name: 'tone-check', status: 'running', created_at: '2026-11-15T12:00:00Z' };
const ready = { id: '20000000-0000-4000-8000-000000000002', name: 'support-routing', status: 'completed', created_at: '2026-11-14T12:00:00Z', workflow: { state: 'ready', model_id: 'support-routing-immutable', model_name: 'support-routing-v1' }, result: result('accepted') };
const failed = { id: '30000000-0000-4000-8000-000000000003', name: 'never-passed', status: 'completed', created_at: '2026-11-13T12:00:00Z', result: result('no_qualifying_model') };
const question = (id: string, rows: number) => ({ id: id.repeat(64), instructions: 'Is this ticket urgent?', fields: { urgent: [true, false] }, first_at: '2026-11-14T15:39:00+00:00', rows, last_at: '2026-11-14T15:39:05+00:00', shadows: [] });
const collecting = { relay: true, saving_since: '2026-11-14T15:38:32+00:00', questions_total: 2, questions: [question('e', 25), question('f', 1)] };

async function workspace(page: Page, report: unknown = collecting) {
  await signIn(page);
  await page.route('**/v1/jobs*', route => route.fulfill({ headers: cors, json: { jobs: [running, ready, failed], models: [ready] } }));
  await page.route('**/v1/relay/report', route => route.fulfill({ headers: cors, json: report }));
}

test('Train asks where your examples come from, with the gateway first', async ({ page }) => {
  await workspace(page);
  await page.goto('/train');
  const sources = page.getByRole('region', { name: 'Where your examples come from' });
  await expect(sources.getByRole('heading', { level: 3 })).toHaveText(['Your app, through the gateway', 'A file or a table', 'Your coding agent or the command line']);
  const [gateway, file, agent] = [0, 1, 2].map(index => sources.locator('ol > li').nth(index));
  await expect(gateway.getByText('Recommended', { exact: true })).toBeVisible();
  await expect(gateway.getByRole('status')).toHaveText('Collecting. 26 answers saved from 2 questions.');
  await expect(gateway.getByRole('link', { name: 'Open the gateway' })).toHaveAttribute('href', '/gateway');
  await expect(file.getByRole('link', { name: 'Upload a table' })).toHaveAttribute('href', '/train/new');
  await expect(file.getByRole('link', { name: 'teach by example' })).toHaveAttribute('href', '/train/teach');
  await expect(agent.getByLabel('Add Zils to your agent')).toHaveText('$ claude mcp add zils -- npx -y @zils/cli mcp');
  // The run in training stays in view; finished runs are on Models.
  await expect(page.locator('#current-run-title')).toHaveText('tone-check');
  await expect(page.getByRole('region', { name: 'Run history' })).toHaveCount(0);
  await expect(page.getByText('support-routing')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the gateway source says so when it is not set up or not collecting', async ({ page }) => {
  await workspace(page, { relay: false, saving_since: null, questions_total: 0, questions: [] });
  await page.goto('/train');
  const gateway = page.getByRole('region', { name: 'Where your examples come from' }).locator('ol > li').first();
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
  await expect(page.getByRole('heading', { level: 1, name: 'Gateway' })).toBeVisible();
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

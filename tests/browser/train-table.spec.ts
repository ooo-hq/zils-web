import { legacyConfig } from './model-pools-fixture';
import { test, expect, type Page } from '@playwright/test';

// All service requests are intercepted: nothing reaches a real coordinator, storage or account.
const jobId = '50000000-0000-4000-8000-000000000001';
const owner = '50000000-0000-4000-8000-000000000002';
const teams = ['Billing', 'Technical support', 'Account changes'];
const agents: Record<string, string> = { Billing: 'Ana', 'Technical support': 'Raj', 'Account changes': 'Li' };
const csv = ['ticket_id,customer_id,message,channel,assigned_agent,team',
  ...Array.from({ length: 90 }, (_, i) => `T-${i},C-${i % 30},Message number ${i} about ${teams[i % 3].toLowerCase()},${['chat', 'email'][i % 2]},${agents[teams[i % 3]]},${teams[i % 3]}`)].join('\n');

async function workspace(page: Page) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: owner, email: 'trainer@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  await page.addInitScript(({ user, expires }) => {
    localStorage.setItem('zils-training-auth', JSON.stringify({ user, access_token: `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({ sub: user.id, exp: expires }))}.fixture`, refresh_token: 'fixture', expires_at: expires, expires_in: 3600, token_type: 'bearer' }));
  }, { user, expires });
  const state = { created: undefined as Record<string, unknown> | undefined, uploads: {} as Record<string, string>, status: 'uploading' };
  const job = () => ({ id: jobId, name: String(state.created?.name || 'run'), status: state.status });
  const grant = (split: string) => ({ url: `http://127.0.0.1:8998/storage/v1/object/upload/sign/fez-training-data/${jobId}/inputs/${split}.jsonl`, method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' } });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.startsWith('/auth/v1/')) return route.fulfill({ headers, json: user });
    if (path === '/v1/config') return route.fulfill({ headers, json: legacyConfig });
    if (path === '/v1/jobs' && request.method() === 'GET') return route.fulfill({ headers, json: { jobs: state.created ? [job()] : [] } });
    if (path === '/v1/jobs' && request.method() === 'POST') {
      state.created = request.postDataJSON();
      return route.fulfill({ headers, json: { job: job(), uploads: Object.fromEntries(['train', 'calibration', 'test'].map(s => [s, grant(s)])) } });
    }
    if (path === `/v1/jobs/${jobId}`) return route.fulfill({ headers, json: { job: job() } });
    if (path === `/v1/jobs/${jobId}/submit`) { state.status = 'validating'; return route.fulfill({ headers, json: { job: job() } }); }
    if (request.method() === 'PUT' && path.endsWith('.jsonl')) { state.uploads[path.split('/').at(-1)!.replace('.jsonl', '')] = request.postData()!; return route.fulfill({ headers, json: {} }); }
    return route.fulfill({ status: 404, headers, json: {} });
  });
  await page.goto('/train/new');
  return state;
}

test('a spreadsheet becomes a training run on one screen', async ({ page }) => {
  const state = await workspace(page);
  await page.goto('/train');
  await page.getByRole('link', { name: 'Train a model', exact: true }).click();
  await expect(page).toHaveURL('/train/new');
  await page.getByLabel('Choose a file of examples').setInputFiles({ name: 'tickets.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });

  // The guess: team on the right, the id and the give-away column out, customers kept together.
  const table = page.getByRole('region', { name: 'Your examples' });
  await expect(table.getByRole('columnheader', { name: /team/ })).toContainText('picks 1 of 3');
  await expect(table.getByText('Not used:')).toContainText('ticket_id');
  await expect(table.getByText('Not used:')).toContainText('assigned_agent');
  await expect(table.getByText(/Rows with the same/)).toContainText('customer_id');
  await expect(page.getByText('Learns team (picks 1 of 3) from message and channel, using 90 examples.')).toBeVisible();

  // Reading the give-away column is allowed, but flagged.
  await table.getByRole('button', { name: 'assigned_agent' }).click();
  await expect(table.getByRole('columnheader', { name: /assigned_agent/ })).toContainText('Gives away the answer');
  await table.getByRole('button', { name: 'assigned_agent' }).click();
  await page.getByRole('menuitem', { name: 'Don’t use it' }).click();

  // One decision per run: deciding channel sends team back to the left.
  await table.getByRole('button', { name: 'channel' }).click();
  await page.getByRole('menuitem', { name: 'It decides this' }).click();
  await expect(page.getByText(/Learns channel \(picks 1 of 2\) from message and team/)).toBeVisible();
  await table.getByRole('button', { name: 'team' }).click();
  await page.getByRole('menuitem', { name: 'It decides this' }).click();
  await expect(page.getByText('Learns team (picks 1 of 3) from message and channel, using 90 examples.')).toBeVisible();

  await page.getByRole('button', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Train on 90 examples?' })).toBeVisible();
  await expect(page.getByLabel('The question it answers', { exact: false })).toHaveValue('Which team?');
  await expect(page.getByRole('region', { name: 'Submit training run' }).getByText('trainer@example.com')).toBeVisible();  // the account it will train on
  await page.getByRole('radio', { name: /^Open/ }).check();
  await page.getByLabel('I am authorized to share these examples.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await expect(page).toHaveURL(`/train?run=${jobId}`);

  expect(state.created).toMatchObject({ name: 'tickets-team', tier: 'open', acceptance: { min_accuracy: 0.8, min_brier_improvement: 0.01 } });
  const rows = state.uploads.train.trim().split('\n').map(line => JSON.parse(line));
  const all = ['train', 'calibration', 'test'].flatMap(split => state.uploads[split].trim().split('\n'));
  expect(all).toHaveLength(90);
  expect(JSON.stringify(rows[0])).toContain('Which team?');
  expect(state.uploads.train + state.uploads.test).not.toContain('Raj');  // the give-away column never left the browser
  expect(state.uploads.train).not.toContain('T-1,');
});

test('photos and PDFs say where they go instead of failing', async ({ page }) => {
  await workspace(page);
  const examples = page.getByRole('region', { name: 'Your examples' });
  await page.getByLabel('Choose a file of examples').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await expect(examples.getByRole('alert')).toContainText('PDFs come later');
  await page.getByLabel('Choose a file of examples').setInputFiles({ name: 'part.png', mimeType: 'image/png', buffer: Buffer.from('png') });
  await expect(examples.getByRole('alert')).toContainText('photo setup');
  await expect(page.getByRole('link', { name: 'Train on photos' })).toHaveAttribute('href', '/train/teach');
  // Decisions made inside a program (a game, an agent) go through the user's coding agent, not a file upload.
  await expect(page.getByRole('link', { name: 'Decisions made in your code? Train with your coding agent' })).toHaveAttribute('href', '/train#train-with-your-agent');
  await page.goto('/train');
  await expect(page.locator('#train-with-your-agent')).toContainText('Ask your coding agent to train it.');
});

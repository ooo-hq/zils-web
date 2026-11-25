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
  await expect(page.getByRole('heading', { level: 1, name: 'Learning gateway', exact: true })).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Set up the gateway' })).toBeVisible();
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
async function relay(page: Page, collecting: string | null, id: string | null = relayId, seen: { requests?: number; last_request_at?: string | null; provider?: string; outcomes?: Record<string, number>; outcomes_since?: string } = {}) {
  const sent: unknown[] = [];
  let since = collecting;
  await page.route('http://127.0.0.1:8999/v1/relay', route => route.fulfill({ json: { relay_id: id, collecting_since: since, terms_version: 't-1', ...seen }, headers: cors }));
  await page.route('http://127.0.0.1:8999/v1/relay/collection', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST' } });
    const body = route.request().postDataJSON();
    sent.push(body);
    since = body.collect ? '2026-11-14T20:00:00+00:00' : null;
    return route.fulfill({ json: { relay_id: id, collecting_since: since, terms_version: 't-1' }, headers: cors });
  });
  await page.route('http://127.0.0.1:8999/v1/relay/provider', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST' } });
    const body = route.request().postDataJSON();
    sent.push(body);
    seen = { ...seen, provider: body.provider };
    return route.fulfill({ json: { relay_id: id, collecting_since: since, terms_version: 't-1', ...seen }, headers: cors });
  });
  return sent;
}

test('a Jev gateway shows the Jev address, cards and what is collected', async ({ page }) => {
  await signIn(page);
  // A Jev question may have no instructions: it is then shown by its name, never as empty quotes.
  const spam = { id: 'a'.repeat(64), instructions: '', fields: { spam: [true, false] }, first_at: '2026-11-14T15:39:00+00:00', rows: 2, last_at: null, shadows: [] };
  await answer(page, 200, { relay: true, saving_since: '2026-11-14T15:38:32+00:00', questions_total: 1, questions: [spam] });
  const sent = await relay(page, null, relayId, { requests: 0, last_request_at: null, provider: 'jev' });
  await page.goto('/gateway');
  await expect(page.getByRole('region', { name: 'Question 1' }).getByText('“spam”')).toBeVisible();
  const setup = page.getByRole('region', { name: 'Setup' });
  // A Jev client is given the API root: no /v1 on the end.
  const address = `http://127.0.0.1:8999/relay/${relayId}`;
  await expect(setup.locator('code').first()).toHaveText(address);
  await expect(setup.getByText('Set it as the base URL of your Jev client.', { exact: false })).toBeVisible();
  const providers = setup.getByRole('group', { name: 'Provider' });
  await expect(providers.getByRole('button', { name: /Jev/ })).toHaveAttribute('aria-pressed', 'true');
  // Jev is a provider like the others: every one is offered, and none is marked as unavailable.
  await expect(providers.getByRole('button')).toHaveCount(5);
  await expect(providers.getByRole('button', { name: 'OpenAI' })).toBeEnabled();
  await expect(setup.getByText(/On request|Coming soon|Ask us/)).toHaveCount(0);
  for (const name of ['Jev Python', 'Jev JavaScript', 'cURL']) await expect(setup.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(setup.getByRole('button', { name: /^(OpenAI Python|LangChain)/ })).toHaveCount(0);
  // What is saved differs for Jev, and the terms say so before anyone agrees.
  await expect(setup.getByText(/each yes\/no and choice question/)).toBeVisible();
  await expect(setup.getByText(/how sure your provider was/)).toBeVisible();

  await setup.getByRole('button', { name: /^Jev Python/ }).click();
  const steps = setup.getByRole('region', { name: 'Jev Python setup' });
  // The address is the only change to the app: no other client setting, no warning.
  await expect(steps.locator('pre').first()).toContainText(`client = TypeSafeClient(base_url="${address}")`);
  await expect(steps.locator('pre mark')).toHaveText(address);
  await expect(steps.getByText(/compress/)).toHaveCount(0);
  // The account may leave Jev while it is not collecting, like any other provider.
  await providers.getByRole('button', { name: 'OpenAI' }).click();
  expect(sent).toEqual([{ provider: 'openai' }]);
});

test('a Claude gateway shows the root address and the Anthropic cards', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: true, saving_since: null, questions_total: 0, questions: [] });
  await relay(page, null, relayId, { requests: 0, last_request_at: null, provider: 'anthropic' });
  await page.goto('/gateway');
  const setup = page.getByRole('region', { name: 'Setup' });
  // An Anthropic client is given the API root: no /v1 on the end.
  const address = `http://127.0.0.1:8999/relay/${relayId}`;
  await expect(setup.locator('code').first()).toHaveText(address);
  await expect(setup.getByText('Set it as the base URL of your Claude client.', { exact: false })).toBeVisible();
  const providers = setup.getByRole('group', { name: 'Provider' });
  await expect(providers.getByRole('button', { name: /Claude/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(providers.getByRole('button', { name: 'OpenAI' })).toBeEnabled();
  await expect(providers.getByRole('button')).toHaveCount(5);
  for (const name of ['Anthropic Python', 'Anthropic TypeScript', 'cURL']) await expect(setup.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(setup.getByRole('button', { name: /^(OpenAI Python|LangChain|Jev Python|Jev JavaScript)/ })).toHaveCount(0);
  // What is saved is the same as for OpenAI: requests that ask for an answer from a fixed list.
  await expect(setup.getByText(/each request that asks for an answer from a fixed list/)).toBeVisible();
  await expect(setup.getByText(/Ask us if it should go to another provider/)).toHaveCount(0);

  await setup.getByRole('button', { name: /^Anthropic Python/ }).click();
  const steps = setup.getByRole('region', { name: 'Anthropic Python setup' });
  await expect(steps.locator('pre').first()).toContainText(`client = Anthropic(base_url="${address}")`);
  await expect(steps.locator('pre mark')).toHaveText(address);
});

test('a Gemini gateway shows the root address and the Google cards', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: true, saving_since: null, questions_total: 0, questions: [] });
  const sent = await relay(page, null, relayId, { requests: 0, last_request_at: null, provider: 'gemini' });
  await page.goto('/gateway');
  const setup = page.getByRole('region', { name: 'Setup' });
  // A Google client is given the API root and adds the API version itself.
  const address = `http://127.0.0.1:8999/relay/${relayId}`;
  await expect(setup.locator('code').first()).toHaveText(address);
  await expect(setup.getByText('Set it as the base URL of your Gemini client.', { exact: false })).toBeVisible();
  const providers = setup.getByRole('group', { name: 'Provider' });
  await expect(providers.getByRole('button', { name: /Gemini/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(providers.getByRole('button')).toHaveCount(5);
  for (const name of ['Google Gen AI Python', 'Google Gen AI JavaScript', 'cURL']) await expect(setup.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(setup.getByRole('button', { name: /^(OpenAI Python|LangChain|Anthropic|Jev Python|Jev JavaScript)/ })).toHaveCount(0);
  await expect(setup.getByText(/each request that asks for an answer from a fixed list/)).toBeVisible();

  await setup.getByRole('button', { name: /^Google Gen AI Python/ }).click();
  const steps = setup.getByRole('region', { name: 'Google Gen AI Python setup' });
  await expect(steps.locator('pre').first()).toContainText(`base_url="${address}"`);
  await expect(steps.locator('pre mark')).toHaveText(address);
  // The account may leave Gemini for another provider like any other.
  await providers.getByRole('button', { name: 'Claude' }).click();
  expect(sent).toEqual([{ provider: 'anthropic' }]);
});

test('an OpenRouter gateway shows the /v1 address, the OpenAI-format cards and System One', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: true, saving_since: null, questions_total: 0, questions: [] });
  const sent = await relay(page, null, relayId, { requests: 0, last_request_at: null, provider: 'openrouter' });
  await page.goto('/gateway');
  const setup = page.getByRole('region', { name: 'Setup' });
  // OpenRouter's own address ends in /api/v1, so its clients are given the /v1 address.
  const address = `http://127.0.0.1:8999/relay/${relayId}/v1`;
  await expect(setup.locator('code').first()).toHaveText(address);
  await expect(setup.getByText('Set it as the base URL of your OpenRouter client.', { exact: false })).toBeVisible();
  const providers = setup.getByRole('group', { name: 'Provider' });
  await expect(providers.getByRole('button', { name: 'OpenRouter' })).toHaveAttribute('aria-pressed', 'true');
  await expect(providers.getByRole('button')).toHaveCount(5);
  for (const name of ['OpenAI Python', 'OpenAI Node', 'cURL', 'System One', 'LangChain']) await expect(setup.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();

  await setup.getByRole('button', { name: /^System One/ }).click();
  const steps = setup.getByRole('region', { name: 'System One setup' });
  await expect(steps.locator('pre').last()).toContainText('"model": "typesafe/jev-1.14"');
  await expect(steps.locator('pre').last()).toContainText('$OPENROUTER_API_KEY');
  // The account may leave OpenRouter for another provider like any other.
  await providers.getByRole('button', { name: 'OpenAI' }).click();
  expect(sent).toEqual([{ provider: 'openai' }]);
});

test('an account switches its address between OpenAI and Claude while it is not collecting', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: true, saving_since: null, questions_total: 0, questions: [] });
  const sent = await relay(page, null, relayId, { requests: 3, last_request_at: null });
  await page.goto('/gateway');
  const setup = page.getByRole('region', { name: 'Setup' });
  const providers = setup.getByRole('group', { name: 'Provider' });
  await expect(setup.locator('code').first()).toHaveText(`http://127.0.0.1:8999/relay/${relayId}/v1`);
  await providers.getByRole('button', { name: 'Claude' }).click();
  await expect(providers.getByRole('button', { name: 'Claude' })).toHaveAttribute('aria-pressed', 'true');
  expect(sent).toEqual([{ provider: 'anthropic' }]);
  // The address a Claude client needs is different, and the switch is not instant: the page says both.
  await expect(setup.locator('code').first()).toHaveText(`http://127.0.0.1:8999/relay/${relayId}`);
  await expect(page.getByRole('status').filter({ hasText: 'Your address now goes to Claude.' })).toContainText('within a minute');
  await expect(setup.getByRole('button', { name: /^Anthropic Python/ })).toBeVisible();
  await providers.getByRole('button', { name: 'OpenAI' }).click();
  await expect(setup.locator('code').first()).toHaveText(`http://127.0.0.1:8999/relay/${relayId}/v1`);
  expect(sent).toEqual([{ provider: 'anthropic' }, { provider: 'openai' }]);
});

test('the provider cannot be switched while the account collects', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, report);
  const sent = await relay(page, '2026-11-14T15:38:32+00:00');
  await page.goto('/gateway');
  const providers = page.getByRole('region', { name: 'Setup' }).getByRole('group', { name: 'Provider' });
  await expect(providers.getByRole('button', { name: /OpenAI/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(providers.getByRole('button', { name: 'Claude' })).toBeDisabled();
  expect(sent).toEqual([]);
});

test('setup is three steps in order, and each says how it depends on the others', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: true, saving_since: null, questions_total: 0, questions: [] });
  await relay(page, null, relayId, { requests: 0, last_request_at: null });
  await page.goto('/gateway');
  const setup = page.getByRole('region', { name: 'Setup' });
  const steps = setup.locator('ol[aria-label="Setup steps"] > li');
  await expect(steps.getByRole('heading', { level: 3 })).toHaveText(['Choose your provider', 'Point your app at your address', 'Collect your provider’s answers']);
  const [choose, point, collect] = [steps.nth(0), steps.nth(1), steps.nth(2)];
  // The provider is chosen first, because the address and what is saved both follow from it.
  await expect(choose.getByRole('group', { name: 'Provider' }).getByRole('button', { name: 'OpenAI' })).toHaveAttribute('aria-pressed', 'true');
  await expect(choose.getByText('You can change it until you start collecting.')).toBeVisible();
  await expect(point.locator('code')).toHaveText(`http://127.0.0.1:8999/relay/${relayId}/v1`);
  await expect(collect.getByText('Starting locks your provider to OpenAI', { exact: false })).toBeVisible();
  await collect.getByRole('checkbox').check();
  await collect.getByRole('button', { name: 'Start collecting' }).click();
  // Collecting: the provider is locked, and the lock says what unlocking costs.
  await expect(collect.getByText(/Every answer saved is OpenAI’s/)).toBeVisible();
  const locked = choose.getByRole('note');
  await expect(locked).toContainText('Locked while you collect');
  await expect(locked).toContainText('stop collecting, which deletes every saved message');
  await expect(choose.getByRole('button', { name: 'Claude' })).toBeDisabled();
  await collect.getByRole('button', { name: 'Stop collecting' }).click();
  await expect(collect.getByRole('group', { name: 'Confirm stopping collection' })).toContainText('You can change your provider afterwards.');
});

test('a question with enough saved answers can be trained from; one with few says how many it needs', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { ...report, questions: [{ ...report.questions[0], rows: 240, shadows: [] }, report.questions[1]] });
  await page.goto('/gateway');
  const first = page.getByRole('region', { name: 'Question 1' }), second = page.getByRole('region', { name: 'Question 2' });
  await expect(first.getByRole('link', { name: 'Train a model from these answers' })).toHaveAttribute('href', `/train?gateway=${'e'.repeat(64)}`);
  await expect(second.getByRole('link', { name: 'Train a model from these answers' })).toHaveCount(0);
  await expect(second.getByText('Training opens at 200 saved messages.')).toBeVisible();
});

test('runs trained from a question are listed, and a ready one can be compared with the provider', async ({ page }) => {
  await signIn(page);
  const job = '50000000-0000-4000-8000-000000000001', other = '50000000-0000-4000-8000-000000000002';
  const run = (job_id: string, state: string, model: string | null) => ({ job_id, field: 'intent', name: `gateway-intent-${job_id.at(-1)}`, started_at: '2026-11-15T17:00:00+00:00', state, model, evaluation: model ? { accuracy: 0.9339, baseline_accuracy: 0.8818 } : null });
  let compared = '';
  const question = (shadows: unknown[]) => ({ ...report.questions[0], rows: 240, shadows, trainings: [run(other, 'training', null), run(job, 'ready', 'zils-task-new')] });
  await page.route('http://127.0.0.1:8999/v1/relay/report', route => route.fulfill({ json: { ...report, compare: true, questions: [question(compared ? [{ ...shadow, model: 'zils-task-new', asked: 0, agreed: 0, by_confidence: [] }] : [shadow])] }, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }));
  await page.route('http://127.0.0.1:8999/v1/relay/trainings/*/compare', route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    compared = new URL(route.request().url()).pathname;
    return route.fulfill({ headers, json: { status: 'ok' } });
  });
  await page.goto('/gateway');
  const runs = page.getByRole('region', { name: 'Question 1' }).getByRole('list', { name: 'Models trained from this question' });
  await expect(runs.getByRole('listitem')).toHaveCount(2);
  await expect(runs.getByRole('listitem').nth(0)).toContainText(/gateway-intent-2.*Training/);
  await expect(runs.getByRole('listitem').nth(0).getByRole('button')).toHaveCount(0);
  const ready = runs.getByRole('listitem').nth(1);
  await expect(ready).toContainText(/gateway-intent-1.*Ready/);
  await expect(ready.getByRole('link', { name: 'gateway-intent-1' })).toHaveAttribute('href', `/models/${job}`);
  // How it scored on the examples held back from its training, beside the model it started from.
  await expect(ready.getByText('Gave your provider’s answer on 93.4% of the test examples held back from training. The model it started from: 88.2%.')).toBeVisible();
  await expect(runs.getByRole('listitem').nth(0).getByText(/held back/)).toHaveCount(0);
  // Another model is compared on this field today: replacing it starts its counts again, and says so first.
  await ready.getByRole('button', { name: 'Compare this model' }).click();
  await expect(ready.getByText('This replaces zils-task-fixture on “intent” and starts its counts again.')).toBeVisible();
  expect(compared).toBe('');
  await ready.getByRole('button', { name: 'Replace it' }).click();
  await expect(ready.getByText('Being compared')).toBeVisible();
  expect(compared).toBe(`/v1/relay/trainings/${job}/compare`);
  await expect(page.getByRole('region', { name: 'Question 1' }).getByText('zils-task-new').first()).toBeVisible();
});

test('says what became of the requests: how many were saved, and why the others were not', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: true, saving_since: '2026-11-14T15:38:32+00:00', questions_total: 0, questions: [] });
  await relay(page, '2026-11-14T15:38:32+00:00', relayId, { requests: 120, last_request_at: '2026-11-14T22:59:00+00:00', outcomes: { saved: 60, no_list: 30, stream: 6, chat_function: 4 }, outcomes_since: '2026-11-14T21:00:00+00:00' });
  await page.goto('/gateway');
  const outcomes = page.getByRole('region', { name: 'Setup' }).getByRole('region', { name: 'What happened to your requests' });
  await expect(outcomes.getByText('60 of 100 requests saved')).toBeVisible();
  await expect(outcomes.getByText(/asked a model for a reply since/)).toBeVisible();
  const rows = outcomes.getByRole('row');
  await expect(rows.nth(1)).toContainText(/60%.*60.*Saved/);
  await expect(rows.nth(2)).toContainText(/30%.*30.*No fixed list of answers/);
  await expect(rows.nth(3)).toContainText(/6%.*6.*Streamed/);
  await expect(rows.nth(4)).toContainText(/4%.*4.*Function call on Chat Completions/);
  // Each reason says what to do about it.
  await expect(rows.nth(3)).toContainText(/Turn streaming off/);
});

test('says nothing about outcomes before any are counted, or while collection is off', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: true, saving_since: null, questions_total: 0, questions: [] });
  await relay(page, '2026-11-14T15:38:32+00:00', relayId, { requests: 3 });
  await page.goto('/gateway');
  await expect(page.getByRole('region', { name: 'Setup' }).getByText('Collecting since', { exact: false })).toBeVisible();
  await expect(page.getByRole('region', { name: 'What happened to your requests' })).toHaveCount(0);
});

test('shows the gateway address and starts collecting only after the terms are agreed to', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: true, saving_since: null, questions_total: 0, questions: [] });
  const sent = await relay(page, null);
  await page.goto('/gateway');
  const setup = page.getByRole('region', { name: 'Setup' });
  await expect(setup.locator('code').first()).toHaveText(`http://127.0.0.1:8999/relay/${relayId}/v1`);
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

test('a question with a trained model leads with how that model scored, before any comparison', async ({ page }) => {
  await signIn(page);
  const run = (n: number, state: string, evaluation: unknown) => ({ job_id: `50000000-0000-4000-8000-00000000000${n}`, field: 'intent', name: `gateway-intent-${n}`, started_at: '2026-11-15T17:00:00+00:00', state, model: state === 'ready' ? `zils-task-${n}` : null, evaluation });
  // Newest first: a run still training, then the newest finished one, then an older one.
  const trainings = [run(3, 'training', null), run(2, 'ready', { accuracy: 0.9339, baseline_accuracy: 0.8818 }), run(1, 'ready', { accuracy: 0.5, baseline_accuracy: 0.4 })];
  await answer(page, 200, { ...report, questions: [{ ...report.questions[0], rows: 240, shadows: [], trainings }] });
  await page.goto('/gateway');
  const question = page.getByRole('region', { name: 'Question 1' });
  await expect(question.getByText('Your model gave your provider’s answer on 93.4% of test examples.')).toBeVisible();
  await expect(question.getByText('The model it started from gave it on 88.2%. Both were measured on examples held back from training.')).toBeVisible();
  await expect(question.getByText(/Train a Zils model on these/)).toHaveCount(0);
  await expect(question.getByRole('link', { name: 'Train a model from these answers' })).toHaveCount(1);
  // Comparison is not open to this account: its ready runs are listed without the button.
  await expect(question.getByRole('list', { name: 'Models trained from this question' }).getByRole('listitem')).toHaveCount(3);
  await expect(question.getByRole('button', { name: 'Compare this model' })).toHaveCount(0);
});

test('an account without a gateway sets one up itself and gets its address', async ({ page }) => {
  await signIn(page);
  let made = false, posted: unknown = 'none';
  await page.route('http://127.0.0.1:8999/v1/relay/report', route => route.fulfill({ json: { relay: made, saving_since: null, questions_total: 0, questions: [] }, headers: cors }));
  await page.route('http://127.0.0.1:8999/v1/relay', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST' } });
    if (route.request().method() === 'POST') { posted = route.request().postDataJSON(); made = true; }
    return route.fulfill({ json: { relay_id: made ? relayId : null, collecting_since: null, terms_version: 't-1' }, headers: cors });
  });
  await page.goto('/gateway');
  await expect(page.getByRole('region', { name: 'Setup' })).toHaveCount(0);
  // What it is and what it keeps, before anything is created.
  await expect(page.getByText('Nothing is saved unless you switch collection on.')).toBeVisible();
  await page.getByRole('button', { name: 'Set up the gateway' }).click();
  await expect(page.getByRole('region', { name: 'Setup' })).toBeVisible();
  expect(posted).toEqual({});
  await expect(page.getByRole('status').filter({ hasText: 'Your gateway address is ready. It starts working within a minute.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set up the gateway' })).toHaveCount(0);
});

test('a gateway that could not be set up says so and can be tried again', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: false, saving_since: null, questions_total: 0, questions: [] });
  await page.route('http://127.0.0.1:8999/v1/relay', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST' } });
    if (route.request().method() === 'POST') return route.fulfill({ status: 405, json: { error: { code: 'method_not_allowed' } }, headers: cors });
    return route.fulfill({ json: { relay_id: null, collecting_since: null, terms_version: 't-1' }, headers: cors });
  });
  await page.goto('/gateway');
  await page.getByRole('button', { name: 'Set up the gateway' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'The gateway could not be set up. Please try again.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set up the gateway' })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Setup' })).toHaveCount(0);
});

test('shows whether requests have come through, and a card for each tool that opens into copy-ready steps', async ({ page }) => {
  await signIn(page);
  await answer(page, 200, { relay: true, saving_since: null, questions_total: 0, questions: [] });
  await relay(page, null, relayId, { requests: 0, last_request_at: null });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/gateway');
  const setup = page.getByRole('region', { name: 'Setup' });
  await expect(setup.getByText('No request has come through this address yet.')).toBeVisible();
  const address = `http://127.0.0.1:8999/relay/${relayId}/v1`;
  for (const name of ['OpenAI Python', 'OpenAI Node', 'cURL', 'LangChain', 'Vercel AI SDK', 'LlamaIndex', 'Instructor']) await expect(setup.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  // Providers: an address goes to one of them, Jev included.
  const providers = setup.getByRole('group', { name: 'Provider' });
  await expect(providers.getByRole('button', { name: /OpenAI/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(providers.getByRole('button')).toHaveCount(5);
  await expect(providers.getByRole('button', { name: 'Claude' })).toBeEnabled();
  await expect(providers.getByRole('button', { name: 'Gemini' })).toBeEnabled();
  await expect(providers.getByRole('button', { name: 'Jev' })).toBeEnabled();
  await expect(providers.getByRole('button', { name: 'OpenRouter' })).toBeEnabled();
  await expect(setup.getByText(/On request|Coming soon/)).toHaveCount(0);
  await expect(setup.getByRole('button', { name: /^(Jev Python|Jev JavaScript)/ })).toHaveCount(0);
  await expect(setup.getByText(/another provider/)).toHaveCount(0);
  await expect(setup.getByText('Set it as the base URL of your OpenAI client.', { exact: false })).toBeVisible();
  // Closed until asked for: no code on the page yet.
  await expect(setup.locator('pre')).toHaveCount(0);

  const python = setup.getByRole('button', { name: /^OpenAI Python/ });
  await python.click();
  await expect(python).toHaveAttribute('aria-expanded', 'true');
  const steps = setup.getByRole('region', { name: 'OpenAI Python setup' });
  await expect(steps.getByText('Point the client at your gateway')).toBeVisible();
  await expect(steps.getByText('Ask for an answer from a fixed list')).toBeVisible();
  await expect(steps.locator('pre')).toHaveCount(2);
  // Highlighted: the address is marked as a string and the import as a keyword.
  await expect(steps.locator('pre').first().locator('.token.string')).toHaveText(`"${address}"`);
  await expect(steps.locator('pre').first().locator('.token.keyword').first()).toHaveText('from');
  // The one thing that is the account's own, its address, is marked inside the code.
  await expect(steps.locator('pre mark')).toHaveText(address);
  await steps.getByRole('button', { name: 'Copy step 1' }).click();
  await expect(steps.getByRole('button', { name: 'Copy step 1' })).toHaveText(/Copied/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`client = OpenAI(base_url="${address}")`);

  // One card open at a time; a tool whose default call is not collected says so.
  await setup.getByRole('button', { name: /^Instructor/ }).click();
  await expect(python).toHaveAttribute('aria-expanded', 'false');
  await expect(setup.getByRole('region', { name: 'Instructor setup' }).getByText(/default mode sends a tool call/)).toBeVisible();
  await setup.getByRole('button', { name: /^Instructor/ }).click();
  await expect(setup.locator('pre')).toHaveCount(0);

  await relay(page, null, relayId, { requests: 3026, last_request_at: '2026-11-14T20:00:00+00:00' });
  await page.reload();
  await expect(setup.getByText('3,026 requests have passed through.')).toBeVisible();
  await expect(setup.getByText(/Last one around Nov 14, 2026/)).toBeVisible();
});

test.describe('a compared model answering what it is sure of', () => {
  const offers = [{ promise: 0.99, cutoff: null }, { promise: 0.98, cutoff: { confidence_at_least: 0.96, asked: 706, agreed: 698 } }, { promise: 0.95, cutoff: { confidence_at_least: 0.84, asked: 798, agreed: 783 } }];
  const compared = { ...shadow, asked: 1200, agreed: 1130 };
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  const withShadow = (extra: object) => ({ ...report, compare: true, questions: [{ ...report.questions[0], shadows: [{ ...compared, ...extra }] }] });

  test('the account chooses a promise the comparison supports, confirms, and can stop it again', async ({ page }) => {
    await signIn(page);
    let state: object = { offers, answering: null, stopped: null };
    const sent: unknown[] = [];
    await page.route('http://127.0.0.1:8999/v1/relay/report', route => route.fulfill({ json: withShadow(state), headers }));
    await page.route('http://127.0.0.1:8999/v1/relay/questions/*/answering', route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const body = route.request().postDataJSON();
      sent.push([new URL(route.request().url()).pathname, body]);
      state = { offers, stopped: null, answering: body.promise ? { promise: body.promise, confidence_at_least: 0.96, since: '2026-11-16T15:00:00+00:00', answered: 0, checked: 0, check_agreed: 0 } : null };
      return route.fulfill({ headers, json: { promise: body.promise } });
    });
    await page.goto('/gateway');
    const panel = page.getByRole('region', { name: 'Question 1' }).getByRole('group', { name: 'Let this model answer what it is sure of' });
    await expect(panel.getByText('Your app receives your provider’s answer on every call today.')).toBeVisible();
    // A promise the comparison does not support yet cannot be chosen; the others say what they rest on.
    await expect(panel.getByRole('radio', { name: /^99%/ })).toBeDisabled();
    await expect(panel.getByText('Not supported by the comparison yet.')).toBeVisible();
    await expect(panel.getByText('Answers when it is 96% or more confident. So far it matched your provider on 698 of 706 such answers.')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Start answering' })).toBeDisabled();
    await panel.getByRole('radio', { name: /^98%/ }).check();
    await panel.getByRole('button', { name: 'Start answering' }).click();
    // What changes for the app is said before anything is switched.
    const confirm = panel.getByRole('group', { name: 'Confirm answering' });
    await expect(confirm.getByText('Your app will receive this model’s answer, not your provider’s, on calls it is at least 96% confident about.')).toBeVisible();
    // The confirmation stands in for the introduction: the two say the same thing.
    await expect(panel.getByText('Your app receives your provider’s answer on every call today.')).toHaveCount(0);
    expect(sent).toEqual([]);
    await confirm.getByRole('button', { name: 'Start answering' }).click();
    const on = page.getByRole('region', { name: 'Question 1' }).getByRole('group', { name: 'Answering what it is sure of' });
    await expect(on.getByText('Answers calls itself when it is 96% or more confident, to match your provider on at least 98% of them.')).toBeVisible();
    expect(sent).toEqual([[`/v1/relay/questions/${'e'.repeat(64)}/answering`, { field: 'intent', promise: 0.98 }]]);
    await on.getByRole('button', { name: 'Stop answering' }).click();
    await expect(page.getByRole('region', { name: 'Question 1' }).getByRole('group', { name: 'Let this model answer what it is sure of' })).toBeVisible();
    expect(sent[1]).toEqual([`/v1/relay/questions/${'e'.repeat(64)}/answering`, { field: 'intent', promise: null }]);
  });

  test('while it answers the page shows what it answered and how the checks went', async ({ page }) => {
    await signIn(page);
    await answer(page, 200, withShadow({ offers, stopped: null, answering: { promise: 0.98, confidence_at_least: 0.96, since: '2026-11-16T15:00:00+00:00', answered: 1900, checked: 100, check_agreed: 99 } }));
    await page.goto('/gateway');
    const on = page.getByRole('region', { name: 'Question 1' }).getByRole('group', { name: 'Answering what it is sure of' });
    await expect(on.getByText('1,900', { exact: true })).toBeVisible();
    await expect(on.getByText('99 of 100 checked answers matched your provider (99%).')).toBeVisible();
    await expect(page.getByText('Your app receives your provider’s answer on every call today.')).toHaveCount(0);
  });

  test('a model that stopped itself says when and why, and too few compared answers says how many are needed', async ({ page }) => {
    await signIn(page);
    await answer(page, 200, withShadow({ offers, answering: null, stopped: { at: '2026-11-16T18:00:00+00:00', promise: 0.99, checked: 120, differed: 5 } }));
    await page.goto('/gateway');
    const panel = page.getByRole('region', { name: 'Question 1' }).getByRole('group', { name: 'Let this model answer what it is sure of' });
    await expect(panel.getByRole('status')).toContainText('It stopped answering by itself');
    await expect(panel.getByRole('status')).toContainText('5 of 120 checked answers differed from your provider, too many for 99%.');
    await answer(page, 200, withShadow({ asked: 240, agreed: 230, offers: offers.map(offer => ({ ...offer, cutoff: null })), answering: null, stopped: null }));
    await page.reload();
    await expect(panel.getByText('Available after 1,000 compared answers. So far: 240.')).toBeVisible();
    await expect(panel.getByRole('radio')).toHaveCount(0);
  });

  test('a service from before answering shows nothing new', async ({ page }) => {
    await signIn(page);
    await answer(page, 200, withShadow({}));
    await page.goto('/gateway');
    await expect(page.getByRole('row', { name: /99% or more/ })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Let this model answer what it is sure of' })).toHaveCount(0);
  });
});

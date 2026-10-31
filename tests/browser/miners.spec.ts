import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';

// networkMiners() runs on the Next server, so page.route cannot see it. A real listener stands in for the training API.
// The port must match NEXT_PUBLIC_ZILS_TRAINING_API_URL in playwright.config.ts.
const PORT = Number(process.env.ZILS_MINERS_TEST_PORT ?? 8999);
let mode: 'ok' | 'fail' = 'ok';
let server: Server;
const stats = (assigned: number, selected: number, median_skill: number | null) => ({ assigned, submitted: assigned, evaluated: assigned, selected, median_skill });
const miner = (uid: number, hotkey: string, status: string, assigned: number, selected: number, skill: number | null, last_seen: string | null) =>
  ({ uid, hotkey, status, last_seen, models: status === 'online' ? ['d3-mini-4.5b-v1'] : [], training: stats(assigned, selected, skill) });
const FIXTURE = {
  as_of: '2026-10-18T19:58:00Z',
  summary: { miners: 4, online: 2, stale: 0, offline: 0, unseen: 1, disabled: 1 },
  miners: [
    miner(1, '5HYcpLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxZuwaoF', 'online', 28, 4, 0.98, '2026-10-18T19:58:00Z'),
    miner(101, '5CqL39xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxvkACT5', 'online', 14, 3, 0.94, '2026-10-18T19:58:00Z'),
    miner(102, '5ERwXQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxWmF3bn', 'disabled', 2, 2, 0.71, null),
    miner(100, '5CRwgbxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxBrTxDn', 'unseen', 0, 0, null, null),
  ],
};
let snapshot = structuredClone(FIXTURE);

// GET /v1/network/soup (ZIL-109): public round records, newest first, as zils/soup_publish writes them.
const sha = (c: string) => c.repeat(64);
const cats = (v: number) => ({ reasoning: v, language: v, retrieval: v, tools: v, arts: v });
const soupRound = (id: string, score: number, members: object[], finished: string) => ({
  round_id: id, pool_id: 'd3-mini', seed: 'ab'.repeat(32), finished_at: finished, members, crown: null,
  category_scores: { ...cats(score), arts: score - 2 }, soup_sha256: sha('c'), subset_sha256: sha('d'), predictions_sha256: sha('e'),
});
const SOUP = () => ({
  as_of: new Date().toISOString(),
  tiers: [{
    pool: 'd3-mini', tier: 'z3-mini', serving: { release: 'z3-mini v1', served_by: 'zils' },
    bodies: { [sha('a')]: { house: 'pplx-decider-flash-v1.2', repo: 'perplexity-ai/pplx-decider-flash-v1.2' }, [sha('b')]: { house: null, repo: 'miner/body-one' } },
    rounds: [
      soupRound('2026-11-05', 71.6, [
        { hotkey: '5House', body_sha256: sha('a'), rate: 0, seat_weight: 0, contribution: 2.5 },
        { hotkey: '5MinerHotkey', body_sha256: sha('b'), rate: 1, seat_weight: 0.8, contribution: 1 },
        { hotkey: '5Unknown', body_sha256: sha('f'), rate: 1, seat_weight: 0, contribution: 0 },
      ], '2026-11-05T03:40:00Z'),
      soupRound('2026-11-04', 71, [{ hotkey: '5House', body_sha256: sha('a'), rate: 0, seat_weight: 0, contribution: 3 }], '2026-11-04T03:41:00Z'),
      soupRound('2026-11-03', 70.2, [{ hotkey: '5House', body_sha256: sha('a'), rate: 0, seat_weight: 0, contribution: 3 }], '2026-11-03T03:39:00Z'),
    ],
  }],
});
let soupMode: 'ok' | 'none' = 'none';

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/v1/config') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({
        model: { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B', max_input_tokens: 4096 },
        channels: { stable: { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B' }, latest: { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B' } },
      }));
    }
    if (req.url === '/v1/network/base-submissions') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({network: 'test', netuid: 579, block: 8289200, as_of: new Date().toISOString(), submissions: [{uid: 7, hotkey: '5DFDtesthotkey', commitment_block: 8289168, sha256: 'a'.repeat(64), revision: 'b'.repeat(40), repo: 'owner/lite-candidate', model: 'd3-lite-0.8b-v1'}]}));
    }
    if (req.url === '/v1/network/soup') {
      if (soupMode === 'none') { res.statusCode = 404; return res.end(); }
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(SOUP()));
    }
    if (!req.url?.startsWith('/v1/network/miners')) { res.statusCode = 404; return res.end(); }
    if (mode === 'fail') { res.statusCode = 500; return res.end('{}'); }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(snapshot));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
});
test.beforeEach(() => { mode = 'ok'; soupMode = 'none'; snapshot = structuredClone(FIXTURE); });
test.afterAll(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const baseline: { bittensor: { text: string } } = JSON.parse(readFileSync('tests/browser/fixtures/content-baseline.json', 'utf8'));
const uids = (page: import('@playwright/test').Page) => page.getByText(/^Worker \d+$/).evaluateAll(els => els.map(e => e.textContent));

test('/bittensor redirects permanently to /miners', async ({ request }) => {
  const res = await request.get('/bittensor', { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(new URL(res.headers().location, 'http://x').pathname).toBe('/miners');
});

test('an outage shows the unavailable panel and the rest of the page renders', async ({ page }) => {
  mode = 'fail';
  const errors: Error[] = [];
  page.on('pageerror', e => errors.push(e));
  await page.goto('/miners');
  await expect(page.getByText('The leaderboard is unavailable right now.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Earn by improving z3.', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Beat the base.', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Customer-training workers' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the leaderboard sorts by Selected, re-sorts from the keyboard and dims offline miners', async ({ page }) => {
  mode = 'ok';
  await page.goto('/miners');
  await expect(page.getByText('Updated 19:58 UTC').first()).toBeAttached();
  await expect(page.getByText('Workers online')).toBeVisible();
  expect(await uids(page)).toEqual(['Worker 1', 'Worker 101', 'Worker 102', 'Worker 100']);
  await expect(page.getByRole('columnheader', { name: 'Selected' })).toHaveAttribute('aria-sort', 'descending');
  const dim = page.locator('[role=row][data-dim]');
  await expect(dim).toHaveCount(2);
  expect(await dim.first().locator('[data-status]').evaluate(e => getComputedStyle(e, '::before').opacity)).toBe('0.45');
  await expect(page.getByText('No candidates yet')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Never seen' })).toBeVisible();
  const skill = page.getByRole('button', { name: 'Median skill' });
  await skill.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('columnheader', { name: 'Median skill' })).toHaveAttribute('aria-sort', 'descending');
  await expect(page.getByRole('columnheader', { name: 'Selected' })).toHaveAttribute('aria-sort', 'none');
  await page.getByRole('button', { name: 'Worker', exact: true }).click(); // UID, descending
  expect(await uids(page)).toEqual(['Worker 102', 'Worker 101', 'Worker 100', 'Worker 1']);
});

test('an open page follows miners and models outside the default channels without losing its sort', async ({ page }) => {
  await page.clock.install();
  await page.goto('/miners');
  const first = page.getByRole('row').filter({ has: page.getByText('Worker 1', { exact: true }) });
  await expect(first).toContainText('z3-mini 4.5B');
  await page.getByRole('button', { name: 'Worker', exact: true }).click();
  snapshot.miners[0].models = ['d3-lite-0.8b-v1', 'future-model-v2'];
  snapshot.miners[1].status = 'offline';
  snapshot.miners[1].last_seen = '2026-10-18T17:00:00Z';
  snapshot.miners.push({ ...miner(103, '5NewMiner', 'online', 0, 0, null, '2026-10-18T19:59:00Z'), models: ['d3-mini-4.5b-v1'] });
  snapshot.summary = { ...snapshot.summary, miners: 5, offline: 1 };
  snapshot.as_of = '2026-10-18T19:59:00Z';
  await page.clock.fastForward(30_000);
  await expect(first).toContainText('z3-lite 0.8B, future-model-v2');
  await expect(first).not.toContainText('z3-mini');
  await expect(page.getByText('Updated 19:59 UTC').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Offline', exact: true })).toBeVisible();
  await expect(page.getByText('Worker 103', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Worker' })).toHaveAttribute('aria-sort', 'descending');
  expect(await uids(page)).toEqual(['Worker 103', 'Worker 102', 'Worker 101', 'Worker 100', 'Worker 1']);
});

test('an open page removes unavailable data and recovers on the next refresh', async ({ page }) => {
  await page.clock.install();
  await page.goto('/miners');
  await page.getByRole('button', { name: 'Worker', exact: true }).click();
  mode = 'fail';
  await page.clock.fastForward(30_000);
  await expect(page.getByText('The leaderboard is unavailable right now.')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Customer-training workers' })).toHaveCount(0);
  mode = 'ok';
  snapshot.miners[0].models = ['d3-lite-0.8b-v1'];
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('table', { name: 'Customer-training workers' })).toContainText('z3-lite 0.8B');
  await expect(page.getByText('The leaderboard is unavailable right now.')).toHaveCount(0);
});

test('refresh pauses in a hidden tab and resumes immediately when visible', async ({ page }) => {
  await page.clock.install();
  await page.goto('/miners');
  await page.getByRole('button', { name: 'Worker', exact: true }).click();
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }));
  snapshot.miners[0].models = ['d3-lite-0.8b-v1'];
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('table', { name: 'Customer-training workers' })).not.toContainText('z3-lite');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('table', { name: 'Customer-training workers' })).toContainText('z3-lite 0.8B');
});

test('the rehearsal row holds every sentence of the old /bittensor page', async ({ page }) => {
  mode = 'ok';
  await page.goto('/miners');
  await page.getByText('Testnet rehearsal · 25 Sept 2026').click();
  const text = norm(await page.locator('main').innerText());
  expect(text).toContain('How miners train decision models, validators evaluate them, and weights reach the chain.');
  await expect(page.getByRole('link', { name: 'View the recorded round' })).toHaveAttribute('href', '#testnet');
  await expect(page.getByRole('link', { name: 'Model research' })).toHaveAttribute('href', '/model');
  const missing = baseline.bittensor.text.split('. ').map(norm).filter(Boolean).filter(sentence => !text.includes(sentence));
  expect(missing).toEqual([]);
});

test('the timeline entries survive in the collapsed row', async ({ page }) => {
  mode = 'ok';
  await page.goto('/miners');
  await page.getByText('What we have tried', { exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 4 })).toHaveCount(6);
  await expect(page.getByText('A tie, so no winner', { exact: true })).toBeVisible();
  await expect(page.getByText(/recorded as an override of the promotion rule, not a win under it/)).toBeVisible();
});

test('status wording is the approved copy', async ({ page }) => {
  mode = 'ok';
  await page.goto('/miners');
  await page.getByText('How to read customer-job results').click();
  for (const phrase of ['checked in within the last 45 seconds', 'registered but never checked in', 'gets no new jobs', 'latest signed check-in', 'not on-chain UIDs']) await expect(page.getByText(phrase)).toBeVisible();
});

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  test('no overflow at 375px, no header row, two-line rows', async ({ page }) => {
    mode = 'ok';
    await page.goto('/miners');
    await page.getByText('Testnet rehearsal · 25 Sept 2026').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await expect(page.getByRole('button', { name: 'Median skill' })).toBeHidden();
    const first = page.locator('[role=row][data-dim]').first().locator('xpath=preceding::*[@role="row"][1]');
    const top = (sel: string) => first.locator(sel).evaluate(e => e.getBoundingClientRect().top);
    const uid = await top('text=/^Worker \\d+$/');
    expect(await top('[data-status]')).toBeGreaterThan(uid); // status sits under the UID
    expect(await top('text=/^of \\d+ jobs$/')).toBeLessThan(await top('[data-status]')); // selected shares the first line
  });
});

for (const theme of ['dark', 'light']) {
  test(`dimmed rows keep AA text contrast (${theme})`, async ({ page }) => {
    mode = 'ok';
    await page.addInitScript(t => localStorage.setItem('zils-theme', t), theme);
    await page.goto('/miners');
    const results = await page.locator('[role=row][data-dim]').first().evaluate(row => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      const bg = parse(getComputedStyle(document.querySelector('.zs')!).backgroundColor).slice(0, 3);
      return [...row.querySelectorAll('b, span, [role=cell]')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim())).map(e => {
        const [r, g, b, a = 1] = parse(getComputedStyle(e).color);
        const fg = [r, g, b].map((v, i) => v * a + bg[i] * (1 - a));
        const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        return { text: e.textContent!.trim(), ratio: (hi + .05) / (lo + .05) };
      });
    });
    expect(results.length).toBeGreaterThan(3);
    for (const r of results) expect(r.ratio, r.text).toBeGreaterThanOrEqual(4.5);
  });
}

test('Tonight’s soup shows each tier’s score, change, seats, crown, serving and history from the feed', async ({ page }) => {
  soupMode = 'ok';
  await page.goto('/miners');
  const board = page.getByRole('region', { name: 'Tonight’s soup' });
  // A bento box per tier, chosen with tier chips; the first tier is open.
  await expect(board.getByRole('button', { name: 'z3-mini' })).toHaveAttribute('aria-pressed', 'true');
  const mini = board.getByRole('article', { name: 'z3-mini' });
  for (const name of ['Soup score', 'Seats', 'Crown', 'Serving', 'Categories', 'Recent rounds']) await expect(mini.getByRole('group', { name })).toBeVisible();
  // 71.6 in four categories and 69.6 in arts → 71.4; the previous round was 70.8.
  await expect(mini.getByText('71.4', { exact: true })).toBeVisible();
  // The /soup bowl, one topping per occupied seat: three seats tonight.
  await expect(mini.getByRole('group', { name: 'Soup score' }).getByRole('img', { name: /bowl of soup with 3 of 5 seats filled/i })).toBeVisible();
  await expect(mini).toContainText('+0.6 since the last round');
  const seats = mini.getByRole('list', { name: 'Seats' }).getByRole('listitem');
  await expect(seats).toHaveCount(3);
  await expect(seats.nth(0)).toContainText('pplx-decider-flash-v1.2');
  await expect(seats.nth(0)).toContainText('House');
  await expect(seats.nth(1)).toContainText('miner/body-one');
  await expect(seats.nth(1)).toContainText('+1.0');
  await expect(seats.nth(2)).toContainText('5Unk… · ffffffff');
  await expect(seats.nth(2)).toContainText('Unpaid');
  await expect(mini).toContainText('Crown burned');
  await expect(mini).toContainText('Serving z3-mini v1 · by Zils');
  await expect(mini.getByRole('img', { name: /Soup score over the last 3 rounds: 70.0, 70.8, 71.4/ })).toBeVisible();
  expect(await board.locator('[lang=ja]').count()).toBeGreaterThanOrEqual(3);
  await expect(board).not.toContainText('No soup feed is connected');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('without a soup feed the board says so instead of inventing seats', async ({ page }) => {
  await page.goto('/miners');
  const board = page.getByRole('region', { name: 'Tonight’s soup' });
  await expect(board).toContainText('Seats appear here after the first round');
  await expect(board.getByRole('article')).toHaveCount(0);
});

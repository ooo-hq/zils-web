import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';

// networkMiners() runs on the Next server, so page.route cannot see it. A real listener stands in for the training API.
// The port must match NEXT_PUBLIC_ZILS_TRAINING_API_URL in playwright.config.ts.
const PORT = Number(process.env.ZILS_MINERS_TEST_PORT ?? 8999);
let mode: 'ok' | 'fail' = 'ok';
let server: Server;
// GET /v1/network/bodies (ZIL-109): every uid with a soup body or a serving endpoint on chain.
const chainBody = (pool: string, c: string, repo: string) => ({ pool, sha256: c.repeat(64), revision: 'f'.repeat(40), repo, block: 8300000 });
const CHAIN = () => ({
  network: 'test', netuid: 579, block: 8351998, as_of: new Date().toISOString(),
  miners: [
    { uid: 1, hotkey: '5MinerHotkeyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', body: chainBody('d3-mini', 'b', 'miner/body-one'), serving: true },
    { uid: 5, hotkey: '5OutsideHotkeyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', body: chainBody('d3-mini', '9', 'miner/body-two'), serving: false },
    { uid: 7, hotkey: '5LiteHotkeyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', body: chainBody('d3-lite', '8', 'miner/lite-body'), serving: false },
  ],
});
let snapshot = CHAIN();
// GET /v1/network/soup (ZIL-109): public round records, newest first, as zils/soup_publish writes them.
const sha = (c: string) => c.repeat(64);
const cats = (v: number) => ({ reasoning: v, language: v, retrieval: v, tools: v, arts: v });
const soupRound = (id: string, score: number, members: object[], finished: string) => ({
  round_id: id, pool_id: 'd3-mini', seed: 'ab'.repeat(32), finished_at: finished, members, crown: null,
  category_scores: { ...cats(score), arts: score - 2 }, soup_sha256: sha('c'), subset_sha256: sha('d'), predictions_sha256: sha('e'),
  decision: { rounds: ['d3-mini-2026-11-03', 'd3-mini-2026-11-04', id], items: 9000 },
});
const SOUP = () => ({
  as_of: new Date().toISOString(),
  tiers: [{ pool: 'd3-lite', tier: 'z3-lite', serving: null, bodies: {}, rounds: [] }, {
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
    if (!req.url?.startsWith('/v1/network/bodies')) { res.statusCode = 404; return res.end(); }
    if (mode === 'fail') { res.statusCode = 500; return res.end('{}'); }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(snapshot));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
});
test.beforeEach(() => { mode = 'ok'; soupMode = 'ok'; snapshot = CHAIN(); });
test.afterAll(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const baseline: { bittensor: { text: string } } = JSON.parse(readFileSync('tests/browser/fixtures/content-baseline.json', 'utf8'));

test('/bittensor redirects permanently to /miners', async ({ request }) => {
  const res = await request.get('/bittensor', { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(new URL(res.headers().location, 'http://x').pathname).toBe('/miners');
});

test('each tier shows what its soup is made of tonight, who made each part and who serves it', async ({ page }) => {
  await page.goto('/miners');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Miners make z3.');
  const tiers = page.getByRole('region', { name: 'Tonight’s soup' }).getByRole('article');
  await expect(tiers).toHaveCount(4);
  expect(await tiers.evaluateAll(els => els.map(e => e.getAttribute('aria-label')))).toEqual(['z3-lite', 'z3-mini', 'z3-flash', 'z3']);

  const mini = page.getByRole('article', { name: 'z3-mini' });
  // 71.6 in four categories and 69.6 in arts → 71.4; the previous round was 70.8.
  await expect(mini.getByText('71.4', { exact: true })).toBeVisible();
  await expect(mini).toContainText('+0.6 since the last round');
  await expect(mini).toContainText('Served by Zils as z3-mini v1');
  // The recipe: a uniform average, so every body is an equal part.
  await expect(mini.getByRole('img', { name: 'z3-mini soup tonight, 3 equal parts: pplx-decider-flash-v1.2 (house), miner/body-one (miner, paid seat), 5Unk… · ffffffff (miner, unpaid)' })).toBeVisible();
  const parts = mini.getByRole('list', { name: 'Parts' }).getByRole('listitem');
  await expect(parts).toHaveCount(3);
  await expect(parts.nth(0)).toContainText('pplx-decider-flash-v1.2');
  await expect(parts.nth(0)).toContainText('perplexity-ai');
  await expect(parts.nth(0)).toContainText('House · never paid');
  await expect(parts.nth(1)).toContainText('miner/body-one');
  await expect(parts.nth(1)).toContainText('Seat');
  await expect(parts.nth(1)).toContainText('+1.0');
  await expect(parts.nth(2)).toContainText('Unpaid');
  await expect(mini).toContainText('No crown tonight');
  await expect(mini).toContainText('Seats decided on 3 rounds, 9,000 items');
  const widths = await mini.locator('[role=img] [data-part]').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  // Only miner bodies carry colour; house bodies are hatched.
  expect(await mini.locator('[role=img] [data-part="house"]').count()).toBe(1);
  expect(await mini.locator('[role=img] [data-part="miner"]').count()).toBe(2);

  const lite = page.getByRole('article', { name: 'z3-lite' });
  await expect(lite).toContainText('Waiting for its first round');
  await expect(lite).toContainText('Not served yet');
  await expect(lite.getByRole('list', { name: 'In the pot' })).toContainText('Intern-Decision-0.8B');
  await expect(page.getByRole('article', { name: 'z3-flash' })).toContainText('Opens later');
  for (const gone of ['Customer jobs', 'Current base', 'Worker 1', 'Customer-training workers']) await expect(page.locator('main')).not.toContainText(gone);
});

test('without a soup feed every tier shows its pot and says the rounds are unavailable, never invented seats', async ({ page }) => {
  soupMode = 'none';
  await page.goto('/miners');
  const board = page.getByRole('region', { name: 'Tonight’s soup' });
  await expect(board).toContainText('Tonight’s rounds are unavailable right now.');
  await expect(board.getByRole('list', { name: 'Parts' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'z3-mini' }).getByRole('list', { name: 'In the pot' })).toContainText('pplx-decider-flash-v1.2');
});

test('the miners on chain are a sheet on the pass: one row per uid, its tier, its body and where it stands tonight', async ({ page }) => {
  await page.goto('/miners');
  const table = page.getByRole('table', { name: 'Miners on chain' });
  const rows = table.getByRole('row');
  await expect(rows).toHaveCount(4); // header + three uids
  await expect(rows.nth(1)).toContainText('1');
  await expect(rows.nth(1)).toContainText('z3-mini');
  await expect(rows.nth(1)).toContainText('miner/body-one');
  await expect(rows.nth(1)).toContainText('Paid seat');
  await expect(rows.nth(1)).toContainText('Endpoint announced');
  await expect(rows.nth(2)).toContainText('Not in tonight’s soup');
  await expect(rows.nth(2)).toContainText('No endpoint');
  await expect(rows.nth(3)).toContainText('z3-lite');
  await expect(rows.nth(3)).toContainText('Waiting for the first round');
  await expect(table.getByRole('link', { name: 'miner/body-one' })).toHaveAttribute('href', `https://huggingface.co/miner/body-one/tree/${'f'.repeat(40)}`);
  await expect(page.getByText('Block 8,351,998')).toBeVisible();
  // The sheet is paper on the purple pass: light in both themes, with the page's ink on it.
  await expect(rows.nth(1).getByRole('cell').first()).toHaveCSS('color', 'rgb(28, 26, 38)');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect(rows.nth(1).getByRole('cell').first()).toHaveCSS('color', 'rgb(28, 26, 38)');
});

test('an empty chain is an invitation, not a blank', async ({ page }) => {
  snapshot = { ...CHAIN(), miners: [] };
  await page.goto('/miners');
  const plate = page.getByRole('region', { name: 'Miners on chain' });
  await expect(plate).toContainText('No miner has committed a body yet.');
  await expect(plate.getByRole('link', { name: 'Bring a body to the soup' })).toHaveAttribute('href', '/soup');
  await expect(plate.getByRole('table', { name: 'Miners on chain' })).toHaveCount(0);
});

test('closed soups wear the sticker: z3-flash and z3 say No soup for you, lite and mini do not', async ({ page }) => {
  await page.goto('/miners');
  for (const tier of ['z3-flash', 'z3']) await expect(page.getByRole('article', { name: tier, exact: true }).getByText('No soup for you!')).toBeVisible();
  for (const tier of ['z3-lite', 'z3-mini']) await expect(page.getByRole('article', { name: tier, exact: true })).not.toContainText('No soup for you');
  await expect(page.getByRole('article', { name: 'z3-flash' })).toContainText('Opens later');
});

test('a chain outage says so and the rest of the page renders; the next refresh recovers', async ({ page }) => {
  await page.clock.install();
  mode = 'fail';
  const errors: Error[] = [];
  page.on('pageerror', e => errors.push(e));
  await page.goto('/miners');
  await expect(page.getByText('The chain view is unavailable right now.')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Miners on chain' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'z3-mini' })).toBeVisible();
  mode = 'ok';
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('table', { name: 'Miners on chain' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('emissions read as the four tiers plus 20% for customer models, with fixed seats and crowns', async ({ page }) => {
  await page.goto('/miners');
  const section = page.getByRole('region', { name: 'How miners earn' });
  await expect(section).toContainText('24 paid spots');
  await expect(section).toContainText('Lite and mini get 25% of emissions each, flash and z3 15% each');
  await expect(section).toContainText('a seat is 4% and a crown 5%');
  await expect(section).toContainText('2.4% and 3%');
  await expect(section.getByRole('list', { name: 'A round' }).getByRole('listitem')).toHaveCount(4);
  for (const gone of ['50%', '30%', '35%', 'boosted']) await expect(section).not.toContainText(gone);
  await expect(section).toContainText('Customer models pay from the other 20% of emissions');
  await expect(section).toContainText('Feature tracks do not pay yet');
  await expect(section).not.toContainText('equally');
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

for (const width of [1280, 390, 320]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/miners');
    await page.getByText('Testnet rehearsal · 25 Sept 2026').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

for (const theme of ['dark', 'light']) {
  test(`part labels and table text keep AA contrast (${theme})`, async ({ page }) => {
    await page.addInitScript(t => localStorage.setItem('zils-theme', t), theme);
    await page.goto('/miners');
    const results = await page.locator('[data-contrast]').evaluateAll(els => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      // Text is read against what it is really painted on: the nearest ancestor with an opaque background (the chain
      // table sits on the purple plate, the rest on the panel).
      const backdrop = (e: Element) => {
        for (let n: Element | null = e; n; n = n.parentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c.length && (c[3] ?? 1) === 1) return c.slice(0, 3);
        }
        return parse(getComputedStyle(document.querySelector('.zs')!).backgroundColor).slice(0, 3);
      };
      return els.flatMap(root => [root, ...root.querySelectorAll('*')]).filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim())).map(e => {
        const bg = backdrop(e);
        const [r, g, b, a = 1] = parse(getComputedStyle(e).color);
        const fg = [r, g, b].map((v, i) => v * a + bg[i] * (1 - a));
        const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        return { text: e.textContent!.trim().slice(0, 40), ratio: (hi + .05) / (lo + .05) };
      });
    });
    expect(results.length).toBeGreaterThan(10);
    for (const r of results) expect(r.ratio, r.text).toBeGreaterThanOrEqual(4.5);
  });
}

test('the chain section is the purple pass, in both themes', async ({ page }) => {
  await page.goto('/miners');
  const plate = page.getByRole('region', { name: 'Miners on chain' });
  await expect(plate.getByRole('table', { name: 'Miners on chain' })).toBeVisible();
  await expect(plate).toHaveCSS('background-color', 'rgb(75, 68, 200)'); // Zils purple #4b44c8
  // The plate's own words (the block line) are white at some alpha, never the page's ink.
  const colors = await plate.locator(':scope > div > p, :scope > div > p span').evaluateAll(els => [...new Set(els.map(e => getComputedStyle(e).color))]);
  expect(colors.length).toBeGreaterThan(0);
  for (const c of colors) expect(c).toMatch(/^rgba?\(255, 255, 255/);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect(plate).toHaveCSS('background-color', 'rgb(75, 68, 200)');
});

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

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/v1/config') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({
        model: { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B', max_input_tokens: 4096 },
        channels: { stable: { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B' }, latest: { id: 'd3-mini-4.5b-zils-r5', name: 'd3-mini 4.5B · r5' } },
      }));
    }
    if (!req.url?.startsWith('/v1/network/miners')) { res.statusCode = 404; return res.end(); }
    if (mode === 'fail') { res.statusCode = 500; return res.end('{}'); }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(snapshot));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
});
test.beforeEach(() => { mode = 'ok'; snapshot = structuredClone(FIXTURE); });
test.afterAll(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const baseline: { bittensor: { text: string } } = JSON.parse(readFileSync('tests/browser/fixtures/content-baseline.json', 'utf8'));
const uids = (page: import('@playwright/test').Page) => page.getByText(/^UID \d+$/).evaluateAll(els => els.map(e => e.textContent));

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
  await expect(page.getByRole('heading', { name: 'Miner leaderboard', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Beat the base.', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Miner leaderboard' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the leaderboard sorts by Selected, re-sorts from the keyboard and dims offline miners', async ({ page }) => {
  mode = 'ok';
  await page.goto('/miners');
  await expect(page.getByText('Updated 19:58 UTC').first()).toBeAttached();
  await expect(page.getByText('Online now')).toBeVisible();
  expect(await uids(page)).toEqual(['UID 1', 'UID 101', 'UID 102', 'UID 100']);
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
  await page.getByRole('button', { name: 'Miner', exact: true }).click(); // UID, descending
  expect(await uids(page)).toEqual(['UID 102', 'UID 101', 'UID 100', 'UID 1']);
});

test('an open page follows miners and models outside the default channels without losing its sort', async ({ page }) => {
  await page.clock.install();
  await page.goto('/miners');
  const first = page.getByRole('row').filter({ has: page.getByText('UID 1', { exact: true }) });
  await expect(first).toContainText('d3-mini 4.5B');
  await page.getByRole('button', { name: 'Miner', exact: true }).click();
  snapshot.miners[0].models = ['d3-lite-0.8b-v1', 'future-model-v2'];
  snapshot.miners[1].status = 'offline';
  snapshot.miners[1].last_seen = '2026-10-18T17:00:00Z';
  snapshot.miners.push({ ...miner(103, '5NewMiner', 'online', 0, 0, null, '2026-10-18T19:59:00Z'), models: ['d3-mini-4.5b-zils-r5'] });
  snapshot.summary = { ...snapshot.summary, miners: 5, offline: 1 };
  snapshot.as_of = '2026-10-18T19:59:00Z';
  await page.clock.fastForward(30_000);
  await expect(first).toContainText('d3-lite 0.8B, future-model-v2');
  await expect(first).not.toContainText('d3-mini');
  await expect(page.getByText('Updated 19:59 UTC').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Offline', exact: true })).toBeVisible();
  await expect(page.getByText('UID 103', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Miner' })).toHaveAttribute('aria-sort', 'descending');
  expect(await uids(page)).toEqual(['UID 103', 'UID 102', 'UID 101', 'UID 100', 'UID 1']);
});

test('an open page removes unavailable data and recovers on the next refresh', async ({ page }) => {
  await page.clock.install();
  await page.goto('/miners');
  await page.getByRole('button', { name: 'Miner', exact: true }).click();
  mode = 'fail';
  await page.clock.fastForward(30_000);
  await expect(page.getByText('The leaderboard is unavailable right now.')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Miner leaderboard' })).toHaveCount(0);
  mode = 'ok';
  snapshot.miners[0].models = ['d3-lite-0.8b-v1'];
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('table', { name: 'Miner leaderboard' })).toContainText('d3-lite 0.8B');
  await expect(page.getByText('The leaderboard is unavailable right now.')).toHaveCount(0);
});

test('refresh pauses in a hidden tab and resumes immediately when visible', async ({ page }) => {
  await page.clock.install();
  await page.goto('/miners');
  await page.getByRole('button', { name: 'Miner', exact: true }).click();
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }));
  snapshot.miners[0].models = ['d3-lite-0.8b-v1'];
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('table', { name: 'Miner leaderboard' })).not.toContainText('d3-lite');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('table', { name: 'Miner leaderboard' })).toContainText('d3-lite 0.8B');
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
  await page.getByText('How to read the leaderboard').click();
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
    const uid = await top('text=/^UID \\d+$/');
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

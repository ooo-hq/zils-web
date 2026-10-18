import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFileSync, rmSync } from 'node:fs';

// networkMiners() runs on the Next server, so page.route cannot see it. A real listener stands in for the training API.
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

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (!req.url?.startsWith('/v1/network/miners')) { res.statusCode = 404; return res.end(); }
    if (mode === 'fail') { res.statusCode = 500; return res.end('{}'); }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(FIXTURE));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(8999, '127.0.0.1', resolve); });
});
// networkMiners() caches for 60 s on disk; clear it so each test sees the mode it set.
test.beforeEach(() => { rmSync('.next/dev/cache/fetch-cache', { recursive: true, force: true }); });
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
  await expect(page.getByText('Beat d3-mini to become the base.')).toBeVisible();
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
  expect(await dim.first().evaluate(e => getComputedStyle(e).opacity)).toBe('0.45');
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

test('the rehearsal row holds every sentence of the old /bittensor page', async ({ page }) => {
  mode = 'ok';
  await page.goto('/miners');
  await page.getByText('Testnet rehearsal · 25 Sept 2026').click();
  const text = norm(await page.locator('main').innerText());
  const missing = baseline.bittensor.text.split('. ').map(norm).filter(Boolean).filter(sentence => !text.includes(sentence));
  expect(missing).toEqual([]);
});

test('status wording is the approved copy', async ({ page }) => {
  await page.goto('/miners');
  await page.getByText('How to read the leaderboard').click();
  for (const phrase of ['checked in within the last minute', 'registered but never checked in', 'gets no new jobs']) await expect(page.getByText(phrase)).toBeVisible();
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

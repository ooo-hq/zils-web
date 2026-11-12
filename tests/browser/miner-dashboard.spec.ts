import { test, expect, type Page } from '@playwright/test';

// /miners/dashboard reads everything from the browser: the private feed with the link's token, and the two public
// feeds /miners already shows. The API origin must match NEXT_PUBLIC_ZILS_TRAINING_API_URL in playwright.config.ts.
const API = 'http://127.0.0.1:8999';
const HOTKEY = '5MinerHotkeyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const sha = (c: string) => c.repeat(64);
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };

const DASHBOARD = {
  hotkey: HOTKEY, expires_at: '2026-11-13T15:00:00Z',
  report: { pools: {
    'd3-mini': { round_id: 'd3-mini-2026-11-11', bodies: [
      { body_sha256: sha('b'), stage: 'seated', reason: null, rate: 1, screen: { score: 71, needed: 68.5 }, solo: { score: 70.5, soup: 72 },
        categories: { reasoning: { score: 71, soup: 72 }, arts: { score: 66, soup: 71.5 } }, seat: { contribution: 1.5, floor: 0.8 } },
      { body_sha256: sha('c'), stage: 'not_selected', reason: 'no_soup_gain', solo: { score: 69, soup: 72 }, trial: { gain: 0, needed: 0.5 } },
    ] },
    'd3-lite': { round_id: null, bodies: [] },
  } },
  jobs: [
    { created_at: '2026-11-10T02:00:00+00:00', track: 'text', state: 'submitted', status: 'completed', evaluated: true, skill: 0.4, selected: true },
    { created_at: '2026-11-09T02:00:00+00:00', track: 'image', state: 'failed', status: 'failed', evaluated: false, skill: null, selected: false },
  ],
};
const cats = { reasoning: 72, language: 72, retrieval: 72, tools: 72, arts: 71.5 };
const round = (day: string, members: object[], crown: object | null = null) => ({
  round_id: `d3-mini-${day}`, pool_id: 'd3-mini', seed: 'ab'.repeat(32), finished_at: `${day}T03:40:00Z`, members, crown,
  category_scores: cats, soup_sha256: sha('c'), subset_sha256: sha('d'), predictions_sha256: sha('e'),
});
const SOUP = () => ({
  as_of: new Date().toISOString(),
  tiers: [{ pool: 'd3-mini', tier: 'z3-mini', serving: null, bodies: {}, rounds: [
    round('2026-11-11', [{ hotkey: null, body_sha256: sha('a'), rate: 0, seat_weight: 0, contribution: 3 }, { hotkey: HOTKEY, body_sha256: sha('b'), rate: 1, seat_weight: 0.04, contribution: 1.5 }]),
    round('2026-11-10', [{ hotkey: HOTKEY, body_sha256: sha('b'), rate: 1, seat_weight: 0, contribution: 0.5 }]),
  ] }],
});
const CHAIN = () => ({
  network: 'test', netuid: 579, block: 8351998, as_of: new Date().toISOString(),
  miners: [
    { uid: 12, hotkey: HOTKEY, body: { pool: 'd3-mini', sha256: sha('b'), revision: 'f'.repeat(40), repo: 'miner/body-one', block: 1000000 }, serving: false },
    { uid: 5, hotkey: '5Other', body: null, serving: true },
  ],
});

async function feeds(page: Page, dashboard: (token: string | undefined) => { status: number; json: object }) {
  const seen: (string | undefined)[] = [];
  await page.route(`${API}/v1/network/**`, route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/v1/network/soup') return route.fulfill({ headers: cors, json: SOUP() });
    if (url.pathname === '/v1/network/bodies') return route.fulfill({ headers: cors, json: CHAIN() });
    if (url.pathname === '/v1/network/miner/dashboard') {
      const token = route.request().headers().authorization?.replace(/^Bearer /, '');
      seen.push(token);
      return route.fulfill({ headers: cors, ...dashboard(token) });
    }
    return route.fulfill({ status: 404, headers: cors });
  });
  return seen;
}

test('a private link shows the miner where it stands, its report, its seats and its customer jobs', async ({ page }) => {
  const seen = await feeds(page, token => token === 'secret-token' ? { status: 200, json: DASHBOARD } : { status: 401, json: { error: 'expired' } });
  await page.goto('/miners/dashboard#secret-token');

  await expect(page.getByRole('heading', { level: 1, name: 'Your miner' })).toBeVisible();
  await expect(page.getByText('5Miner…xxxx')).toBeVisible();
  // Only ever with the link's token (development renders twice, so the count is not fixed).
  expect(seen.length).toBeGreaterThan(0);
  expect(new Set(seen)).toEqual(new Set(['secret-token']));
  // The token leaves the address bar once read, and a reload still opens the page.
  expect(new URL(page.url()).hash).toBe('');

  const now = page.getByRole('region', { name: 'Right now' });
  await expect(now).toContainText('UID 12');
  await expect(now).toContainText('z3-mini');
  await expect(now.getByRole('link', { name: 'miner/body-one' })).toBeVisible();
  await expect(now).toContainText('Paid seat');

  const report = page.getByRole('region', { name: 'Latest round report' });
  await expect(report).toContainText('d3-mini-2026-11-11');
  const seated = report.getByRole('article').filter({ hasText: sha('b').slice(0, 12) });
  await expect(seated).toContainText('Seated');
  await expect(seated).toContainText('Your body is in the soup and its seat pays.');
  await expect(seated.getByRole('row', { name: /Contribution/ })).toContainText('floor 0.8');
  await expect(seated.getByRole('row', { name: /arts/ })).toContainText('Furthest behind');
  const missed = report.getByRole('article').filter({ hasText: sha('c').slice(0, 12) });
  await expect(missed).toContainText('Not selected');
  await expect(missed).toContainText('Next: Train where the soup is weak');
  await expect(missed.getByRole('row', { name: /Soup gain/ })).toContainText('needed +0.5');
  await expect(report).toContainText('zils-miner dashboard');

  const seats = page.getByRole('region', { name: 'Seats and pay' });
  await expect(seats.getByRole('row').nth(1)).toContainText('2026-11-11');
  await expect(seats.getByRole('row').nth(1)).toContainText('Paid seat');
  await expect(seats.getByRole('row').nth(1)).toContainText('4%');
  await expect(seats.getByRole('row').nth(2)).toContainText('In the soup, unpaid');
  await expect(seats).toContainText('1 of 2 rounds paid');

  const jobs = page.getByRole('region', { name: 'Customer jobs' });
  await expect(jobs).toContainText('1 delivered');
  await expect(jobs.getByRole('row').nth(1)).toContainText('Delivered to the customer');
  await expect(jobs.getByRole('row').nth(2)).toContainText('Run failed');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Your miner' })).toBeVisible();
  expect(new Set(seen)).toEqual(new Set(['secret-token']));

  // It fits a phone without sideways scrolling.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('without a link, or with an expired one, the page says how to get one and shows nothing private', async ({ page }) => {
  const seen = await feeds(page, () => ({ status: 401, json: { error: 'This dashboard link has expired.' } }));
  await page.goto('/miners/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Open your miner dashboard' })).toBeVisible();
  await expect(page.getByText('zils-miner dashboard', { exact: true })).toBeVisible();
  expect(seen).toEqual([]);

  await page.goto('/miners/dashboard#old-token');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'This link has expired' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Latest round report' })).toHaveCount(0);
  // An expired token is forgotten.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Open your miner dashboard' })).toBeVisible();
});

test('when the private feed is down the page says so instead of guessing', async ({ page }) => {
  await feeds(page, () => ({ status: 503, json: { error: 'down' } }));
  await page.goto('/miners/dashboard#secret-token');
  await expect(page.getByRole('heading', { level: 1, name: 'The dashboard is unavailable right now' })).toBeVisible();
});

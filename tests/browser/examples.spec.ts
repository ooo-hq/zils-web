import { test, expect } from '@playwright/test';
import recorded from '../../data/decision-examples.json';

test('intro and picker show the shortened copy and computed differences', async ({ page }) => {
  await page.goto('/examples');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('See what Zils decides.');
  await expect(page.getByText('Zils beside TypeSafe JEV in every demo. Same inputs, real recorded answers.')).toBeVisible();
  const diffs = await page.locator('[data-pick]').evaluateAll(els => els.map(e => [e.getAttribute('data-pick'), e.querySelector('[data-diff]')?.textContent]));
  expect(diffs).toEqual([['doom', '+97'], ['content', '+7'], ['chess', '+37'], ['inbox', '−3'], ['oro', '+7']]);
});

test('Review a post shows the recorded post and cycles with Another post', async ({ page }) => {
  await page.goto('/examples#content');
  const quote = page.locator('[data-post-quote]');
  const first = await quote.innerText();
  // The first post is shown from its recorded review text onward.
  const c0 = recorded.examples[0].content;
  expect(first).toContain(c0.slice(c0.indexOf('Now that wallet'), c0.indexOf('Now that wallet') + 40));
  await expect(page.getByText('Right = matches Bitcast’s label')).toBeVisible();
  const zils = page.locator('[data-verdict="zils"]');
  await expect(zils).toContainText(recorded.examples[0].decisions.zils === 'pass' ? 'Approve' : 'Do not approve');
  await expect(zils).toContainText(recorded.examples[0].decisions.zils === recorded.examples[0].decisions.production ? 'Right' : 'Wrong');
  await page.getByRole('button', { name: /Another post/ }).click();
  expect(await quote.innerText()).not.toBe(first);
  await expect(quote).toContainText(recorded.examples[1].content.slice(0, 40));
});

test('Find the mate plays each recorded move; board squares stay visible in both themes', async ({ page }) => {
  await page.goto('/examples#chess');
  const pos = recorded.chess.examples[0];
  const zilsMove = pos.moves.find(m => m.uci === pos.zils)!;
  const jevMove = pos.moves.find(m => m.uci === pos.jev)!;
  await page.getByRole('button', { name: new RegExp(zilsMove.label) }).click();
  await expect(page.locator('[data-choice="zils"]')).toContainText('Checkmate');
  await page.getByRole('button', { name: new RegExp(jevMove.label) }).click();
  await expect(page.locator('[data-choice="jev"]')).toContainText('Check, not mate');
  await expect(page.locator('[data-choice="zils"]')).not.toContainText('Checkmate');
  for (const theme of ['dark', 'light']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    const ratio = await page.evaluate(() => {
      const lum = (c: number[]) => { const l = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
      const parse = (s: string) => { const m = s.match(/[\d.]+/g)!.map(Number); return { rgb: m.slice(0, 3), a: m[3] ?? 1 }; };
      const frame = document.querySelector('[data-board]')!.closest('.zs') as HTMLElement;
      const panel = parse(getComputedStyle(frame).backgroundColor).rgb;
      const over = (s: string) => { const { rgb, a } = parse(s); return rgb.map((v, i) => v * a + panel[i] * (1 - a)); };
      const sq = (kind: string) => over(getComputedStyle(document.querySelector(`[data-sq="${kind}"]`)!).backgroundColor);
      const [a, b] = [lum(sq('l')), lum(sq('d'))];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio, theme).toBeGreaterThanOrEqual(1.2);
  }
});

test('Sort an inbox reveals the recorded intents; JEV lead renders grey with its caption', async ({ page }) => {
  await page.goto('/examples#inbox');
  await page.getByRole('button', { name: 'Sort with Zils' }).click();
  const chips = page.locator('[data-intent]');
  await expect(chips).toHaveCount(recorded.replies.length);
  for (const [i, r] of recorded.replies.entries()) await expect(chips.nth(i)).toHaveText(r.intent.replace(/_/g, ' '), { ignoreCase: true });
  const delta = page.locator('[data-delta]');
  await expect(delta).toHaveText('+3');
  await expect(delta).toHaveAttribute('data-lead', 'jev');
  await expect(page.getByText('more replies for JEV')).toBeVisible();
  const alpha = await delta.evaluate(el => getComputedStyle(el).color.match(/[\d.]+/g)!.map(Number)[3] ?? 1);
  expect(alpha).toBeLessThan(1);
  await page.getByRole('button', { name: /Survive Doom/ }).click();
  await expect(delta).toHaveAttribute('data-lead', 'zils');
  await expect(page.getByText('more games for Zils')).toBeVisible();
});

const study: [string, string][] = [
  ['doom', 'ViZDoom 1.3.0’s unmodified Deadly Corridor scenario'],
  ['content', '486 training posts, 159 calibration posts and 155 development posts'],
  ['chess', '2,048 training positions and 512 test positions'],
  ['inbox', '294 authored training examples'],
  ['oro', 'October 13, 2026 pilot: 720 authored training decisions'],
];
for (const [hash, text] of study) {
  test(`#${hash} Full test details holds the study text`, async ({ page }) => {
    await page.goto(`/examples#${hash}`);
    await page.getByText('Full test details', { exact: true }).click();
    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByText('Each example uses its task-specific Zils adapter.')).toBeVisible();
  });
}

test('examples fit a phone with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const hash of ['doom', 'content', 'chess', 'inbox', 'oro']) {
    await page.goto(`/examples#${hash}`);
    await page.getByText('Full test details', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), hash).toBe(true);
  }
});

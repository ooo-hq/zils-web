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

import doom from '../../data/doom-examples.json';

const closing = 'Each example uses its task-specific Zils adapter. These studies do not establish production reliability. The research adapters shown here have not been deployed.';
const trained = (r: number, tot: number, z: number) => `Training improved Zils from ${r}/${tot} to ${z}/${tot} on this test.`;
const o = doom.outcomes, e = doom.evidence;
const w = doom.zilsSuccessWilson95.map(x => (100 * x).toFixed(1));
const study: Record<string, string[]> = {
  doom: [
    'Correct means it collected the armor and reached the exit. 100 held-out starts on one map, every replay audited. One selected game is shown above.',
    trained(0, 100, 97),
    `${doom.date}: 100 held-out starts of ViZDoom 1.3.0’s unmodified Deadly Corridor scenario, difficulty 5, with a 2,100-tic limit. Success means collecting the armor and reaching the map’s exit. Trained Zils: ${o.zils.success} successes, ${o.zils.timeout} timeouts, ${o.zils.death} death. JEV: ${o.jev.death} deaths and ${o.jev.technical_failure} technical failure, counted separately. The untrained H2O base died in all 100. The scripted reference program Zils learned from succeeded in all 100.`,
    'Training, development and test seed lists were disjoint, but the map is shared, so this measures robustness to the scenario’s randomness, not play on unseen levels. The structured observations and custom action interface make it different from standard pixel-based ViZDoom scores.',
    `The paired success difference is +${doom.pairedDifference.points} points, with a descriptive 95% seed-bootstrap interval of ${doom.pairedDifference.bootstrap95[0]} to ${doom.pairedDifference.bootstrap95[1]} points; Zils’s Wilson 95% interval is ${w[0]}% to ${w[1]}%. The native replay audit verified ${doom.audit.replaysVerified} completed episodes and matched starting frames for all ${doom.audit.matchedStarts} seeds. JEV’s one technical failure, seed ${doom.interruptedSeed}, was an operator-interrupted episode and is not counted as a death.`,
  ],
  content: [
    'Correct means it matched Bitcast’s automated label. Reused development posts.',
    trained(116, 155, 139),
    '486 training posts, 159 calibration posts and 155 development posts, with campaign groups kept separate. Reference labels came from Qwen3-32B and can be wrong. This pilot used an 80% campaign-relevance rule; the development set had been used before. Private holdout testing and human review remain needed. Zils minus JEV: +4.52 percentage points, descriptive 95% interval +0.72 to +8.97. JEV verdicts were supplied, with no exact model version or fresh API run.',
  ],
  chess: [
    'Correct means it picked a checkmate among the legal checks. A narrow puzzle task, not full-game strength.',
    trained(220, 512, 260),
    '2,048 training positions and 512 test positions from separate source games. One chess adapter, one training seed. All legal checking moves were offered; any immediate mate received credit. Full-game strength was not tested. An exact chess-rules engine solves 100% of these positions.',
  ],
  inbox: [
    'Correct means it matched the supplied intent label. Reused synthetic test; all 15 opt-outs recognized, one false opt-out.',
    trained(86, 100, 93),
    '294 authored training examples, 60 separate calibration cases, and 100 synthetic reserve replies. This set had been evaluated before. Zils scored 93/100 on all three passes. JEV and Luna results were supplied; JEV scored three cases higher. Zils’s seven errors all had high confidence. The dataset’s labels have not been independently reviewed.',
  ],
  oro: [
    'Correct means it matched the pilot’s label. 60 message/rule pairs with three correlated decisions each; no shopping sessions were run.',
    'Zils was trained on 720 synthetic disclosure decisions. An untrained baseline was not measured.',
    'October 13, 2026 pilot: 720 authored training decisions (30 templates × 8 attribute types × 3 questions), 60 calibration decisions, and 180 held-out decisions. Training and test template strings and attribute types were separate; semantic categories were shared. Labels were AI-authored and agent-reviewed, not independently human-labeled.',
    'The test contains 60 message/rule pairs across 30 templates and two attributes: pattern and power rating. These are correlated decisions, not 180 independent shopping tasks. At a 50% decision threshold, Zils matched 180/180 labels and JEV 173/180. At ORO’s 70% disclosure threshold, derived actions matched 60/60 versus 58/60. JEV’s two false disclosures came from the same quoted-message template.',
    'Zils: H2O Lightning 4B v1.2.3 with one task adapter. JEV: a fresh call to TypeSafe’s direct API, version 1.13.0. ORO uses an OpenRouter route; exact serving equivalence was not established. No untrained H2O baseline was measured. The descriptive 95% interval for the accuracy difference includes zero (0 to +9.44 percentage points).',
    `This isolates the first-turn disclosure decision. We did not run full shopping sessions or Mistral shopper replies, measure shopping success, or establish a speed or cost advantage. View the pinned ORO source${'.'}`,
  ],
};
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
for (const [hash, paragraphs] of Object.entries(study)) {
  test(`#${hash} Full test details holds the complete study text`, async ({ page }) => {
    await page.goto(`/examples#${hash}`);
    await page.getByText('Full test details', { exact: true }).click();
    const full = page.locator('details').filter({ has: page.getByText('Full test details', { exact: true }) }).last();
    const texts = (await full.locator('p').allInnerTexts()).map(norm);
    for (const expected of [...paragraphs, closing]) expect(texts, expected.slice(0, 50)).toContain(expected);
  });
}
test('doom evidence links keep their targets', async ({ page }) => {
  await page.goto('/examples#doom');
  await page.getByText('Full test details', { exact: true }).click();
  for (const [name, href] of [['Full benchmark report', e.report], ['All 100 starts (CSV)', e.seeds], ['Results (JSON)', e.results]]) await expect(page.getByRole('link', { name })).toHaveAttribute('href', href);
});

test('post, chess, inbox and Oro announce outcomes in polite status regions', async ({ page }) => {
  const status = page.getByRole('status');
  await page.goto('/examples#content');
  await page.getByRole('button', { name: /Another post/ }).click();
  await expect(status).toContainText('Post 2 of 5.');
  await page.goto('/examples#chess');
  await page.locator('[data-choice="zils"]').click();
  await expect(status).toHaveText('Zils: Checkmate');
  await page.locator('[data-choice="jev"]').click();
  await expect(status).toHaveText('JEV: Check, not mate');
  await page.goto('/examples#inbox');
  await page.getByRole('button', { name: 'Sort with Zils' }).click();
  await expect(status).toHaveText(/^Reply \d: /);
  await expect(status).toHaveText(`Reply 5: ${recorded.replies[4].intent.replace(/_/g, ' ')}`, { timeout: 5000 });
  await page.goto('/examples#oro');
  await expect(status).toHaveText('Zils: Wait · right; JEV: Answer · wrong');
});

test('examples fit a phone with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const hash of ['doom', 'content', 'chess', 'inbox', 'oro']) {
    await page.goto(`/examples#${hash}`);
    await page.getByText('Full test details', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), hash).toBe(true);
  }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { minerDashboardSchema, explain, bodyNumbers, weakestCategory, seatHistory, jobTotals } = require('../.private/test-build/miner-dashboard.js');

const sha = c => c.repeat(64);
// GET /v1/network/miner/dashboard (zils-platform miner_dashboard.view); report entries are zils/soup_report.build's.
const seated = { body_sha256: sha('b'), stage: 'seated', reason: null, rate: 1, screen: { score: 71, needed: 68.5 }, solo: { score: 70.5, soup: 72 }, categories: { reasoning: { score: 70, soup: 72 }, arts: { score: 66, soup: 71.5 } }, seat: { contribution: 1.5, floor: 0.8 } };
const missed = { body_sha256: sha('c'), stage: 'not_selected', reason: 'no_soup_gain', solo: { score: 69, soup: 72 }, trial: { gain: 0, needed: 0.5 } };
const valid = () => structuredClone({
  hotkey: '5Miner', expires_at: '2026-11-13T15:00:00.123456Z',
  report: { pools: { 'd3-mini': { round_id: 'd3-mini-2026-11-11', bodies: [seated, missed] }, 'd3-lite': { round_id: null, bodies: [] } } },
  jobs: [
    { created_at: '2026-11-10T02:00:00+00:00', track: 'text', state: 'submitted', status: 'completed', evaluated: true, skill: 0.4, selected: true },
    { created_at: '2026-11-09T02:00:00+00:00', track: 'text', state: 'submitted', status: 'completed', evaluated: true, skill: 0.1, selected: false },
    { created_at: '2026-11-08T02:00:00+00:00', track: 'image', state: 'failed', status: 'failed', evaluated: false, skill: null, selected: false },
    { created_at: null, track: 'text', state: 'leased', status: 'running', evaluated: false, skill: null, selected: false },
  ],
});

test('the dashboard payload is accepted and anything extra or malformed is refused', () => {
  assert.equal(minerDashboardSchema.safeParse(valid()).success, true);
  for (const change of [
    v => { v.owner_id = 'secret'; },
    v => { v.jobs[0].job_id = 'j1'; },
    v => { v.report.pools['d3-mini'].bodies[0].copy_distance = 0.1; },
    v => { v.report.pools['d3-mini'].bodies[0].stage = 'winner'; },
    v => { v.report.pools['d3-mini'].bodies[0].body_sha256 = 'x'; },
    v => { delete v.hotkey; },
  ]) { const v = valid(); change(v); assert.equal(minerDashboardSchema.safeParse(v).success, false); }
  // A refused commitment the validator could not read has no body hash.
  const v = valid(); v.report.pools['d3-mini'].bodies.push({ body_sha256: null, stage: 'refused', reason: 'bad_commitment' });
  assert.equal(minerDashboardSchema.safeParse(v).success, true);
});

test('a reason code reads as what happened and what to do next', () => {
  assert.deepEqual(explain(null), ['Your body is in the soup and its seat pays.', null]);
  const [what, next] = explain('no_soup_gain');
  assert.match(what, /did not raise the soup/);
  assert.match(next, /where the soup is weak/);
  // A code this page does not know is shown, never guessed at.
  assert.deepEqual(explain('brand_new_code'), ['Reason code: brand_new_code.', null]);
});

test('a body’s numbers sit next to the bars they are measured against', () => {
  assert.deepEqual(bodyNumbers(seated), [
    { label: 'Contribution', value: '1.5', bar: 'floor 0.8' },
    { label: 'Alone', value: '70.5', bar: 'soup 72' },
    { label: 'Screening', value: '71', bar: 'needed 68.5' },
  ]);
  assert.deepEqual(bodyNumbers(missed), [
    { label: 'Soup gain', value: '+0', bar: 'needed +0.5' },
    { label: 'Alone', value: '69', bar: 'soup 72' },
  ]);
  assert.deepEqual(bodyNumbers({ ...seated, rate: 0.25, gate: { base: 'house', needed: 1 } }).filter(n => ['Base', 'Rate'].includes(n.label)), [
    { label: 'Base', value: 'house', bar: 'must beat it by 1' },
    { label: 'Rate', value: '0.25', bar: '' },
  ]);
  assert.deepEqual(bodyNumbers({ body_sha256: null, stage: 'refused', reason: 'bad_commitment' }), []);
});

test('the category furthest behind the soup is named only when it is alone in last place', () => {
  assert.equal(weakestCategory(seated.categories), 'arts');
  assert.equal(weakestCategory({ reasoning: { score: 70, soup: 72 }, arts: { score: 69.5, soup: 71.5 } }), null);
  assert.equal(weakestCategory({ reasoning: { score: 73, soup: 72 } }), null);
  assert.equal(weakestCategory(undefined), null);
});

// The public soup feed's rounds (lib/soup-board.ts), newest first.
const member = (hotkey, c, seat_weight, contribution = 1) => ({ hotkey, body_sha256: sha(c), rate: 1, seat_weight, contribution });
const round = (id, members, crown = null) => ({ round_id: id, pool_id: id.slice(0, -11), finished_at: `${id.slice(-10)}T03:40:00Z`, members, crown });
const board = { tiers: [
  { pool: 'd3-mini', tier: 'z3-mini', rounds: [
    round('d3-mini-2026-11-11', [member(null, 'a', 0, 3), member('5Miner', 'b', 0.04, 1.5)], { hotkey: '5Miner', body_sha256: sha('b'), rate: 1, weight: 0.05 }),
    round('d3-mini-2026-11-10', [member('5Miner', 'b', 0, 0.5), member('5Other', 'd', 0.04)]),
    round('d3-mini-2026-11-09', [member('5Other', 'd', 0.04)]),
  ] },
  { pool: 'd3-lite', tier: 'z3-lite', rounds: [round('d3-lite-2026-11-11', [member('5Miner', 'e', 0.04, 2)])] },
] };

test('seat history lists the rounds a hotkey sat in, newest first, with what each paid', () => {
  const history = seatHistory(board, '5Miner');
  assert.deepEqual(history.rows.map(r => [r.day, r.tier, r.seat, r.contribution, r.share]), [
    ['2026-11-11', 'z3-lite', 'seat', 2, 0.04],
    ['2026-11-11', 'z3-mini', 'crown', 1.5, 0.09],
    ['2026-11-10', 'z3-mini', 'unpaid', 0.5, 0],
  ]);
  assert.equal(history.rows[0].body, sha('e'));
  assert.deepEqual([history.rounds, history.paid], [3, 2]);
  assert.deepEqual(seatHistory(board, '5Nobody'), { rows: [], rounds: 0, paid: 0 });
  assert.deepEqual(seatHistory(null, '5Miner'), { rows: [], rounds: 0, paid: 0 });
});

test('job totals count what was assigned, graded and delivered, with the median skill', () => {
  assert.deepEqual(jobTotals(valid().jobs), { assigned: 4, submitted: 2, evaluated: 2, selected: 1, medianSkill: 0.25 });
  assert.deepEqual(jobTotals([]), { assigned: 0, submitted: 0, evaluated: 0, selected: 0, medianSkill: null });
});

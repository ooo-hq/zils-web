const { test } = require('node:test');
const assert = require('node:assert/strict');
const { soupBoardSchema, soupBoard, soupScore, tierView, bodyLabel } = require('../.private/test-build/soup-board.js');

// One round's record as zils/soup_publish.public_record writes it, plus the feed's finished_at.
const round = (id, scores, members, crown = null, finished = '2026-11-04T03:40:00Z') => ({
  round_id: id, pool_id: 'd3-mini', seed: 'ab'.repeat(32), finished_at: finished,
  members, crown, category_scores: scores,
  soup_sha256: 'c'.repeat(64), subset_sha256: 'd'.repeat(64), predictions_sha256: 'e'.repeat(64),
});
const member = (hotkey, sha, rate, contribution, seat_weight) => ({ hotkey, body_sha256: sha.repeat(64), rate, contribution, seat_weight });
const scores = v => ({ reasoning: v, language: v, retrieval: v, tools: v, arts: v });
const valid = () => ({
  as_of: new Date().toISOString(),
  tiers: [{
    pool: 'd3-mini', tier: 'z3-mini',
    serving: { release: 'z3-mini v1', served_by: 'zils' },
    bodies: { ['a'.repeat(64)]: { house: 'pplx-decider-flash-v1.2', repo: 'perplexity-ai/pplx-decider-flash-v1.2' }, ['b'.repeat(64)]: { house: null, repo: 'miner/body-one' } },
    rounds: [
      round('2026-11-04', scores(71.4), [member('5House', 'a', 0, 2.5, 0), member('5Miner', 'b', 1, 1, 0.4)]),
      round('2026-11-03', scores(70.8), [member('5House', 'a', 0, 3, 0)], null, '2026-11-03T03:41:00Z'),
    ],
  }],
});

test('the feed accepts public round records and rejects anything that could leak or mislead', () => {
  assert.equal(soupBoardSchema.safeParse(valid()).success, true);
  const pooled = valid(); pooled.tiers[0].rounds[0].decision = { rounds: ['mini-2026-11-02', 'mini-2026-11-03', 'mini-2026-11-04'], items: 9000 };
  assert.equal(soupBoardSchema.safeParse(pooled).success, true);   // zils#150: decision is the pooled rounds' ids and the item count
  const calibrated = valid(); Object.assign(calibrated.tiers[0].rounds[0], { scoring: 'calibrated_brier', temperature: 1.25 });
  assert.equal(soupBoardSchema.safeParse(calibrated).success, true); // zils#162 publishes the scoring and the soup's fitted temperature
  const bad = [
    v => { v.tiers[0].rounds[0].category_scores.secret_family = 50; },        // only the five published categories
    v => { v.tiers[0].rounds[0].members[0].rate = 0.5; },                      // rates are 0, 0.25 or 1
    v => { v.tiers[0].rounds[0].members[0].body_sha256 = 'not-a-hash'; },
    v => { v.tiers[0].rounds[0].items = ['exam item']; },                       // no extra fields
    v => { v.tiers[0].bodies['b'.repeat(64)].repo = 'https://evil.example'; },
    v => { v.tiers[0].rounds[0].members = Array(6).fill(v.tiers[0].rounds[0].members[0]); }, // at most five seats
    v => { v.tiers[0].rounds[0].decision = { rounds: Array.from({ length: 8 }, (_, i) => `r${i}`), items: 9000 }; }, // decision_rounds is 1 to 7
    v => { v.tiers[0].rounds[0].decision = { rounds: 3, items: 9000 }; },     // ids, not a bare count
    v => { v.tiers[0].rounds[0].decision = { rounds: ['r1'], items: 9000, ids: ['x'] }; }, // never item ids
    v => { Object.assign(v.tiers[0].rounds[0], { scoring: 'secret', temperature: 1 }); },       // a known scoring only
    v => { Object.assign(v.tiers[0].rounds[0], { scoring: 'calibrated_brier', temperature: 0 }); }, // grid is 0.1 to 10
    v => { Object.assign(v.tiers[0].rounds[0], { scoring: 'calibrated_brier', temperature: 11 }); },
  ];
  for (const change of bad) { const v = valid(); change(v); assert.equal(soupBoardSchema.safeParse(v).success, false); }
});

test('the soup score weights categories as zils base_metrics does', () => {
  assert.equal(soupScore(scores(70)), 70);
  assert.equal(soupScore({ reasoning: 80, language: 60, retrieval: 70, tools: 50, arts: 90 }), 68.3);
});

test('a tier view gives tonight, the change since last night, seats with names, and history oldest first', () => {
  const view = tierView(valid().tiers[0]);
  assert.equal(view.tonight.score, 71.4);
  assert.equal(view.change, 0.6);
  assert.deepEqual(view.seats.map(s => [s.name, s.kind, s.contribution]), [['pplx-decider-flash-v1.2', 'house', 2.5], ['miner/body-one', 'trainer', 1]]);
  assert.equal(view.crown, null);
  assert.deepEqual(view.history, [70.8, 71.4]);
  assert.equal(view.decision, null);
  const pooled = valid(); pooled.tiers[0].rounds[0].decision = { rounds: ['a', 'b', 'c'], items: 9000 };
  assert.deepEqual(tierView(pooled.tiers[0]).decision, { rounds: 3, items: 9000 });
});

test('a body with no known repo is named by its hotkey and hash, never invented', () => {
  assert.equal(bodyLabel({ hotkey: '5FxkAbcdefghij', body_sha256: '3c1e'.padEnd(64, '0') }, {}), '5Fxk… · 3c1e0000');
});

test('outages, stale feeds and empty tiers never render as a live soup', async () => {
  const fetch = global.fetch, env = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL;
  process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = 'https://training.example.com';
  try {
    let value = valid();
    global.fetch = async () => ({ ok: true, json: async () => value });
    assert.equal((await soupBoard()).tiers.length, 1);
    value = { ...valid(), as_of: '2020-01-01T00:00:00Z' };
    assert.equal(await soupBoard(), null);
    value = { ...valid(), tiers: [{ ...valid().tiers[0], rounds: [] }] };
    assert.equal((await soupBoard()).tiers.length, 1); // a tier before its first round still shows, as waiting
    global.fetch = async () => ({ ok: false, json: async () => ({}) });
    assert.equal(await soupBoard(), null);
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal(await soupBoard(), null);
  } finally {
    global.fetch = fetch;
    if (env === undefined) delete process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL; else process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = env;
  }
});

test('a tier that Zils does not serve yet, or that has not cooked, is still a valid tier', () => {
  const v = valid(); v.tiers[0].serving = null; v.tiers[0].rounds = [];
  assert.equal(soupBoardSchema.safeParse(v).success, true);
  const view = tierView(v.tiers[0]);
  assert.equal(view.tonight, null);
  assert.deepEqual(view.seats, []);
  assert.deepEqual(view.history, []);
  assert.equal(view.serving, null);
});

test('house seats have no hotkey, and the feed still renders (live feed, 2 Nov 2026)', () => {
  const v = valid();
  v.tiers[0].rounds[0].members[0].hotkey = null;              // house bodies are seated with hotkey null
  v.tiers[0].rounds[1].members[0].hotkey = null;
  v.tiers[0].rounds[0].members.push(member(null, 'f', 0, 0.5, 0)); // a house body missing from the bodies map
  assert.equal(soupBoardSchema.safeParse(v).success, true);
  const view = tierView(v.tiers[0]);
  assert.deepEqual(view.seats.map(s => [s.name, s.maker, s.kind]), [
    ['pplx-decider-flash-v1.2', 'perplexity-ai', 'house'],
    ['miner/body-one', '5Miner', 'trainer'],
    ['house · ffffffff', 'house', 'house'],
  ]);
  const crowned = valid(); crowned.tiers[0].rounds[0].crown = { hotkey: null, body_sha256: 'a'.repeat(64), rate: 0, weight: 0 };
  assert.equal(soupBoardSchema.safeParse(crowned).success, true);
  assert.equal(tierView(crowned.tiers[0]).crown.name, 'pplx-decider-flash-v1.2');
});

test('seats say who made each body and which one holds the crown', () => {
  const v = valid();
  v.tiers[0].rounds[0].crown = { hotkey: '5Miner', body_sha256: 'b'.repeat(64), rate: 1, weight: 0.2 };
  const view = tierView(v.tiers[0]);
  assert.deepEqual(view.seats.map(s => [s.maker, s.crowned]), [['perplexity-ai', false], ['5Miner', true]]);
});

test('a change of scoring is not a change in the soup: compare and plot only rounds scored the same way', () => {
  // Live feed, 2 Nov 2026: the first calibrated_brier round (61.7) followed argmax-era rounds (74.6, 74.0).
  const v = valid();
  v.tiers[0].rounds = [
    round('2026-11-05', scores(61.7), []), round('2026-11-04', scores(74.6), []), round('2026-11-03', scores(74.0), []),
  ];
  Object.assign(v.tiers[0].rounds[0], { scoring: 'calibrated_brier', temperature: 1.36 });
  let view = tierView(v.tiers[0]);
  assert.equal(view.change, null);                 // no "−12.9 since the last round"
  assert.deepEqual(view.history, [61.7]);          // the old method's rounds stay off the line
  Object.assign(v.tiers[0].rounds[1], { scoring: 'calibrated_brier', temperature: 1.2 });
  view = tierView(v.tiers[0]);
  assert.equal(view.change, -12.9);                // same method: a real change
  assert.deepEqual(view.history, [74.6, 61.7]);
  v.tiers[0].rounds[1].scoring = 'argmax';         // an explicit argmax matches a record with no scoring field
  assert.deepEqual(tierView(v.tiers[0]).history, [61.7]);
  v.tiers[0].rounds[0].scoring = 'argmax';
  assert.deepEqual(tierView(v.tiers[0]).history, [74.0, 74.6, 61.7]);
});

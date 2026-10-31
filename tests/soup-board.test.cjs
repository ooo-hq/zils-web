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
  const bad = [
    v => { v.tiers[0].rounds[0].category_scores.secret_family = 50; },        // only the five published categories
    v => { v.tiers[0].rounds[0].members[0].rate = 0.5; },                      // rates are 0, 0.25 or 1
    v => { v.tiers[0].rounds[0].members[0].body_sha256 = 'not-a-hash'; },
    v => { v.tiers[0].rounds[0].items = ['exam item']; },                       // no extra fields
    v => { v.tiers[0].bodies['b'.repeat(64)].repo = 'https://evil.example'; },
    v => { v.tiers[0].rounds[0].members = Array(6).fill(v.tiers[0].rounds[0].members[0]); }, // at most five seats
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
    assert.equal((await soupBoard()).tiers.length, 0);
    global.fetch = async () => ({ ok: false, json: async () => ({}) });
    assert.equal(await soupBoard(), null);
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal(await soupBoard(), null);
  } finally {
    global.fetch = fetch;
    if (env === undefined) delete process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL; else process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = env;
  }
});

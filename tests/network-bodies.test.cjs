const { test } = require('node:test');
const assert = require('node:assert/strict');
const { networkBodiesSchema, networkBodies, minerRows } = require('../.private/test-build/network-bodies.js');

// GET /v1/network/bodies (zils-platform, ZIL-109): every uid with a soup body commitment or a serving endpoint.
const body = (pool, sha, repo = 'owner/body') => ({ pool, sha256: sha.repeat(64), revision: 'f'.repeat(40), repo, block: 8300000 });
const valid = () => ({
  network: 'finney', netuid: 127, block: 8351998, as_of: new Date().toISOString(),
  miners: [
    { uid: 1, hotkey: '5Seated', body: body('d3-mini', 'b'), serving: true },
    { uid: 5, hotkey: '5Outside', body: body('d3-mini', 'c'), serving: false },
    { uid: 7, hotkey: '5Lite', body: body('d3-lite', 'd'), serving: false },
    { uid: 9, hotkey: '5ServeOnly', body: null, serving: true },
  ],
});
const round = (members, crown = null) => ({ members, crown });
const soup = {
  tiers: [
    { pool: 'd3-mini', tier: 'z3-mini', rounds: [round([
      { hotkey: '5House', body_sha256: 'a'.repeat(64), rate: 0, seat_weight: 0, contribution: 2 },
      { hotkey: '5Seated', body_sha256: 'b'.repeat(64), rate: 1, seat_weight: 0.16, contribution: 1 },
    ], { hotkey: '5Seated', body_sha256: 'b'.repeat(64), rate: 1, weight: 0.2 })] },
    { pool: 'd3-lite', tier: 'z3-lite', rounds: [] },
  ],
};

test('the bodies feed accepts chain rows and refuses anything malformed', () => {
  assert.equal(networkBodiesSchema.safeParse(valid()).success, true);
  for (const change of [
    v => { v.miners[0].body.repo = 'https://evil.example'; },
    v => { v.miners[0].body.revision = 'main'; },
    v => { v.miners[0].body.pool = 'secret-pool'; },
    v => { v.miners[0].endpoint = '1.2.3.4:8000'; },  // no extra fields, so no addresses leak through
  ]) { const v = valid(); change(v); assert.equal(networkBodiesSchema.safeParse(v).success, false); }
});

test('each miner row says its tier and where its body stands in tonight’s soup', () => {
  const rows = minerRows(valid(), soup);
  assert.deepEqual(rows.map(r => [r.uid, r.tier, r.standing, r.serving]), [
    [1, 'z3-mini', 'crown', true],
    [5, 'z3-mini', 'out', false],
    [7, 'z3-lite', 'waiting', false],
    [9, null, 'none', true],
  ]);
});

test('without a soup feed, rows still show chain facts but claim no standing', () => {
  assert.deepEqual(minerRows(valid(), null).map(r => r.standing), ['unknown', 'unknown', 'unknown', 'none']);
});

test('stale snapshots and outages never render as a current chain view', async () => {
  const fetch = global.fetch, env = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL;
  process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = 'https://training.example.com';
  try {
    let value = valid();
    global.fetch = async () => ({ ok: true, json: async () => value });
    assert.equal((await networkBodies()).miners.length, 4);
    value = { ...valid(), as_of: '2020-01-01T00:00:00Z' };
    assert.equal(await networkBodies(), null);
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal(await networkBodies(), null);
  } finally {
    global.fetch = fetch;
    if (env === undefined) delete process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL; else process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = env;
  }
});

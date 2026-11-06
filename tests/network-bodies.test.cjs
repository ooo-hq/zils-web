const { test } = require('node:test');
const assert = require('node:assert/strict');
const { networkBodiesSchema, networkBodies, minerRows, tierQueue, clockTime, roundProgress, minerPage, minerSort, sortHref, nextRound, reasonLabel, MINERS_PER_PAGE } = require('../.private/test-build/network-bodies.js');

// GET /v1/network/bodies (zils-platform, ZIL-109): every uid with a soup body commitment or a serving endpoint.
const body = (pool, sha, repo = 'owner/body') => ({ pool, sha256: sha.repeat(64), revision: 'f'.repeat(40), repo, block: 8300000 });
const valid = () => ({
  network: 'test', netuid: 579, block: 8351998, as_of: new Date().toISOString(),
  miners: [
    { uid: 1, hotkey: '5Seated', body: body('d3-mini', 'b'), serving: true },
    { uid: 5, hotkey: '5Outside', body: body('d3-mini', 'c'), serving: false },
    { uid: 7, hotkey: '5Lite', body: body('d3-lite', 'd'), serving: false },
    { uid: 9, hotkey: '5ServeOnly', body: null, serving: true },
  ],
});
const round = (members, crown = null, round_id = 'd3-mini-2026-11-04', finished_at = '2026-11-04T02:34:00Z') => ({ round_id, pool_id: round_id.slice(0, -11), finished_at, members, crown });
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

test('a body committed after its pool’s deadline is pending, not out', () => {
  // Mainnet 4 Nov 2026. The lite deadline is 06:00 UTC: round d3-lite-2026-11-04 froze bodies at seed block
  // 9,430,695; the chain head was 9,433,301 at 14:43 UTC. uid 61 committed at 9,429,788 (03:00 UTC, before the
  // lite deadline but after mini's 00:00) and was graded; uid 90 committed at 9,431,812 (about 10:00 UTC) and
  // waits for the next round. Both are absent from the soup.
  const chain = { ...valid(), block: 9433301, as_of: '2026-11-04T14:43:09Z', miners: [
    { uid: 61, hotkey: '5Early', body: { ...body('d3-lite', 'e'), block: 9429788 }, serving: false },
    { uid: 90, hotkey: '5Late', body: { ...body('d3-lite', 'f'), block: 9431812 }, serving: false },
    { uid: 91, hotkey: '5Edge', body: { ...body('d3-lite', 'g'), block: 9430800 }, serving: false },  // ~20 min after: too close to call
  ] };
  const lite = { tiers: [{ pool: 'd3-lite', tier: 'z3-lite', rounds: [round([
    { hotkey: null, body_sha256: 'a'.repeat(64), rate: 0, seat_weight: 0, contribution: 2 },
  ], null, 'd3-lite-2026-11-04', '2026-11-04T20:30:00Z')] }] };
  assert.deepEqual(minerRows(chain, lite).map(r => [r.uid, r.standing]), [[61, 'out'], [90, 'pending'], [91, 'out']]);
  // The same commit block is after mini's 00:00 deadline.
  const mini = { tiers: [{ pool: 'd3-mini', tier: 'z3-mini', rounds: [round([], null, 'd3-mini-2026-11-04')] }] };
  const asMini = { ...chain, miners: [{ uid: 61, hotkey: '5Early', body: { ...body('d3-mini', 'e'), block: 9429788 }, serving: false }] };
  assert.deepEqual(minerRows(asMini, mini).map(r => r.standing), ['pending']);
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

// The countdown on each tier card: the last deadline, whether that round is still to be published, and the next one.
test('after the mini deadline and before its round is published, the tier is grading', () => {
  const now = Date.parse('2026-11-05T00:50:00Z');
  assert.deepEqual(tierQueue('d3-mini', [], now, 'd3-mini-2026-11-04'), {
    waiting: 0, froze: '2026-11-05T00:00:00.000Z', grading: true, freezes: '2026-11-06T00:00:00.000Z',
  });
  // Once tonight's round is in the feed, the card goes back to counting down.
  assert.equal(tierQueue('d3-mini', [], now, 'd3-mini-2026-11-05').grading, false);
});

test('before the deadline the latest round is from yesterday and nothing is grading', () => {
  const now = Date.parse('2026-11-04T23:00:00Z');
  assert.deepEqual(tierQueue('d3-mini', [], now, 'd3-mini-2026-11-04'), {
    waiting: 0, froze: '2026-11-04T00:00:00.000Z', grading: false, freezes: '2026-11-05T00:00:00.000Z',
  });
});

test('lite counts to its own 06:00 deadline', () => {
  const before = tierQueue('d3-lite', [], Date.parse('2026-11-05T05:59:00Z'), 'd3-lite-2026-11-04');
  assert.equal(before.freezes, '2026-11-05T06:00:00.000Z');
  assert.equal(before.grading, false);
  const after = tierQueue('d3-lite', [], Date.parse('2026-11-05T06:01:00Z'), 'd3-lite-2026-11-04');
  assert.equal(after.freezes, '2026-11-06T06:00:00.000Z');
  assert.equal(after.grading, true);
});

test('a tier with no round yet or no deadline never claims to be grading', () => {
  assert.equal(tierQueue('d3-mini', [], Date.parse('2026-11-05T00:50:00Z')).grading, false);
  assert.deepEqual(tierQueue('d3-unknown', [], Date.parse('2026-11-05T00:50:00Z'), 'd3-unknown-2026-11-04'), {
    waiting: 0, froze: null, grading: false, freezes: null,
  });
});

test('the round clock reads hh:mm:ss and fills from one deadline to the next', () => {
  assert.equal(clockTime(22 * 3_600_000 + 54 * 60_000 + 8_000), '22:54:08');
  assert.equal(clockTime(65_000), '0:01:05');
  assert.equal(clockTime(-1), '0:00:00');
  const froze = '2026-11-05T00:00:00.000Z', freezes = '2026-11-06T00:00:00.000Z';
  assert.equal(roundProgress(froze, freezes, Date.parse('2026-11-05T06:00:00Z')), 0.25);
  assert.equal(roundProgress(froze, freezes, Date.parse('2026-11-04T23:00:00Z')), 0);
  assert.equal(roundProgress(froze, freezes, Date.parse('2026-11-06T01:00:00Z')), 1);
});

test('while a tier’s round runs, each claim says where its check stands', () => {
  const running = structuredClone(soup);
  running.tiers[0].live = { round_id: 'd3-mini-2026-11-05', stage: 'intake', running: true, claims: [
    { uid: 1, state: 'in_pool' }, { uid: 5, state: 'checking' },
  ] };
  const rows = Object.fromEntries(minerRows(valid(), running).map(r => [r.uid, r.standing]));
  assert.equal(rows[5], 'checking');
  assert.equal(rows[1], 'crown');      // already in the pool: last night's standing until the round lands
  assert.equal(rows[7], 'waiting');    // lite has no live round
  for (const [state, standing] of [['admitted', 'checked'], ['waiting', 'queued'], ['deferred', 'deferred'], ['refused', 'refused']]) {
    running.tiers[0].live.claims[1].state = state;
    assert.equal(minerRows(valid(), running).find(r => r.uid === 5).standing, standing);
  }
});

// /miners shows the chain table 25 rows at a time, tonight's soup first.
const row = (uid, standing) => ({ uid, standing });

test('the soup comes first: crown, paid seats, unpaid seats, then everyone else by uid', () => {
  const rows = [row(9, 'out'), row(3, 'seat'), row(7, 'crown'), row(1, 'none'), row(5, 'unpaid'), row(2, 'seat')];
  assert.deepEqual(minerPage(rows, undefined).rows.map(r => r.uid), [7, 2, 3, 5, 1, 9]);
});

test('pages are 25 rows, numbered from 1, and say which rows they show', () => {
  assert.equal(MINERS_PER_PAGE, 25);
  const rows = Array.from({ length: 80 }, (_, i) => row(i + 1, 'out'));
  const first = minerPage(rows, undefined);
  assert.deepEqual({ page: first.page, pages: first.pages, total: first.total, from: first.from, to: first.to },
    { page: 1, pages: 4, total: 80, from: 1, to: 25 });
  const last = minerPage(rows, '4');
  assert.deepEqual([last.from, last.to, last.rows.length], [76, 80, 5]);
});

test('a page out of range or not a number shows the nearest real page', () => {
  const rows = Array.from({ length: 30 }, (_, i) => row(i + 1, 'out'));
  for (const [asked, page] of [['99', 2], ['0', 1], ['-3', 1], ['abc', 1], [['2', '3'], 2], [undefined, 1]]) {
    assert.equal(minerPage(rows, asked).page, page, String(asked));
  }
  assert.deepEqual(minerPage([], '2'), { rows: [], page: 1, pages: 1, total: 0, from: 0, to: 0 });
});

// Between rounds, the tier's `intake` (zils soup_publish.intake) says which bodies the validator has graded and
// why last round passed some over. Ungraded bodies line up in commitment order: block, then hotkey, then uid.
test('ungraded bodies line up by commit block against the next round’s limit', () => {
  const sha = c => c.repeat(64);
  const chain = { network: 'finney', netuid: 127, block: 9448539, as_of: new Date().toISOString(), miners: [
    { uid: 64, hotkey: '5B', body: { ...body('d3-lite', '1'), block: 9442157 }, serving: false },
    { uid: 193, hotkey: '5A', body: { ...body('d3-lite', '2'), block: 9442402 }, serving: false },
    { uid: 72, hotkey: '5C', body: { ...body('d3-lite', '3'), block: 9444901 }, serving: false },
    { uid: 150, hotkey: '5D', body: { ...body('d3-lite', '4'), block: 9442402 }, serving: false },
    { uid: 80, hotkey: '5E', body: { ...body('d3-lite', '5'), block: 9428404 }, serving: false },
    { uid: 165, hotkey: '5F', body: { ...body('d3-lite', '6'), block: 9438537 }, serving: false },
    { uid: 9, hotkey: '5G', body: { ...body('d3-lite', '7'), block: 9440000 }, serving: false },
  ] };
  const lite = { tiers: [{ pool: 'd3-lite', tier: 'z3-lite', rounds: [round([], null, 'd3-lite-2026-11-06')], intake: {
    round_id: 'd3-lite-2026-11-06', max_new_per_round: 2, graded: [sha('5')], rejected: [sha('7')],
    claims: [
      { uid: 193, sha256: sha('2'), state: 'deferred', reason: 'the round’s new-body cap is reached; retried next round' },
      { uid: 165, sha256: sha('6'), state: 'refused', reason: null },
      { uid: 72, sha256: sha('9'), state: 'refused', reason: null },  // an older body: uid 72 has recommitted since
    ],
  } }] };
  const rows = Object.fromEntries(minerRows(chain, lite).map(r => [r.uid, r]));
  assert.equal(rows[80].standing, 'out');            // graded: last night's standing as before
  assert.equal(rows[165].standing, 'refused');
  assert.equal(rows[9].standing, 'refused');         // its hash was rejected
  assert.deepEqual([64, 193, 150, 72].map(u => [rows[u].standing, rows[u].line]), [
    ['in_line', { position: 1, limit: 2, next: true, reason: null }],
    ['in_line', { position: 2, limit: 2, next: true, reason: 'the round’s new-body cap is reached' }],
    ['in_line', { position: 3, limit: 2, next: false, reason: null }],  // same block as 193: hotkey 5D sorts after 5A
    ['in_line', { position: 4, limit: 2, next: false, reason: null }],
  ]);
  assert.equal(rows[80].line, null);
});

test('a running round’s state still wins over the line', () => {
  const chain = valid();
  const tiers = structuredClone(soup);
  tiers.tiers[0].intake = { round_id: 'd3-mini-2026-11-04', max_new_per_round: 6, graded: [], rejected: [], claims: [] };
  assert.equal(minerRows(chain, tiers).find(r => r.uid === 5).standing, 'in_line');
  tiers.tiers[0].live = { round_id: 'd3-mini-2026-11-05', stage: 'intake', running: true, claims: [{ uid: 5, state: 'checking' }] };
  assert.equal(minerRows(chain, tiers).find(r => r.uid === 5).standing, 'checking');
});

test('bodies in line count as waiting on the tier card', () => {
  assert.equal(tierQueue('d3-lite', [{ body: { pool: 'd3-lite' }, standing: 'in_line' }], Date.parse('2026-11-06T12:00:00Z')).waiting, 1);
});

test('after the soup, bodies in line come next in their tier’s line order, lite before mini', () => {
  const inLine = (uid, tier, position) => ({ uid, standing: 'in_line', tier, line: { position, limit: 12, next: true, reason: null } });
  const rows = [row(9, 'out'), inLine(193, 'z3-lite', 2), row(7, 'crown'), inLine(64, 'z3-lite', 1), inLine(8, 'z3-mini', 1), row(1, 'none')];
  assert.deepEqual(minerPage(rows, undefined).rows.map(r => r.uid), [7, 64, 193, 8, 1, 9]);
});

// The chain table sorts on the server, so a sort covers every page: ?sort=tonight|uid|tier&dir=asc|desc.
test('the sort comes from the query; anything unknown is the default, tonight ascending', () => {
  assert.deepEqual(minerSort(undefined, undefined), { key: 'tonight', dir: 'asc' });
  assert.deepEqual(minerSort('uid', 'desc'), { key: 'uid', dir: 'desc' });
  assert.deepEqual(minerSort(['tier', 'uid'], ['desc']), { key: 'tier', dir: 'desc' });
  assert.deepEqual(minerSort('hotkey', 'sideways'), { key: 'tonight', dir: 'asc' });
  assert.deepEqual(minerSort('uid', 'sideways'), { key: 'uid', dir: 'asc' });
});

test('every page is sorted: by uid either way, by tier keeping tonight’s order inside a tier', () => {
  const r = (uid, standing, tier, position) => ({ uid, standing, tier, line: position ? { position, limit: 12, next: true, reason: null } : null });
  const rows = [r(9, 'out', 'z3-mini'), r(193, 'in_line', 'z3-lite', 2), r(7, 'crown', 'z3-mini'), r(64, 'in_line', 'z3-lite', 1), r(1, 'none', null), r(3, 'out', 'z3-lite')];
  const uids = sort => minerPage(rows, undefined, sort).rows.map(x => x.uid);
  assert.deepEqual(uids({ key: 'uid', dir: 'asc' }), [1, 3, 7, 9, 64, 193]);
  assert.deepEqual(uids({ key: 'uid', dir: 'desc' }), [193, 64, 9, 7, 3, 1]);
  assert.deepEqual(uids({ key: 'tier', dir: 'asc' }), [64, 193, 3, 7, 9, 1]);   // no tier last either way
  assert.deepEqual(uids({ key: 'tier', dir: 'desc' }), [7, 9, 64, 193, 3, 1]);
  assert.deepEqual(uids({ key: 'tonight', dir: 'desc' }), [9, 3, 1, 193, 64, 7]);
  assert.deepEqual(uids(undefined), [7, 64, 193, 1, 3, 9]);
  const many = Array.from({ length: 30 }, (_, i) => r(i + 1, 'out', 'z3-lite'));
  assert.deepEqual(minerPage(many, '2', { key: 'uid', dir: 'desc' }).rows.map(x => x.uid), [5, 4, 3, 2, 1]);
});

test('header links flip the active column and start others ascending; links keep the sort and drop the page', () => {
  const now = { key: 'uid', dir: 'asc' };
  assert.equal(sortHref(now, 'uid'), '/miners?sort=uid&dir=desc#miners');
  assert.equal(sortHref(now, 'tier'), '/miners?sort=tier&dir=asc#miners');
  assert.equal(sortHref({ key: 'tonight', dir: 'desc' }, 'tonight'), '/miners#miners');  // back to the default
  assert.equal(sortHref(now, null, 3), '/miners?sort=uid&dir=asc&page=3#miners');      // the pager
  assert.equal(sortHref({ key: 'tonight', dir: 'asc' }, null, 2), '/miners?page=2#miners');
});

// /miners "Next round": one table per tier that has an intake, its line in order, cut at the next round's limit.
test('next round lists each tier’s line in order and says where the limit cuts it', () => {
  const line = (position, limit = 2, reason = null) => ({ position, limit, next: position <= limit, reason });
  const r = (uid, tier, l, block = 100 + uid) => ({ uid, hotkey: `5H${uid}`, tier, standing: l ? 'in_line' : 'out',
    body: { pool: tier === 'z3-lite' ? 'd3-lite' : 'd3-mini', sha256: 'a'.repeat(64), revision: 'b'.repeat(40), repo: `o/b-${uid}`, block }, line: l });
  const rows = [r(5, 'z3-lite', line(3)), r(1, 'z3-mini', line(1, 15)), r(9, 'z3-lite', line(1, 2, 'the round’s new-body cap is reached')), r(2, 'z3-lite', null), r(7, 'z3-lite', line(2))];
  const tiers = nextRound(rows);
  assert.deepEqual(tiers.map(t => [t.tier, t.limit, t.rows.map(x => x.uid), t.cut]), [
    ['z3-lite', 2, [9, 7, 5], 2],
    ['z3-mini', 15, [1], 1],     // the whole line fits: the cut falls after the last row
  ]);
  assert.equal(tiers[0].rows[0].line.reason, 'the round’s new-body cap is reached');
  assert.deepEqual(nextRound([r(2, 'z3-lite', null)]), []);
});

// The validator's deferral reasons are machine sentences; the Next round table shows a short label for each kind.
test('deferral reasons read as short labels; anything new is shown as sent, capitalized', () => {
  assert.equal(reasonLabel('the round’s new-body cap is reached'), 'Over the new-body cap');
  assert.equal(reasonLabel("the round's new-body cap is reached"), 'Over the new-body cap');
  assert.equal(reasonLabel("the round's claims cap is reached"), 'Over the claims cap');
  assert.equal(reasonLabel("the round's download budget is spent"), 'Download budget spent');
  assert.equal(reasonLabel("the validator's free disk is below its floor"), 'Validator disk full');
  assert.equal(reasonLabel('something else came up'), 'Something else came up');
  assert.equal(reasonLabel(null), null);
});

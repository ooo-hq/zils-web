const { test } = require('node:test');
const assert = require('node:assert/strict');
const { STATUS_LABEL, isActive, sortMiners, boardNumbers } = require('../.private/test-build/miner-board.js');

const stats = (assigned, selected, median_skill) => ({ assigned, submitted: assigned, evaluated: assigned, selected, median_skill });
const mk = (uid, status, assigned, selected, skill, last_seen = null) => ({ uid, hotkey: `hk${uid}`, status, last_seen, models: [], training: stats(assigned, selected, skill) });
const fixture = [
  mk(100, 'unseen', 0, 0, null),
  mk(102, 'disabled', 2, 2, 0.71),
  mk(1, 'online', 28, 4, 0.98, '2026-10-18T19:58:00Z'),
  mk(101, 'online', 14, 3, 0.94, '2026-10-18T19:57:00Z'),
];
const net = { as_of: '2026-10-18T19:58:00Z', summary: { miners: 4, online: 2, stale: 0, offline: 0, unseen: 1, disabled: 1 }, miners: fixture };

test('every API status has a label', () => { for (const s of ['online', 'stale', 'offline', 'unseen', 'disabled']) assert.ok(STATUS_LABEL[s]); });
test('only online miners are active', () => assert.deepEqual(fixture.map(isActive), [false, false, true, true]));
test('sort by selected desc with skill tiebreak, nulls last', () => assert.deepEqual(sortMiners(fixture, 'selected').map(m => m.uid), [1, 101, 102, 100]));
test('sort by status puts online first, ties by skill', () => assert.deepEqual(sortMiners(fixture, 'status').map(m => m.uid), [1, 101, 102, 100]));
test('sort by last seen puts the freshest first, never seen last', () => assert.deepEqual(sortMiners(fixture, 'lastSeen').map(m => m.uid), [1, 101, 102, 100]));
test('sort does not mutate its input', () => { const copy = fixture.map(m => m.uid); sortMiners(fixture, 'uid'); assert.deepEqual(fixture.map(m => m.uid), copy); });
test('board numbers sum the fixture', () => assert.deepEqual(boardNumbers(net), { online: 2, total: 4, jobs: 44, selected: 9 }));
test('empty list is fine', () => assert.deepEqual(sortMiners([], 'skill'), []));

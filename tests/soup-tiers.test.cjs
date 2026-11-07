const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TIER_NAMES, TIERS, poolTier } = require('../.private/test-build/soup-tiers.js');
const { tierQueue } = require('../.private/test-build/network-bodies.js');

test('z3-flash is off: not listed, and its pool maps to no tier', () => {
  // Owner, 6 Nov 2026: the flash pool is closed on validators (pays nothing, ignores commitments).
  assert.equal(TIER_NAMES.includes('z3-flash'), false);
  assert.equal('z3-flash' in TIERS, false);
  assert.equal(poolTier('d3-flash'), null);
  assert.deepEqual(TIER_NAMES, ['z3-lite', 'z3-mini', 'z3']);
});

test('a body committed to the flash pool is never shown in line', () => {
  const rows = [{ body: { pool: 'd3-flash' }, standing: 'in_line', tier: poolTier('d3-flash') }];
  assert.equal(rows[0].tier, null);
  assert.equal(tierQueue('d3-lite', rows, Date.parse('2026-11-06T12:00:00Z')).waiting, 0);
});

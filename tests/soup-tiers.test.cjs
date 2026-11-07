const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TIER_NAMES } = require('../.private/test-build/soup-tiers.js');
const { OFF_TIERS, withoutOffTiers, nextRound } = require('../.private/test-build/network-bodies.js');

// Owner, 6 Nov 2026: the flash pool is closed on validators, so /miners does not show it. Other pages keep it.
test('z3-flash is off on /miners only', () => {
  assert.deepEqual(OFF_TIERS, ['z3-flash']);
  assert.equal(TIER_NAMES.includes('z3-flash'), true); // the shared tier list (used by /soup and /z3) is unchanged
});

test('a body committed to flash stays listed but is never in line', () => {
  const rows = [
    { uid: 1, tier: 'z3-flash', standing: 'in_line', line: { position: 1, limit: 4 } },
    { uid: 2, tier: 'z3-lite', standing: 'in_line', line: { position: 1, limit: 6 } },
  ];
  const shown = withoutOffTiers(rows);
  assert.deepEqual(shown[0], { uid: 1, tier: null, standing: 'none', line: null });
  assert.deepEqual(shown[1], rows[1]);
  assert.deepEqual(nextRound(shown).map(t => t.tier), ['z3-lite']);
});

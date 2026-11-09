const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TIER_NAMES } = require('../.private/test-build/soup-tiers.js');
const { OFF_TIERS, withoutOffTiers, nextRound } = require('../.private/test-build/network-bodies.js');

// Owner, 6 Nov 2026: the flash pool is closed on validators; 9 Nov 2026: so is z3. /miners keeps their tiles
// ("No soup for you!") but never shows their bodies in line. Other pages keep the full tier list.
test('z3-flash and z3 bodies are off the line on /miners; the tier list is unchanged', () => {
  assert.deepEqual(OFF_TIERS, ['z3-flash', 'z3']);
  assert.equal(TIER_NAMES.includes('z3-flash'), true); // the shared tier list (used by /soup and /z3) is unchanged
  assert.equal(TIER_NAMES.includes('z3'), true);
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

test('a body committed to z3 stays listed but is never in line', () => {
  const rows = [
    { uid: 67, tier: 'z3', standing: 'in_line', line: { position: 1, limit: 2 } },
    { uid: 2, tier: 'z3-mini', standing: 'in_line', line: { position: 1, limit: 6 } },
  ];
  const shown = withoutOffTiers(rows);
  assert.deepEqual(shown[0], { uid: 67, tier: null, standing: 'none', line: null });
  assert.deepEqual(nextRound(shown).map(t => t.tier), ['z3-mini']);
});

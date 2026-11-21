const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TIERS, TIER_NAMES } = require('../.private/test-build/soup-tiers.js');
const { OFF_TIERS, withoutOffTiers, nextRound } = require('../.private/test-build/network-bodies.js');

// Owner, 6 Nov 2026: the flash pool is closed on validators; 9 Nov 2026: so is z3. Owner, 20 Nov 2026: both open
// on 22 Nov, so no tier is off the line and every committed body keeps its place.
test('no tier is off the line on /miners; the tier list is unchanged', () => {
  assert.deepEqual(OFF_TIERS, []);
  assert.equal(TIER_NAMES.includes('z3-flash'), true);
  assert.equal(TIER_NAMES.includes('z3'), true);
});

test('a body committed to flash or z3 stays in line', () => {
  const rows = [
    { uid: 1, tier: 'z3-flash', standing: 'in_line', line: { position: 1, limit: 4 } },
    { uid: 67, tier: 'z3', standing: 'in_line', line: { position: 1, limit: 2 } },
    { uid: 2, tier: 'z3-lite', standing: 'in_line', line: { position: 1, limit: 6 } },
  ];
  const shown = withoutOffTiers(rows);
  assert.deepEqual(shown, rows);
  assert.deepEqual(nextRound(shown).map(t => t.tier).sort(), ['z3', 'z3-flash', 'z3-lite']);
});

test('no tier says it opens later', () => {
  for (const tier of TIER_NAMES) assert.equal('later' in TIERS[tier], false, tier);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estimate, sliderToValue } = require('../.private/test-build/pricing-estimate.js');

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('defaults cost $4.20 with $0.80 left', () => { const e = estimate({ requests: 100000, tokensPerRequest: 1000, extraRuns: 0 }); near(e.total, 4.2); near(e.left, 0.8); assert.equal(e.over, 0); });
test('two extra runs go $3.20 over', () => { const e = estimate({ requests: 100000, tokensPerRequest: 1000, extraRuns: 2 }); near(e.total, 8.2); near(e.over, 3.2); assert.equal(e.left, 0); });
test('exactly $5 leaves zero, not overage', () => { const e = estimate({ requests: 0, tokensPerRequest: 0, extraRuns: 2.5 }); assert.equal(e.over, 0); near(e.left, 0); });
test('zeros and garbage are safe', () => { for (const bad of [0, -5, NaN, Infinity]) { const e = estimate({ requests: bad, tokensPerRequest: bad, extraRuns: bad }); assert.ok(Number.isFinite(e.total) && e.total >= 0); assert.ok(e.left >= 0 && e.over >= 0 && !(e.left > 0 && e.over > 0)); assert.ok(e.usedPct >= 0 && e.usedPct <= 100); } });
test('huge finite inputs stay finite', () => { const e = estimate({ requests: 1e308, tokensPerRequest: 1e308, extraRuns: 1e308 }); assert.ok(Number.isFinite(e.total) && Number.isFinite(e.over)); assert.equal(e.usedPct, 100); });
test('slider midpoints hit the defaults', () => { assert.equal(sliderToValue(50, 1000, 10000000), 100000); assert.equal(sliderToValue(50, 100, 10000), 1000); });
test('slider ends hit the bounds and round to 2 significant figures', () => { assert.equal(sliderToValue(0, 1000, 10000000), 1000); assert.equal(sliderToValue(100, 1000, 10000000), 10000000); assert.equal(sliderToValue(37, 1000, 10000000), 30000); assert.equal(sliderToValue(-5, 100, 10000), 100); assert.equal(sliderToValue(NaN, 100, 10000), 100); });

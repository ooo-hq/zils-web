const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_MODEL_INPUTS, WORKLOADS, DELIVERY_COSTS, parseModelInputs, modelPricing } = require('../.private/test-build/pricing-model.js');

const assumptions = (overrides = {}) => parseModelInputs({ ...DEFAULT_MODEL_INPUTS, ...overrides });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('regular usage counts consumed credit once, with no extra $5 fee', () => {
  for (const [customers, revenue, surplus] of [[100, 620, -235.18], [1000, 6200, 2148.2], [2000, 12400, 4796.4]]) {
    const result = modelPricing(assumptions(), customers);
    near(result.revenue, revenue);
    near(result.surplus, surplus);
    assert.equal(result.breakEvenCustomers, 189);
  }
});

test('light and heavy workloads retain the analyzed revenue and cost results', () => {
  const light = modelPricing(assumptions(WORKLOADS.light), 2000);
  near(light.revenue, 840);
  near(light.surplus, -134.76);
  assert.equal(light.breakEvenCustomers, 2738);
  const heavy = modelPricing(assumptions(WORKLOADS.heavy), 2000);
  near(heavy.revenue, 92000);
  near(heavy.surplus, 39312);
  assert.equal(heavy.breakEvenCustomers, 26);
});

test('negative unit economics do not invent a break-even customer count', () => {
  const result = modelPricing(assumptions(DELIVERY_COSTS.stress), 2000);
  near(result.surplus, -7203.6);
  assert.equal(result.breakEvenCustomers, null);
});

test('first free training adds delivery cost, without adding revenue or resetting every run', () => {
  const result = modelPricing(assumptions({ newCustomers: '25' }), 1000);
  near(result.revenue, 6200);
  near(result.delivery, 3250);
  near(result.surplus, 1898.2);
});

test('larger top-ups reduce amortized fees without increasing usage revenue', () => {
  const result = modelPricing(assumptions({ topup: '20' }), 1000);
  near(result.revenue, 6200);
  near(result.fees, 272.8);
  near(result.surplus, 2427.2);
});

test('zero usage retains overhead and avoids dividing by zero', () => {
  const input = assumptions({ requests: '0', runs: '0' });
  const result = modelPricing(input, 1000);
  assert.equal(result.revenue, 0);
  assert.equal(result.surplus, -500);
  assert.equal(result.breakEvenCustomers, null);
  assert.equal(modelPricing({ ...input, fixed: 0 }, 1000).breakEvenCustomers, 0);
});

test('rejects blank, negative, non-finite, fractional-count, and out-of-range assumptions', () => {
  for (const override of [{ requests: '' }, { tokens: ' ' }, { requests: '-1' }, { requests: '1.5' },
    { tokens: 'Infinity' }, { inference: 'NaN' }, { requests: '1000000001' }, { newCustomers: '101' }, { topup: '0' }]) {
    assert.equal(assumptions(override), null, JSON.stringify(override));
  }
  assert.notEqual(assumptions({ runs: '0.25', inference: '0.0005' }), null);
});

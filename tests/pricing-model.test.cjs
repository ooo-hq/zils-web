const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_MODEL_INPUTS, WORKLOADS, DELIVERY_COSTS, parseModelInputs, modelPricing } = require('../.private/test-build/pricing-model.js');

const assumptions = (overrides = {}) => parseModelInputs({ ...DEFAULT_MODEL_INPUTS, ...overrides });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('regular usage counts consumed credit once, with no extra $5 fee', () => {
  for (const [customers, revenue, surplus] of [[100, 620, -145.18], [1000, 6200, 3048.2], [2000, 12400, 6596.4]]) {
    const result = modelPricing(assumptions(), customers);
    near(result.revenue, revenue);
    near(result.surplus, surplus);
    assert.equal(result.breakEvenCustomers, 141);
  }
});

test('light and heavy workloads retain the analyzed revenue and cost results', () => {
  const light = modelPricing(assumptions(WORKLOADS.light), 2000);
  near(light.revenue, 840);
  near(light.surplus, -134.76);
  assert.equal(light.breakEvenCustomers, 2738);
  const heavy = modelPricing(assumptions(WORKLOADS.heavy), 2000);
  near(heavy.revenue, 92000);
  near(heavy.surplus, 42912);
  assert.equal(heavy.breakEvenCustomers, 24);
});

test('negative unit economics do not invent a break-even customer count', () => {
  const result = modelPricing(assumptions(DELIVERY_COSTS.stress), 2000);
  near(result.surplus, -2203.6);
  assert.equal(result.breakEvenCustomers, null);
});

test('first free training adds Zils and miner costs once, without adding revenue', () => {
  const result = modelPricing(assumptions({ newCustomers: '25' }), 1000);
  near(result.revenue, 6200);
  near(result.delivery, 2125);
  near(result.trainingJobs, 1250);
  near(result.minerCompute, 1250);
  near(result.surplus, 3023.2);
});

test('miner-funded compute never reduces Zils surplus or changes break-even', () => {
  const cheap = modelPricing(assumptions({ minerCompute: '0' }), 1000);
  const expensive = modelPricing(assumptions({ minerCompute: '100' }), 1000);
  near(cheap.minerCompute, 0);
  near(expensive.minerCompute, 100000);
  near(expensive.revenue, cheap.revenue);
  near(expensive.delivery, cheap.delivery);
  near(expensive.surplus, cheap.surplus);
  assert.equal(expensive.breakEvenCustomers, cheap.breakEvenCustomers);
  near(expensive.serving, 2000);
  near(expensive.training, 100);
  near(expensive.minerPayments, 0);
  near(expensive.delivery, 2100);
});

test('only Zils direct miner payments are deducted, including payments for first free jobs', () => {
  const noPayment = modelPricing(assumptions({ newCustomers: '25' }), 1000);
  const paid = modelPricing(assumptions({ newCustomers: '25', minerPayment: '0.5' }), 1000);
  near(paid.minerPayments, 625);
  near(paid.delivery, noPayment.delivery + 625);
  near(paid.surplus, noPayment.surplus - 625);
  near(paid.minerCompute, noPayment.minerCompute);
  near(paid.revenue, noPayment.revenue);
});

test('with no Zils per-job expense, more miner training still has zero direct training cost', () => {
  const result = modelPricing(assumptions({ requests: '0', runs: '10', training: '0', minerPayment: '0', newCustomers: '100' }), 1000);
  near(result.revenue, 20000);
  near(result.trainingJobs, 11000);
  near(result.minerCompute, 11000);
  near(result.delivery, 0);
  near(result.surplus, 17720);
});

test('larger top-ups reduce amortized fees without increasing usage revenue', () => {
  const result = modelPricing(assumptions({ topup: '20' }), 1000);
  near(result.revenue, 6200);
  near(result.fees, 272.8);
  near(result.surplus, 3327.2);
});

test('zero usage retains overhead and avoids dividing by zero', () => {
  const input = assumptions({ requests: '0', runs: '0' });
  const result = modelPricing(input, 1000);
  assert.equal(result.revenue, 0);
  assert.equal(result.minerCompute, 0);
  assert.equal(result.surplus, -500);
  assert.equal(result.breakEvenCustomers, null);
  assert.equal(modelPricing({ ...input, fixed: 0 }, 1000).breakEvenCustomers, 0);
});

test('rejects blank, negative, non-finite, fractional-count, and out-of-range assumptions', () => {
  for (const override of [{ requests: '' }, { tokens: ' ' }, { requests: '-1' }, { requests: '1.5' },
    { tokens: 'Infinity' }, { inference: 'NaN' }, { requests: '1000000001' }, { newCustomers: '101' }, { topup: '0' },
    { minerCompute: '-1' }, { minerCompute: '' }, { minerPayment: 'Infinity' }, { minerPayment: '-1' }]) {
    assert.equal(assumptions(override), null, JSON.stringify(override));
  }
  assert.notEqual(assumptions({ runs: '0.25', inference: '0.0005' }), null);
});

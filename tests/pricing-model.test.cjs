const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_MODEL_INPUTS, WORKLOADS, DELIVERY_COSTS, parseModelInputs, modelPricing } = require('../.private/test-build/pricing-model.js');

const assumptions = (overrides = {}) => parseModelInputs({ ...DEFAULT_MODEL_INPUTS, zils: '1', ...overrides });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('one-Zil usage retains the original economics, with no extra $5 fee', () => {
  for (const [customers, revenue, surplus] of [[100, 620, -145.18], [1000, 6200, 3048.2], [2000, 12400, 6596.4]]) {
    const result = modelPricing(assumptions(), customers);
    near(result.revenue, revenue);
    near(result.surplus, surplus);
    assert.equal(result.breakEvenCustomers, 141);
  }
});

test('light and heavy workloads retain the analyzed revenue and cost results', () => {
  const light = modelPricing(assumptions({ requests: '10000', runs: '0' }), 2000);
  near(light.revenue, 840);
  near(light.surplus, -134.76);
  assert.equal(light.breakEvenCustomers, 2738);
  const heavy = modelPricing(assumptions({ requests: '1000000', runs: '2' }), 2000);
  near(heavy.revenue, 92000);
  near(heavy.surplus, 42912);
  assert.equal(heavy.breakEvenCustomers, 24);
});

test('negative unit economics do not invent a break-even customer count', () => {
  const result = modelPricing(assumptions(DELIVERY_COSTS.stress), 2000);
  near(result.surplus, -2203.6);
  assert.equal(result.breakEvenCustomers, null);
});

test('a free run discounts an entered job and retains all Zils and miner costs', () => {
  const result = modelPricing(assumptions({ newCustomers: '25' }), 1000);
  near(result.revenue, 5700);
  near(result.delivery, 2100);
  near(result.trainingJobs, 1000);
  near(result.freeTrainingJobs, 250);
  near(result.paidTrainingJobs, 750);
  near(result.minerCompute, 1000);
  near(result.surplus, 2592.7);
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
  near(paid.minerPayments, 500);
  near(paid.delivery, noPayment.delivery + 500);
  near(paid.surplus, noPayment.surplus - 500);
  near(paid.minerCompute, noPayment.minerCompute);
  near(paid.revenue, noPayment.revenue);
});

test('with no Zils per-job expense, more miner training still has zero direct training cost', () => {
  const result = modelPricing(assumptions({ requests: '0', runs: '10', training: '0', minerPayment: '0', newCustomers: '100' }), 1000);
  near(result.revenue, 18000);
  near(result.trainingJobs, 10000);
  near(result.minerCompute, 10000);
  near(result.delivery, 0);
  near(result.surplus, 15898);
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
    { zils: '' }, { zils: '-1' }, { zils: '1.5' }, { zils: '10001' }, { zils: 'Infinity' },
    { minerCompute: '-1' }, { minerCompute: '' }, { minerPayment: 'Infinity' }, { minerPayment: '-1' }]) {
    assert.equal(assumptions(override), null, JSON.stringify(override));
  }
  assert.notEqual(assumptions({ runs: '0.25', inference: '0.0005' }), null);
});

test('the default five-Zil portfolio scales usage and per-job costs while overhead is counted once', () => {
  const input = parseModelInputs(DEFAULT_MODEL_INPUTS);
  const single = modelPricing({ ...input, zils: 1 }, 1000);
  const multiple = modelPricing(input, 1000);
  near(multiple.zils, 5000);
  near(multiple.requestsPerCustomer, 500000);
  near(multiple.jobsPerCustomer, 5);
  near(multiple.inferenceRevenuePerCustomer, 21);
  near(multiple.trainingRevenuePerCustomer, 10);
  for (const field of ['revenue', 'serving', 'training', 'fees', 'minerCompute']) {
    near(multiple[field], single[field] * 5);
  }
  near(multiple.surplus + input.fixed, (single.surplus + input.fixed) * 5);
  for (const [customers, revenue, surplus] of [[100, 3100, 1274.1], [1000, 31000, 17241], [2000, 62000, 34982]]) {
    const result = modelPricing(input, customers);
    near(result.revenue, revenue);
    near(result.surplus, surplus);
    assert.equal(result.breakEvenCustomers, 29);
  }
});

test('five Zils with six setup runs each have 30 total runs and only one free run per customer', () => {
  const input = assumptions(WORKLOADS.setup);
  for (const [customers, revenue, surplus] of [[100, 7900, 5396.9], [1000, 79000, 58469], [2000, 158000, 117438]]) {
    const result = modelPricing(input, customers);
    near(result.revenuePerCustomer, 79);
    near(result.inferenceRevenuePerCustomer, 21);
    near(result.trainingRevenuePerCustomer, 58);
    near(result.trainingJobs, customers * 30);
    near(result.freeTrainingJobs, customers);
    near(result.paidTrainingJobs, customers * 29);
    near(result.minerCompute, customers * 30);
    near(result.revenue, revenue);
    near(result.surplus, surplus);
  }
});

test('free run eligibility stays per customer as the portfolio grows', () => {
  const single = modelPricing(assumptions({ newCustomers: '25' }), 1000);
  const multiple = modelPricing(assumptions({ zils: '5', newCustomers: '25' }), 1000);
  near(multiple.freeTrainingJobs, single.freeTrainingJobs);
  near(multiple.freeTrainingJobs, 250);
  near(multiple.trainingJobs, 5000);
  near(multiple.paidTrainingJobs, 4750);
  near(multiple.revenue, 30500);
});

test('direct miner payments cover every training job, including free jobs, once', () => {
  const input = assumptions({ ...WORKLOADS.setup, minerPayment: '0.5' });
  const result = modelPricing(input, 1000);
  near(result.minerPayments, 15000);
  near(result.delivery, 28000);
  near(result.surplus, 43469);
  const expensiveMiners = modelPricing({ ...input, minerCompute: 100 }, 1000);
  near(expensiveMiners.minerCompute, 3000000);
  near(expensiveMiners.surplus, result.surplus);
});

test('zero Zils means zero usage and no free jobs, with fixed overhead retained', () => {
  const result = modelPricing(assumptions({ ...WORKLOADS.setup, zils: '0' }), 1000);
  for (const field of ['zils', 'revenue', 'delivery', 'fees', 'trainingJobs', 'freeTrainingJobs', 'paidTrainingJobs', 'minerCompute']) {
    near(result[field], 0);
  }
  near(result.surplus, -500);
  assert.equal(result.breakEvenCustomers, null);
});

test('free runs cannot exceed total runs, including fractional monthly averages', () => {
  for (const runs of ['0', '0.1']) {
    const result = modelPricing(assumptions({ zils: '5', requests: '0', runs, newCustomers: '100' }), 1000);
    near(result.revenue, 0);
    near(result.paidTrainingJobs, 0);
    near(result.freeTrainingJobs, result.trainingJobs);
    near(result.training, result.trainingJobs * 0.1);
  }
});

test('buybacks allocate surplus after the reserve and include trading costs exactly once', () => {
  const input = parseModelInputs({ ...DEFAULT_MODEL_INPUTS,
    buybackPercent: '50', cashReserve: '2000', alphaPrice: '0.5', buybackFeePercent: '2' });
  const result = modelPricing(input, 1000);
  near(result.surplus, 17241);
  near(result.reserveHeld, 2000);
  near(result.buybackAvailable, 15241);
  near(result.buybackSpend, 7620.5);
  near(result.buybackFees, 152.41);
  near(result.alphaPurchasedUsd, 7468.09);
  near(result.alphaBurned, 14936.18);
  near(result.retainedCash, 9620.5);
  near(result.retainedCash + result.buybackSpend, result.surplus);
  assert.equal(result.breakEvenCustomers, 29);
});

test('zero allocation preserves surplus and full allocation still protects the reserve', () => {
  for (const [percent, spent, retained] of [['0', 0, 3048.2], ['100', 2048.2, 1000]]) {
    const result = modelPricing(assumptions({ buybackPercent: percent, cashReserve: '1000',
      alphaPrice: '1', buybackFeePercent: '0' }), 1000);
    near(result.buybackSpend, spent);
    near(result.alphaBurned, spent);
    near(result.retainedCash, retained);
    near(result.reserveHeld, 1000);
  }
});

test('losses, zero surplus, and reserves larger than surplus never fund buybacks', () => {
  const cases = [
    [{ zils: '0' }, -500, 0],
    [{ zils: '0', fixed: '0' }, 0, 0],
    [{ cashReserve: '5000' }, 3048.2, 3048.2],
  ];
  for (const [overrides, surplus, reserve] of cases) {
    const result = modelPricing(assumptions({ buybackPercent: '100', ...overrides }), 1000);
    near(result.surplus, surplus);
    near(result.retainedCash, surplus);
    near(result.reserveHeld, reserve);
    for (const field of ['buybackAvailable', 'buybackSpend', 'buybackFees', 'alphaPurchasedUsd', 'alphaBurned']) {
      near(result[field], 0);
    }
  }
});

test('alpha execution price changes token quantity without creating extra cash or miner rewards', () => {
  const input = assumptions({ buybackPercent: '50', cashReserve: '1000', alphaPrice: '1', buybackFeePercent: '0' });
  const cheap = modelPricing(input, 1000);
  const expensive = modelPricing({ ...input, alphaPrice: 2 }, 1000);
  near(cheap.alphaBurned, 1024.1);
  near(expensive.alphaBurned, 512.05);
  for (const field of ['revenue', 'delivery', 'surplus', 'buybackSpend', 'retainedCash', 'minerPayments', 'minerCompute']) {
    near(expensive[field], cheap[field]);
  }
  const allFees = modelPricing({ ...input, buybackFeePercent: 100 }, 1000);
  near(allFees.alphaBurned, 0);
  near(allFees.buybackFees, 1024.1);
  near(allFees.retainedCash, 2024.1);
});

test('buyback inputs reject invalid percentages, reserves, and zero or missing execution prices', () => {
  for (const override of [{ buybackPercent: '' }, { buybackPercent: '-1' }, { buybackPercent: '101' },
    { cashReserve: '-1' }, { cashReserve: 'Infinity' }, { cashReserve: '10000001' },
    { alphaPrice: '0' }, { alphaPrice: '-1' }, { alphaPrice: '' }, { alphaPrice: 'NaN' },
    { buybackFeePercent: '-1' }, { buybackFeePercent: '101' }, { buybackFeePercent: '' }]) {
    assert.equal(assumptions(override), null, JSON.stringify(override));
  }
  assert.notEqual(assumptions({ buybackPercent: '12.5', alphaPrice: '0.000001', buybackFeePercent: '0.05' }), null);
});

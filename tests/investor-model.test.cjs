const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_INVESTOR_INPUTS, parseInvestorInputs, modelInvestor, ALPHA_SNAPSHOT } = require('../.private/test-build/investor-model.js');
const inputs = (overrides = {}) => parseInvestorInputs({ ...DEFAULT_INVESTOR_INPUTS, ...overrides });
const model = (overrides = {}) => modelInvestor(inputs(overrides));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('launch snapshot applies the owner share once and matches the reviewed budget', () => {
  const result = model();
  assert.equal(result.monthlyAlpha, 19440);
  assert.equal(result.monthlyCosts, 13048);
  near(result.grossValue, 11745.04536);
  near(result.saleProceeds, 11745.04536);
  near(result.emissionsNet, -1302.95464);
  near(result.breakEvenAlpha, 13048 / 19440);
  near(result.coveredFounderSalary, 8697.04536);
  assert.equal(result.runwayMonths, 0);
  near(result.endingCash, -1302.95464 * 12);
  near(result.fundingNeeded, -result.endingCash);
});

test('retained alpha and sale haircuts reduce cash without changing allocated token value', () => {
  const result = model({ sold: '50', saleCost: '10' });
  assert.equal(result.retainedAlpha, 9720);
  near(result.grossValue, 11745.04536);
  near(result.saleProceeds, 11745.04536 * 0.45);
  near(result.breakEvenAlpha, 13048 / (19440 * 0.45));
});

test('no sale proceeds cannot produce a positive break-even price or imaginary runway', () => {
  for (const override of [{ share: '0' }, { ownerAlpha: '0' }, { sold: '0' }, { saleCost: '100' }]) {
    const result = model(override);
    assert.equal(result.saleProceeds, 0);
    assert.equal(result.breakEvenAlpha, null);
    assert.equal(result.coveredFounderSalary, 0);
    assert.equal(result.runwayMonths, 0);
  }
  const worthless = model({ alphaPrice: '0' });
  assert.equal(worthless.saleProceeds, 0);
  near(worthless.breakEvenAlpha, 13048 / 19440);
});

test('payroll affects both salaries; covered founder salary includes its own employer costs', () => {
  const result = model({ payroll: '20', infrastructure: '400', other: '200' });
  assert.equal(result.employerCosts, 2600);
  assert.equal(result.monthlyCosts, 16248);
  near(result.coveredFounderSalary, (11745.04536 - 48 - 400 - 200) / 1.2 - 3000);
});

test('customer receipts improve actual cash flow without overstating emissions coverage', () => {
  const result = model({ customers: '2000' });
  near(result.emissionsNet, -1302.95464);
  near(result.months[0].net, 697.04536);
  near(result.breakEvenAlpha, 13048 / 19440);
  assert.equal(result.runwayMonths, null);
  assert.equal(result.fundingNeeded, 0);
});

test('hosting compounds from month two and a later surplus cannot conceal an early funding gap', () => {
  const result = model({ alphaPrice: '1', delay: '2', openingCash: '20000', hostingGrowth: '10' });
  assert.equal(result.months[0].hosting, 48);
  near(result.months[1].hosting, 52.8);
  near(result.months[11].hosting, 48 * 1.1 ** 11);
  assert.equal(result.months[0].emissions, 0);
  assert.equal(result.months[1].emissions, 0);
  assert.equal(result.months[2].emissions, 19440);
  near(result.runwayMonths, 1 + (20000 - 13048) / 13052.8);
  near(result.fundingNeeded, 6100.8);
  assert.ok(result.endingCash > 0);
});

test('twelve-month delay excludes all emissions; exact zero balance is not yet negative', () => {
  const result = model({ delay: '12', openingCash: String(13048 * 3) });
  assert.ok(result.months.every(month => month.emissions === 0));
  assert.equal(result.months[2].balance, 0);
  assert.equal(result.runwayMonths, 3);
});

test('the zero-cost scenario has zero break-even with no division by zero', () => {
  const result = model({ founder: '0', bizDev: '0', hosting: '0', sold: '0' });
  assert.equal(result.breakEvenAlpha, 0);
  assert.equal(result.coverage, null);
  assert.equal(result.runwayMonths, null);
  assert.equal(result.endingCash, 0);
});

test('upside is a price sensitivity, not automatic appreciation in the forecast', () => {
  const result = model({ alphaPrice: String(ALPHA_SNAPSHOT * 1.25) });
  near(result.emissionsNet, 1633.3067);
  assert.ok(result.months.every(month => month.emissions === result.saleProceeds));
});

test('invalid financial inputs pause results instead of silently treating blank costs as zero', () => {
  for (const override of [{ founder: '' }, { hosting: ' ' }, { share: '101' }, { saleCost: '-1' },
    { alphaPrice: 'Infinity' }, { ownerAlpha: 'NaN' }, { openingCash: '-1' }, { delay: '1.5' },
    { delay: '13' }, { hostingGrowth: '101' }, { customers: '10000001' }]) {
    assert.equal(inputs(override), null);
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const file = name => readFileSync(join(__dirname, '../public/model', name));
const record = name => JSON.parse(file(name));
const hash = name => createHash('sha256').update(file(name)).digest('hex');

test('published flight evidence retains its frozen protocol and dataset manifest', () => {
  const study = record('flight-delay-001.json');
  assert.equal(study.protocol_sha256, hash('flight-delay-001-protocol.json'));
  assert.equal(study.manifest_sha256, hash('flight-delay-001-manifest.json'));
  const splits = record('flight-delay-001-manifest.json').splits;
  assert.deepEqual(Object.values(splits).map(s => s.count).sort((a, b) => a - b), [512, 1024, 3072]);
  assert.ok(splits.train.last_date < splits.calibration.first_date);
  assert.ok(splits.calibration.last_date < splits.test.first_date);
  for (const metric of Object.values(study.metrics)) assert.equal(metric.count, splits.test.count);
});

test('the flight headline is a relative Brier improvement, with the stronger baseline retained', () => {
  const study = record('flight-delay-001.json');
  const { base_calibrated: base, adapter_calibrated: adapter, historical_rate: history } = study.metrics;
  assert.equal(((base.brier - adapter.brier) / base.brier * 100).toFixed(1), '6.5');
  assert.ok(study.adapter_brier_improvement.base_calibrated.ci95[0] > 0);
  assert.ok(history.brier < adapter.brier);
  const interval = study.adapter_brier_improvement.historical_rate.ci95;
  assert.ok(interval[0] < 0 && interval[1] > 0);
  assert.equal(adapter.late_recall, 0);
  assert.equal(adapter.accuracy, 1 - adapter.late_rate);
  assert.equal(study.demonstrated_improvement, false);
  assert.equal(study.live_model_changes, false);
});

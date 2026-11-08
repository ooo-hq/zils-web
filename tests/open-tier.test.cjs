const test = require('node:test');
const assert = require('node:assert/strict');
const { submissionSchema, jobSchema, tierFields, tierLabel } = require('../.private/test-build/training.js');

const base = { name: 'tiered', acceptance: { min_accuracy: .8, min_brier_improvement: .01 }, allow_training_data_export: true };

test('an open run always carries its permission to share with network miners; a private run never does', () => {
  assert.deepEqual(tierFields('open'), { tier: 'open', allow_open_tier_training: true });
  assert.deepEqual(tierFields('private'), { tier: 'private' });
  assert.deepEqual(submissionSchema.parse({ ...base, ...tierFields('open') }), { ...base, tier: 'open', allow_open_tier_training: true });
  assert.equal(submissionSchema.parse({ ...base, ...tierFields('private') }).tier, 'private');
  assert.equal(submissionSchema.safeParse({ ...base, tier: 'public' }).success, false);
  assert.equal(submissionSchema.safeParse({ ...base, tier: 'open', allow_open_tier_training: false }).success, false);
});

test('jobs show their tier, and older responses without one still parse', () => {
  const job = { id: '10000000-0000-4000-8000-000000000001', name: 'tiered', status: 'queued' };
  assert.equal(jobSchema.parse({ ...job, tier: 'open' }).tier, 'open');
  assert.equal(jobSchema.parse(job).tier, undefined);
  assert.equal(jobSchema.safeParse({ ...job, tier: 'shared' }).success, false);
});

test('each run is labelled with who trains it; runs from before tiers get no label', () => {
  const job = { id: '10000000-0000-4000-8000-000000000001', name: 'tiered', status: 'queued' };
  assert.equal(tierLabel({ ...job, tier: 'open' }), 'Open tier · free');
  assert.equal(tierLabel({ ...job, tier: 'private' }), 'Private');
  assert.equal(tierLabel(job), null);
});

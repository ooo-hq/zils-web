const { test } = require('node:test');
const assert = require('node:assert/strict');
const { submissionSchema } = require('../.private/test-build/training.js');
const base = { name: 'routing-v2', acceptance: { min_accuracy: 0.8, min_brier_improvement: 0.01 }, allow_training_data_export: true };

test('a replacement run names its predecessor by job id, and only by a valid id', () => {
  const ok = submissionSchema.safeParse({ ...base, acceptance: { ...base.acceptance, previous_job_id: '123e4567-e89b-42d3-a456-426614174000' } });
  assert.ok(ok.success);
  assert.equal(ok.data.acceptance.previous_job_id, '123e4567-e89b-42d3-a456-426614174000');
  assert.ok(!submissionSchema.safeParse({ ...base, acceptance: { ...base.acceptance, previous_job_id: 'latest' } }).success);
  assert.ok(submissionSchema.safeParse(base).success, 'independent runs stay valid without a predecessor');
});

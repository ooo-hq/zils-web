const { test } = require('node:test');
const assert = require('node:assert/strict');
const { trainingProgress, TRAINING_STAGES, currentTrainingJob } = require('../.private/test-build/training-status.js');
const { STATUSES, jobSchema } = require('../.private/test-build/training.js');
const job = status => ({ id: '123e4567-e89b-42d3-a456-426614174000', name: 'support-routing-v1', status });

test('every backend state has a customer-facing explanation and next step', () => {
  for (const status of STATUSES) {
    const state = trainingProgress(job(status));
    assert.ok(state.label && state.title && state.detail && state.next);
    assert.ok(state.stage === null || (state.stage >= 0 && state.stage <= TRAINING_STAGES.length));
  }
});
test('approval and queue waits never claim the model is already training', () => {
  const approval = trainingProgress(job('awaiting_approval'));
  const queued = trainingProgress(job('queued'));
  assert.equal(approval.tone, 'waiting');
  assert.match(approval.detail, /approve and assign/);
  assert.equal(queued.tone, 'waiting');
  assert.match(queued.title, /Waiting to start/);
  assert.equal(trainingProgress(job('running')).tone, 'active');
});
test('failure does not invent which earlier stages completed', () => {
  const state = trainingProgress(job('failed'));
  assert.equal(state.stage, null);
  assert.equal(state.tone, 'stopped');
});
test('completed, qualified, and non-qualifying results stay distinct', () => {
  const finished = trainingProgress(job('completed'));
  const accepted = trainingProgress({ ...job('completed'), result: { delivery: { status: 'accepted' } } });
  const rejected = trainingProgress({ ...job('completed'), result: { delivery: { status: 'no_qualifying_model' } } });
  assert.doesNotMatch(finished.title, /ready to download/);
  assert.match(accepted.title, /ready to download/);
  assert.match(rejected.title, /No model met/);
  assert.equal(rejected.stage, TRAINING_STAGES.length);
  assert.equal(rejected.tone, 'done');
});
test('a stale result cannot turn a running job into a completed one', () => {
  const state = trainingProgress({ ...job('running'), result: { delivery: { status: 'accepted' } } });
  assert.equal(state.stage, 1);
  assert.equal(state.tone, 'active');
  assert.equal(jobSchema.parse(job('awaiting_approval')).status, 'awaiting_approval');
});

test('the workspace prioritizes unfinished work over a newer completed run', () => {
  const complete = { ...job('completed'), id: 'finished' };
  const active = { ...job('awaiting_approval'), id: 'waiting' };
  assert.equal(currentTrainingJob([complete, active]), active);
  assert.equal(currentTrainingJob([complete]), complete);
  assert.equal(currentTrainingJob([]), undefined);
});

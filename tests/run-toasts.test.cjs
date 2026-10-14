const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runToasts } = require('../.private/test-build/run-toasts.js');
const job = (id, status, extra = {}) => ({ id, name: `run-${id}`, status, ...extra });

test('only known jobs whose state changed produce a toast', () => {
  const before = [job('a', 'running'), job('b', 'validating')];
  const after = [job('a', 'completed', { result: { delivery: { status: 'accepted' } } }), job('b', 'validating'), job('c', 'running')];
  const toasts = runToasts(before, after);
  assert.deepEqual(toasts.map(t => [t.jobId, t.tone, t.sticky]), [['a', 'done', true]]);
  assert.match(toasts[0].title, /ready to download/);
  assert.equal(runToasts(null, after).length, 0, 'first load is silent');
  assert.equal(runToasts(after, after).length, 0, 'no change, no toast');
});

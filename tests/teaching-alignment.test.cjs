const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assignTeachingSplits, selectTeachingBatch, teachingAccuracy, importTeachingExamples, prepareTeachingDraft } = require('../.private/test-build/teach-by-example.js');

const task = { kind: 'sort', goal: 'Route requests', rules: '', answers: ['Billing', 'Support'] };
const rows = () => Array.from({ length: 12 }, (_, i) => ({ id: String(i), input: `Request ${i}`, output: i % 2 ? 'Support' : 'Billing', group: `case-${Math.floor(i / 2)}`, reviewed: false, excluded: false, source: 'Fixture' }));

test('unlabelled imports accept input-only mapping without leaking a label into input', () => {
  const imported = importTeachingExamples({ headers: ['message'], rows: [['A request']] }, { inputs: ['message'], answer: '', group: '' }, 'unlabelled.jsonl');
  assert.equal(imported[0].input, 'A request');
  assert.equal(imported[0].output, '');
  assert.equal(imported[0].reviewed, false);
});

test('alignment reserves whole source cases before seeing answers and preserves assignments after edits', () => {
  const original = assignTeachingSplits(rows());
  const unlabeled = assignTeachingSplits(rows().map(r => ({ ...r, output: '' })));
  assert.deepEqual(original.map(r => r.split), unlabeled.map(r => r.split));
  assert.deepEqual([...new Set(original.map(r => r.split))].sort(), ['calibration', 'test', 'train']);
  for (const group of new Set(original.map(r => r.group))) assert.equal(new Set(original.filter(r => r.group === group).map(r => r.split)).size, 1);
  const extended = assignTeachingSplits([...original.slice().reverse(), { ...rows()[0], id: 'new', input: 'New', group: original[0].group }]);
  for (const row of original) assert.equal(extended.find(r => r.id === row.id).split, row.split);
  assert.equal(extended.at(-1).split, original[0].split);
});

test('review batches include uncertain cases and a random audit, never holdouts or reviewed rows', () => {
  const pool = rows().map((r, i) => ({ ...r, split: i < 8 ? 'train' : 'test', reviewed: i === 0 }));
  const predictions = pool.map((r, i) => ({ id: r.id, choice: 'Billing', probabilities: { Billing: i === 2 ? .5 : i === 3 ? .55 : .99, Support: i === 2 ? .5 : i === 3 ? .45 : .01 } }));
  const batch = selectTeachingBatch(pool, predictions, () => 0);
  assert.deepEqual(batch.map(r => r.id), ['2', '3', '1']);
  assert.deepEqual(batch.map(r => r.reason), ['uncertain', 'uncertain', 'audit']);
  assert.equal(new Set(batch.map(r => r.id)).size, 3);
  assert.equal(selectTeachingBatch(pool, [], () => 0).length, 0);
});

test('reviewed accuracy excludes holdouts, unreviewed and excluded labels', () => {
  const pool = rows().map((r, i) => ({ ...r, reviewed: i !== 0, excluded: i === 1, split: i < 4 ? 'train' : 'test' }));
  assert.deepEqual(teachingAccuracy(pool, pool.map(r => ({ id: r.id, choice: 'Billing', probabilities: { Billing: .9, Support: .1 } }))), { correct: 1, total: 2 });
});

test('draft export retains reserved splits and prevents related cases crossing a frozen boundary', () => {
  const assigned = assignTeachingSplits(rows()).map(r => ({ ...r, reviewed: true }));
  const draft = prepareTeachingDraft(task, assigned, false);
  for (const [split, cases] of Object.entries(draft.splits)) for (const row of cases) assert.equal(row.split, split);
  const corrupt = assigned.map(r => ({ ...r }));
  corrupt[1].split = corrupt[0].split === 'train' ? 'test' : 'train';
  assert.throws(() => prepareTeachingDraft(task, corrupt, false), /case|split/i);
  assert.throws(() => assignTeachingSplits(rows().map(r => ({ ...r, group: 'same' }))), /three|3|case/i);
});

test('identical inputs cannot enter assisted review in separate source cases', () => {
  const duplicate = [...rows(), { ...rows()[0], id: 'duplicate', input: '  REQUEST 0 ', group: 'unrelated' }];
  assert.throws(() => assignTeachingSplits(duplicate), /duplicate/i);
});

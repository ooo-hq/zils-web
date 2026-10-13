const { test } = require('node:test');
const assert = require('node:assert/strict');
const { importTeachingExamples, inspectTeachingExamples, prepareTeachingDraft, teachingTrainingFiles } = require('../.private/test-build/teach-by-example.js');
const { validateDatasets } = require('../.private/test-build/training.js');

const task = { kind: 'sort', goal: 'Route customer requests', rules: '', answers: ['Billing', 'Support'] };
const example = (id, input, output, extras = {}) => ({ id, input, output, group: '', reviewed: true, excluded: false, source: 'Pasted example', ...extras });
const examples = () => [
  example('1', 'Please send an invoice.', 'Billing'),
  example('2', 'My receipt is missing.', 'Billing'),
  example('3', 'Can I change my payment method?', 'Billing'),
  example('4', 'The app crashes.', 'Support'),
  example('5', 'My file will not open.', 'Support'),
  example('6', 'I cannot install the update.', 'Support'),
];

test('import keeps answers and case references out of the model input and requires review', () => {
  const rows = importTeachingExamples({ headers: ['Message', 'Context', 'Answer', 'Ticket ID'], rows: [['Hi', 'Paid plan', 'Billing', 'case-1']] }, { inputs: ['Message', 'Context'], answer: 'Answer', group: 'Ticket ID' }, 'tickets.csv');
  assert.equal(rows[0].input, 'Message: Hi\nContext: Paid plan');
  assert.equal(rows[0].output, 'Billing');
  assert.equal(rows[0].group, 'case-1');
  assert.equal(rows[0].reviewed, false);
  assert.throws(() => importTeachingExamples({ headers: ['Message', 'Answer'], rows: [['Hi', 'Billing']] }, { inputs: ['Answer'], answer: 'Answer', group: '' }, 'a.csv'), /separate/i);
});

test('drafts cannot include unreviewed, blank, conflicting, or duplicate examples', () => {
  for (const extra of [
    example('7', 'A new question', 'Billing', { reviewed: false }),
    example('7', 'A new question', ''),
    example('7', '  Please SEND an invoice. ', 'Support'),
    example('7', '  Please SEND an invoice. ', 'Billing'),
  ]) {
    const rows = [...examples(), extra];
    assert.ok(inspectTeachingExamples(task, rows, true).issues.length);
    assert.throws(() => prepareTeachingDraft(task, rows, true), /review|resolve|correct/i);
  }
  const rows = [...examples(), example('7', '', '', { reviewed: false, excluded: true })];
  assert.equal(prepareTeachingDraft(task, rows, true).counts.total, 6);
});

test('coverage requests missing outcomes and rejects insufficient independent cases', () => {
  const report = inspectTeachingExamples({ ...task, answers: [...task.answers, 'Account'] }, examples(), true);
  assert.ok(report.gaps.some(gap => gap.includes('Account')));
  assert.throws(() => prepareTeachingDraft(task, examples().map(row => ({ ...row, group: 'same-case' })), false), /case|review/i);
  assert.throws(() => prepareTeachingDraft(task, examples(), false), /case|review/i);
});

test('training, confidence checks, and final tests contain disjoint source cases', () => {
  const rows = examples().flatMap((row, i) => [
    { ...row, group: `case-${i}` },
    { ...row, id: `${row.id}-followup`, input: `${row.input} Here are more details.`, group: `case-${i}` },
  ]);
  const draft = prepareTeachingDraft(task, rows, false);
  const groups = ['train', 'calibration', 'test'].map(split => new Set(draft.splits[split].map(row => row.group)));
  assert.equal(draft.counts.total, 12);
  assert.equal(draft.previewOnly, true);
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) assert.equal([...groups[i]].filter(group => groups[j].has(group)).length, 0);
  for (const split of Object.values(draft.splits)) assert.deepEqual([...new Set(split.map(row => row.output))].sort(), ['Billing', 'Support']);
});

test('writing and extraction preserve the reviewed answer without requiring technical formatting', () => {
  const rows = examples().slice(0, 3).map(row => ({ ...row, output: 'A helpful complete reply.' }));
  assert.equal(prepareTeachingDraft({ ...task, kind: 'write', answers: [] }, rows, true).counts.total, 3);
  const extraction = rows.map(row => ({ ...row, output: 'Total: 42\nCurrency: USD' }));
  const draft = prepareTeachingDraft({ ...task, kind: 'extract', answers: [] }, extraction, true);
  assert.equal(draft.counts.total, 3);
  assert.equal(draft.splits.test[0].output, 'Total: 42\nCurrency: USD');
});

test('live decision datasets preserve reserved splits and exclude review metadata from model input', async () => {
  const rules = { ...task, rules: 'Route invoices to Billing.' };
  const draft = prepareTeachingDraft(rules, examples(), true);
  const files = await teachingTrainingFiles(draft, 'support-v1');
  assert.deepEqual(await validateDatasets(files), { train: draft.counts.train, calibration: draft.counts.calibration, test: draft.counts.test });
  for (const split of ['train', 'calibration', 'test']) {
    const rows = (await files[split].text()).trim().split('\n').map(JSON.parse);
    assert.deepEqual(rows.map(row => row.id), draft.splits[split].map(row => row.id));
    for (const row of rows) {
      const source = draft.splits[split].find(item => item.id === row.id);
      assert.equal(row.state, source.input);
      assert.equal(row.label, source.output);
      assert.equal(row.group_id, source.group);
      assert.equal(row.family, 'support-v1');
      assert.deepEqual(row.question, { type: 'choice', instructions: `${rules.goal}\n${rules.rules}`, criteria: { Billing: 'Billing', Support: 'Support' } });
      assert.ok(!('reviewed' in row) && !('source' in row) && !('rationale' in row));
    }
  }
});

test('live conversion rejects unsupported tasks, changed labels and crossed reserved groups', async () => {
  const draft = prepareTeachingDraft(task, examples(), true);
  await assert.rejects(teachingTrainingFiles({ ...draft, task: { ...task, kind: 'write' } }, 'support'), /decision/i);
  const invalid = structuredClone(draft);
  invalid.splits.test[0].output = 'Unrecognized';
  await assert.rejects(teachingTrainingFiles(invalid, 'support'), /review|answer/i);
  const crossed = structuredClone(draft);
  crossed.splits.test[0].group = crossed.splits.train[0].group;
  await assert.rejects(teachingTrainingFiles(crossed, 'support'), /split|case|review/i);
});

import { splitGroups, type ColumnMapping, type CsvData } from './training-csv';

export type TeachingTask = { kind: 'sort' | 'write' | 'extract'; goal: string; rules: string; answers: string[] };
export type TeachingExample = { id: string; input: string; output: string; group: string; reviewed: boolean; excluded: boolean; source: string };

export function importTeachingExamples(data: CsvData, mapping: ColumnMapping, source: string): TeachingExample[] {
  if (!mapping.inputs.length || !mapping.answer || [...mapping.inputs, mapping.answer, ...(mapping.group ? [mapping.group] : [])].some(field => !data.headers.includes(field))) throw new Error('Choose the information and the correct-answer columns.');
  if (mapping.inputs.includes(mapping.answer) || mapping.inputs.includes(mapping.group) || mapping.answer === mapping.group) throw new Error('Keep answers and case references separate from the information the model receives.');
  if (data.rows.length > 500) throw new Error('This local preview supports 500 examples. Choose a smaller sample.');
  const inputIndices = mapping.inputs.map(field => data.headers.indexOf(field));
  const answerIndex = data.headers.indexOf(mapping.answer), groupIndex = data.headers.indexOf(mapping.group);
  return data.rows.map((row, index) => ({
    id: crypto.randomUUID(),
    input: inputIndices.map((column, i) => mapping.inputs.length === 1 ? row[column] : `${mapping.inputs[i]}: ${row[column]}`).join('\n'),
    output: row[answerIndex], group: groupIndex < 0 ? '' : row[groupIndex],
    reviewed: false, excluded: false, source: `${source} · row ${data.sourceRows?.[index] ?? index + 2}`,
  }));
}

export function inspectTeachingExamples(task: TeachingTask, examples: TeachingExample[], independent: boolean) {
  const included = examples.filter(example => !example.excluded);
  const issues: { id: string; message: string }[] = [];
  const gaps: string[] = [];
  const seen = new Map<string, TeachingExample>();
  if (!task.goal.trim()) gaps.push('Describe the task you want the model to learn.');
  if (!included.length) gaps.push('Add at least one example to start teaching.');
  if (task.kind === 'sort' && (task.answers.length < 2 || task.answers.length > 16 || new Set(task.answers).size !== task.answers.length || task.answers.some(answer => !answer.trim() || answer.length > 100))) gaps.push('Choose 2–16 different possible answers, up to 100 characters each.');
  for (const example of included) {
    const issue = (message: string) => issues.push({ id: example.id, message });
    if (!example.input.trim()) issue('Add the information the model receives.');
    if (!example.output.trim()) issue('Add a correct answer before using this example.');
    else if (task.kind === 'sort' && !task.answers.includes(example.output.trim())) issue('This answer is not in your list. Correct it or update the task.');
    if (!example.reviewed) issue('Check this answer and mark it reviewed.');
    if (!independent && !example.group.trim()) issue('Add a case reference, or confirm that all examples are separate cases.');
    const key = example.input.trim().replace(/\s+/g, ' ').toLowerCase();
    const prior = seen.get(key);
    if (key && prior) {
      const message = prior.output.trim() === example.output.trim() ? 'Duplicate example. Keep one copy or add the missing context.' : 'These examples have the same input but conflicting answers. Correct them or add the missing context.';
      issues.push({ id: prior.id, message }); issue(message);
    } else seen.set(key, example);
  }
  const answers = task.kind === 'sort' ? task.answers : ['All examples'];
  const coverage = answers.map(answer => {
    const rows = included.filter(example => task.kind !== 'sort' || example.output.trim() === answer);
    const groups = new Set(rows.map(example => example.group.trim() || example.id)).size;
    if (groups < 3) gaps.push(task.kind === 'sort' ? `Add ${3 - groups} more separate ${answer} ${3 - groups === 1 ? 'case' : 'cases'} to keep examples for learning and testing.` : 'Add examples from at least 3 separate cases to preview a learning and test split.');
    return { answer, count: rows.length, groups };
  });
  return { included, issues, gaps, coverage, reviewed: included.filter(example => example.reviewed).length };
}

export function prepareTeachingDraft(task: TeachingTask, examples: TeachingExample[], independent: boolean) {
  const report = inspectTeachingExamples(task, examples, independent);
  if (report.issues.length || report.gaps.length) throw new Error('Resolve the review checks and add the missing cases before preparing a draft.');
  const groups = new Map<string, { id: string; rows: (TeachingExample & { label: string })[]; labels: Set<string> }>();
  for (const example of report.included) {
    const id = example.group.trim() || example.id;
    const label = task.kind === 'sort' ? example.output.trim() : 'example';
    const group = groups.get(id) || { id, rows: [], labels: new Set<string>() };
    group.rows.push({ ...example, input: example.input.trim(), output: example.output.trim(), group: id, label });
    group.labels.add(label); groups.set(id, group);
  }
  const splits = splitGroups([...groups.values()], task.kind === 'sort' ? task.answers : ['example']);
  // shortcut: this export is a reviewed onboarding draft, not a coordinator payload; add task-specific adapters before live submission.
  return { version: 1, previewOnly: true, task, splits, counts: { total: report.included.length, train: splits.train.length, calibration: splits.calibration.length, test: splits.test.length } };
}

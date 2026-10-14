import { splitGroups, type ColumnMapping, type CsvData } from './training-csv';
import { MAX_TEXT_OUTCOMES, SPLITS, submissionSchema, validateDatasets, type Split } from './training';

export type TeachingTask = { kind: 'sort' | 'write' | 'extract'; goal: string; rules: string; answers: string[] };
export type TeachingSplit = 'train' | 'calibration' | 'test';
export type TeachingExample = { id: string; input: string; output: string; group: string; reviewed: boolean; excluded: boolean; source: string; rationale?: string; split?: TeachingSplit };
export type TeachingPrediction = { id: string; choice: string; probabilities: Record<string, number> };

export function importTeachingExamples(data: CsvData, mapping: ColumnMapping, source: string): TeachingExample[] {
  if (!mapping.inputs.length || [...mapping.inputs, ...(mapping.answer ? [mapping.answer] : []), ...(mapping.group ? [mapping.group] : [])].some(field => !data.headers.includes(field))) throw new Error('Choose the information columns and, if available, the correct-answer column.');
  if (mapping.inputs.includes(mapping.answer) || mapping.inputs.includes(mapping.group) || (mapping.answer && mapping.answer === mapping.group)) throw new Error('Keep answers and case references separate from the information the model receives.');
  if (data.rows.length > 500) throw new Error('This local preview supports 500 examples. Choose a smaller sample.');
  const inputIndices = mapping.inputs.map(field => data.headers.indexOf(field));
  const answerIndex = data.headers.indexOf(mapping.answer), groupIndex = data.headers.indexOf(mapping.group);
  return data.rows.map((row, index) => ({
    id: crypto.randomUUID(),
    input: inputIndices.map((column, i) => mapping.inputs.length === 1 ? row[column] : `${mapping.inputs[i]}: ${row[column]}`).join('\n'),
    output: answerIndex < 0 ? '' : row[answerIndex], group: groupIndex < 0 ? '' : row[groupIndex],
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
  if (task.kind === 'sort' && (task.answers.length < 2 || task.answers.length > MAX_TEXT_OUTCOMES || new Set(task.answers).size !== task.answers.length || task.answers.some(answer => !answer.trim() || answer.length > 100))) gaps.push(`Choose 2–${MAX_TEXT_OUTCOMES} different possible answers, up to 100 characters each.`);
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
  const frozen = examples.some(row => row.split);
  const splits = frozen ? { train: [] as (TeachingExample & { label: string })[], calibration: [] as (TeachingExample & { label: string })[], test: [] as (TeachingExample & { label: string })[] } : splitGroups([...groups.values()], task.kind === 'sort' ? task.answers : ['example']);
  if (frozen) {
    const assignments = new Map(assignTeachingSplits(examples).map(row => [row.id, row.split!]));
    for (const group of groups.values()) for (const row of group.rows) {
      const split = assignments.get(row.id)!;
      splits[split].push({ ...row, split });
    }
    if (Object.values(splits).some(rows => !rows.length)) throw new Error('Keep at least one case in each reserved split. Restore excluded cases or start with more examples.');
  }
  // Portable drafts stay separate from the validated files used for live decision training.
  return { version: 1, previewOnly: true, task, splits, counts: { total: report.included.length, train: splits.train.length, calibration: splits.calibration.length, test: splits.test.length } };
}

export async function teachingTrainingFiles(draft: ReturnType<typeof prepareTeachingDraft>, name: string) {
  if (draft.task.kind !== 'sort') throw new Error('Live training supports decisions with fixed answers. Writing and extraction remain preparation drafts.');
  submissionSchema.shape.name.parse(name);
  const reviewed = prepareTeachingDraft(draft.task, SPLITS.flatMap(split => draft.splits[split].map(row => ({ ...row, split }))), true);
  const question = { type: 'choice', instructions: `${draft.task.goal}\n${draft.task.rules}`, criteria: Object.fromEntries(draft.task.answers.map(answer => [answer, answer])) };
  const files = Object.fromEntries(SPLITS.map(split => [split, new File([reviewed.splits[split].map(row => JSON.stringify({
    id: row.id, group_id: row.group, family: name, state: row.input, question, label: row.output,
  })).join('\n') + '\n'], `${split}.jsonl`, { type: 'application/x-ndjson' })])) as Record<Split, File>;
  await validateDatasets(files);
  return files;
}

export function assignTeachingSplits(examples: TeachingExample[]): TeachingExample[] {
  const key = (row: TeachingExample) => row.group.trim() || row.id;
  const inputs = new Set<string>();
  for (const row of examples.filter(row => !row.excluded)) {
    const input = row.input.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!input) throw new Error('Fill in each example’s input before assisted review.');
    if (inputs.has(input)) throw new Error('Duplicate inputs need review. Keep one copy or add the missing context before assisted review.');
    inputs.add(input);
  }
  const assignments = new Map<string, TeachingSplit>();
  for (const row of examples) if (row.split) {
    if (assignments.has(key(row)) && assignments.get(key(row)) !== row.split) throw new Error('Related cases cross reserved splits. Restore the original case references.');
    assignments.set(key(row), row.split);
  }
  const keys = [...new Set(examples.filter(row => !row.excluded).map(key))];
  if (keys.length < 3) throw new Error('Bring at least three separate cases before assisted review.');
  if (!assignments.size) {
    // Partition before predictions or labels influence selection; preserve these assignments in exports.
    const hash = (value: string) => { let n = 2166136261; for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
    keys.sort((a, b) => hash(a) - hash(b) || a.localeCompare(b));
    const held = Math.max(1, Math.floor(keys.length * .15));
    keys.forEach((id, i) => assignments.set(id, i < held ? 'test' : i < held * 2 ? 'calibration' : 'train'));
  } else for (const id of keys) if (!assignments.has(id)) assignments.set(id, 'train');
  return examples.map(row => ({ ...row, ...(assignments.has(key(row)) ? { split: assignments.get(key(row)) } : {}) }));
}

export function selectTeachingBatch(examples: TeachingExample[], predictions: TeachingPrediction[], random = Math.random) {
  const eligible = new Set(examples.filter(row => row.split === 'train' && !row.reviewed && !row.excluded).map(row => row.id));
  const margin = (p: TeachingPrediction) => { const sorted = Object.values(p.probabilities).sort((a, b) => b - a); return sorted[0] - sorted[1]; };
  const pool = predictions.filter(p => eligible.has(p.id)).sort((a, b) => margin(a) - margin(b));
  const uncertain = pool.slice(0, Math.min(2, Math.max(0, pool.length - 1))).map(p => ({ id: p.id, reason: 'uncertain' as const }));
  const remaining = pool.slice(uncertain.length);
  const audit = remaining.length ? [{ id: remaining[Math.floor(random() * remaining.length)].id, reason: 'audit' as const }] : [];
  return [...uncertain, ...audit];
}

export function teachingAccuracy(examples: TeachingExample[], predictions: TeachingPrediction[]) {
  const answers = new Map(examples.filter(row => row.split === 'train' && row.reviewed && !row.excluded).map(row => [row.id, row.output.trim()]));
  const compared = predictions.filter(p => answers.has(p.id));
  return { correct: compared.filter(p => p.choice === answers.get(p.id)).length, total: compared.length };
}

import { SPLITS, type Split } from './training';

export const MAX_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_ROWS = 20_000;
export type CsvData = { headers: string[]; rows: string[][] };
export type ColumnMapping = { inputs: string[]; answer: string; group: string };
export type Decision = { name: string; question: string; outcomes: string[] };
export type PreparedTraining = {
  files: Record<Split, File>;
  counts: Record<Split, number>;
  groups: number;
  total: number;
  distribution: { outcome: string; train: number; calibration: number; test: number }[];
  preview: { information: Record<string, string>; answer: string }[];
};

/** Strict comma-separated CSV, including quoted newlines, CRLF and escaped quotes. */
export function parseCsv(source: string): CsvData {
  if (new TextEncoder().encode(source).length > MAX_CSV_BYTES) throw new Error('Choose a CSV smaller than 10 MiB, or use advanced JSONL upload.');
  const text = source.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  function finishField() {
    row.push(field.trim()); field = ''; closed = false;
    if (row.length > 64) throw new Error('Use at most 64 columns. Export only the fields needed for this decision.');
  }
  function finishRow() {
    finishField();
    if (row.some(value => value !== '')) records.push(row);
    row = [];
    if (records.length > MAX_CSV_ROWS + 1) throw new Error('Use at most 20,000 examples per CSV, or use advanced JSONL upload.');
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += char;
    } else if (char === ',') finishField();
    else if (char === '\n' || char === '\r') { if (char === '\r' && text[i + 1] === '\n') i++; finishRow(); }
    else if (char === '"' && !field && !closed) quoted = true;
    else if (closed || char === '"') throw new Error(`CSV record ${records.length + 1}: misplaced quote. Export the spreadsheet as a comma-separated CSV again.`);
    else field += char;
  }
  if (quoted) throw new Error('The CSV ends inside a quoted cell. Close the quote or export the file again.');
  if (field || row.length || closed) finishRow();
  const headers = records.shift();
  if (!headers || headers.length < 2) throw new Error('Add a header row and at least two columns: the information to decide on and the correct answer.');
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) throw new Error('Give every column a unique, nonempty header.');
  if (!records.length) throw new Error('This CSV has headers but no examples. Add rows with information and a reviewed correct answer.');
  for (const [i, record] of records.entries()) if (record.length !== headers.length) throw new Error(`CSV record ${i + 2}: expected ${headers.length} cells, found ${record.length}. Check commas and quotes.`);
  return { headers, rows: records };
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

type Example = { id: string; group_id: string; family: string; state: { decision: string; information: Record<string, string> }; question: { type: 'choice'; criteria: Record<string, string> }; label: string };
type Group = { id: string; rows: Example[]; labels: Set<string> };

// Match Python's json.dumps defaults for its 128 KiB per-case limit, including
// non-ASCII text. UTF-8 byte length alone can underestimate that representation.
function coordinatorJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(coordinatorJson).join(', ')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${coordinatorJson(key)}: ${coordinatorJson(item)}`).join(', ')}}`;
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Whole source groups stay together. Coverage is required; ratios are approximate. */
function splitGroups(groups: Group[], outcomes: string[]): Record<Split, Example[]> {
  const frequency = new Map(outcomes.map(outcome => [outcome, groups.filter(group => group.labels.has(outcome)).length]));
  for (const outcome of outcomes) if (frequency.get(outcome)! < 3) throw new Error(`“${outcome}” needs examples from at least 3 independent source groups so it can appear in learning, confidence checks, and final evaluation. Add more reviewed examples or use independently prepared JSONL files.`);
  const rareFirst = [...outcomes].sort((a, b) => frequency.get(a)! - frequency.get(b)! || a.localeCompare(b));
  const ordered = [...groups].sort((a, b) => a.id.localeCompare(b.id));
  // A few stable orderings handle groups that contain more than one outcome.
  for (let attempt = 0; attempt < 24; attempt++) {
    const remaining = new Set(ordered);
    const assigned: Record<Split, Group[]> = { train: [], calibration: [], test: [] };
    const coverage: Record<Split, Set<string>> = { train: new Set(), calibration: new Set(), test: new Set() };
    let possible = true;
    for (const outcome of rareFirst) for (const split of SPLITS) {
      if (coverage[split].has(outcome)) continue;
      const choices = ordered.filter(group => remaining.has(group) && group.labels.has(outcome));
      if (!choices.length) { possible = false; break; }
      const group = choices[attempt % choices.length];
      assigned[split].push(group); remaining.delete(group);
      group.labels.forEach(label => coverage[split].add(label));
    }
    if (!possible) continue;
    const target = { train: 0.7, calibration: 0.15, test: 0.15 };
    const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
    const sizes = Object.fromEntries(SPLITS.map(split => [split, assigned[split].reduce((sum, group) => sum + group.rows.length, 0)])) as Record<Split, number>;
    for (const group of [...remaining].sort((a, b) => b.rows.length - a.rows.length || a.id.localeCompare(b.id))) {
      const split = [...SPLITS].sort((a, b) => (sizes[a] / (total * target[a])) - (sizes[b] / (total * target[b])))[0];
      assigned[split].push(group); sizes[split] += group.rows.length;
    }
    return Object.fromEntries(SPLITS.map(split => [split, assigned[split].flatMap(group => group.rows).sort((a, b) => a.id.localeCompare(b.id))])) as Record<Split, Example[]>;
  }
  throw new Error('These source groups could not be separated while keeping every answer in all three sets. Add independent examples, or use advanced upload with your own reviewed splits.');
}

export async function prepareTraining(csv: CsvData, mapping: ColumnMapping, decision: Decision, independent: boolean): Promise<PreparedTraining> {
  const outcomes = decision.outcomes.map(value => value.trim());
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(decision.name)) throw new Error('Use a project name with 1–64 lowercase letters, numbers, or hyphens.');
  if (!decision.question.trim() || decision.question.length > 1000) throw new Error('Describe the decision in 1–1,000 characters.');
  if (outcomes.length < 2 || outcomes.length > 50 || outcomes.some(value => !value || value.length > 100) || new Set(outcomes).size !== outcomes.length) throw new Error('Add 2–50 different possible answers, one per line (up to 100 characters each).');
  if (!mapping.answer || !csv.headers.includes(mapping.answer)) throw new Error('Choose the column containing the correct answer.');
  if (!mapping.inputs.length || mapping.inputs.some(name => !csv.headers.includes(name)) || new Set(mapping.inputs).size !== mapping.inputs.length) throw new Error('Choose at least one information column.');
  if (mapping.inputs.includes(mapping.answer) || (mapping.group && mapping.inputs.includes(mapping.group)) || mapping.group === mapping.answer) throw new Error('Keep the answer and source-group columns separate from the information used to make the decision.');
  if (mapping.group ? !csv.headers.includes(mapping.group) : !independent) throw new Error('Choose a source-group column, or confirm that every row is an independent case.');
  const inputs = [...mapping.inputs].sort();
  const seen = new Map<string, { answer: string; row: number }>();
  const groups = new Map<string, Group>();
  const criteria = Object.fromEntries(outcomes.map(outcome => [outcome, outcome]));
  const preview: PreparedTraining['preview'] = [];
  for (const [index, cells] of csv.rows.entries()) {
    const record = Object.fromEntries(csv.headers.map((header, i) => [header, cells[i]]));
    const answer = record[mapping.answer].trim();
    const row = index + 2;
    if (!answer) throw new Error(`CSV record ${row}: the correct answer is missing. Have someone review and label this case before training.`);
    if (!outcomes.includes(answer)) throw new Error(`CSV record ${row}: the answer does not match your allowed answers. Check spelling and capitalization in the CSV or edit your decision.`);
    const information = Object.fromEntries(inputs.map(header => [header, record[header]]));
    if (Object.values(information).every(value => !value.trim())) throw new Error(`CSV record ${row}: all selected information columns are empty.`);
    const fingerprint = JSON.stringify(information);
    const prior = seen.get(fingerprint);
    if (prior) throw new Error(`CSV records ${prior.row} and ${row} have identical information${prior.answer !== answer ? ' but conflicting answers' : ''}. Review them and keep one correct example, or include a missing field that distinguishes the cases.`);
    seen.set(fingerprint, { answer, row });
    const rawGroup = mapping.group ? record[mapping.group].trim() : fingerprint;
    if (!rawGroup) throw new Error(`CSV record ${row}: the source-group value is missing. Related records must stay together.`);
    const groupId = `group-${await digest(rawGroup)}`;
    const example: Example = { id: `case-${await digest(fingerprint)}`, group_id: groupId, family: decision.name, state: { decision: decision.question.trim(), information }, question: { type: 'choice', criteria }, label: answer };
    if (coordinatorJson(example).length > 128 * 1024) throw new Error(`CSV record ${row}: this example exceeds 128 KiB in the training format. Shorten its information or remove unnecessary columns.`);
    const group = groups.get(groupId) || { id: groupId, rows: [], labels: new Set<string>() };
    group.rows.push(example); group.labels.add(answer); groups.set(groupId, group);
    if (preview.length < 5) preview.push({ information, answer });
  }
  const splits = splitGroups([...groups.values()], outcomes);
  const files = Object.fromEntries(SPLITS.map(split => [split, new File([splits[split].map(coordinatorJson).join('\n') + '\n'], `${decision.name}-${split}.jsonl`, { type: 'application/x-ndjson' })])) as Record<Split, File>;
  return {
    files,
    counts: Object.fromEntries(SPLITS.map(split => [split, splits[split].length])) as Record<Split, number>,
    total: csv.rows.length,
    groups: groups.size,
    distribution: outcomes.map(outcome => ({ outcome, ...Object.fromEntries(SPLITS.map(split => [split, splits[split].filter(row => row.label === outcome).length])) } as PreparedTraining['distribution'][number])),
    preview,
  };
}

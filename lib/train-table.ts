import { leaks, reviewData, suggestMapping, type ReviewEdits } from './training-review';
import type { ColumnMapping, CsvData } from './training-csv';
import { MAX_TEXT_OUTCOMES } from './training';

/** The table page's columns: what the model reads, the one column it decides, the case column, and the rest. */
export type Columns = { decide: string; group: string; reads: string[]; unused: string[] };
export type AnswerType =
  | { type: 'yesno' | 'choice'; answers: string[] }
  | { type: 'numbers' | 'toomany'; count: number }
  | { type: 'single'; answer: string }
  | { type: 'missing' };

const ANSWER_NAME = /answer|label|decision|outcome|target|class|category|action|result|team|verdict|condition/i;
const GROUP_NAME = /^(customer|account|user|client|case|conversation|thread|order)[_ ]?id$/i;
const ID_NAME = /(^|_)(id|uuid|key|ticket|ref|reference|number|no)($|_)/i;
const YES = ['yes', 'true', 'y'], NO = ['no', 'false', 'n'];

/** A first guess the visitor corrects by clicking column names. Give-away columns start out of use, as in the SDK. */
export function guessColumns(data: CsvData): Columns {
  const suggestion = suggestMapping(data);
  const decide = suggestion.answer || data.headers.find(h => ANSWER_NAME.test(h)) || data.headers.at(-1) || '';
  // A case column groups only if its values repeat; one value per row is just an ID.
  const repeats = (h: string) => { const i = data.headers.indexOf(h); return new Set(data.rows.map(r => r[i])).size < data.rows.length; };
  const group = [suggestion.group, ...data.headers.filter(h => GROUP_NAME.test(h))].find(h => h && h !== decide && repeats(h)) || '';
  const rest = data.headers.filter(h => h !== decide && h !== group);
  const giveaways = new Set(leaks(data, decide, rest).map(leak => leak.column));
  const unused = rest.filter(h => ID_NAME.test(h) || giveaways.has(h));
  return { decide, group, reads: rest.filter(h => !unused.includes(h)), unused };
}

/** What kind of answer a column holds. Yes or no and picks 1 of N train today; numbers with many values come later. */
export function answerType(values: string[]): AnswerType {
  const seen = values.map(v => v.trim()).filter(Boolean);
  if (!seen.length) return { type: 'missing' };
  const distinct = [...new Set(seen)];
  if (distinct.length === 1) return { type: 'single', answer: distinct[0] };
  if (distinct.length === 2 && distinct.every(v => [...YES, ...NO].includes(v.toLowerCase()))) {
    return { type: 'yesno', answers: distinct.sort(a => YES.includes(a.toLowerCase()) ? -1 : 1) };
  }
  if (distinct.length > Math.max(20, seen.length / 2) || distinct.length > MAX_TEXT_OUTCOMES) {
    return { type: seen.every(v => Number.isFinite(Number(v))) ? 'numbers' : 'toomany', count: distinct.length };
  }
  return { type: 'choice', answers: distinct.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) };
}

export function answerLabel(answer: AnswerType) {
  switch (answer.type) {
    case 'yesno': return 'yes or no';
    case 'choice': return `picks 1 of ${answer.answers.length}`;
    case 'numbers': return 'numbers';
    case 'toomany': return `${answer.count.toLocaleString()} different values`;
    case 'single': return 'needs a second answer';
    case 'missing': return 'no answers';
  }
}

/** The mapping, answers and readiness report the existing preparation takes, with flagged rows left out. */
export function readiness(data: CsvData, columns: Columns) {
  const mapping: ColumnMapping = { inputs: columns.reads, answer: columns.decide, group: columns.group };
  const index = data.headers.indexOf(columns.decide);
  const answer = answerType(index < 0 ? [] : data.rows.map(row => row[index] ?? ''));
  const outcomes = answer.type === 'yesno' || answer.type === 'choice' ? answer.answers : [];
  const first = reviewData(data, mapping, outcomes, {});
  const edits: ReviewEdits = Object.fromEntries(first.issues.map(issue => [issue.index, { excluded: true }]));
  const report = reviewData(data, mapping, outcomes, edits);
  const d = columns.decide;
  const problem = !d ? 'Move a column to the right of the line: that is what it decides.'
    : !columns.reads.length ? 'Keep at least one column on the left of the line: that is what it reads.'
    : answer.type === 'numbers' ? `${d} holds ${answer.count.toLocaleString()} different numbers. Training on numbers comes later; choose a column with a few answers.`
    : answer.type === 'toomany' ? `${d} has ${answer.count.toLocaleString()} different values, too many to choose between. Move it back to the left.`
    : answer.type === 'single' ? `Every answer in ${d} is “${answer.answer}”. A decision needs at least two different answers.`
    : answer.type === 'missing' ? `${d} has no answers.`
    : outcomes.some(o => o.length > 100) ? `Answers in ${d} must be 100 characters or less.`
    : report.blockers[0] || '';
  return { mapping, outcomes, answer, independent: !columns.group, report, left: Object.keys(edits).length, problem };
}

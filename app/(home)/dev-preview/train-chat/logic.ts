// The train-chat prototype's pure logic, shared by the page and its evaluation (.private/eval): what the assistant
// sees of a file, the rule-based agent, and the check that keeps the assistant's choice to columns the rows support.
import { ID_NAME, guessRoles, infer, type Dataset, type Inferred, type Role } from '../train-box/data';

export type Roles = Record<string, Role>;
export type FileSummary = {
  name: string; kind: Dataset['kind']; rows: number;
  columns: { name: string; kind: 'yes_no' | 'choice' | 'number' | 'free_text' | 'id' | 'empty'; samples: string[]; distinct: number }[];
};

export const SOUNDS_LIKE_A_DECISION = /urgent|priority|fraud|flag|risk|approv|status|escalat/i;
export const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3);
export const named = (column: string) => column.replaceAll('_', ' ');
export const valid = (q: Inferred) => q.type === 'yesno' || q.type === 'choice' || q.type === 'score';
export const listed = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
export const values = (data: Dataset, column: string) => data.rows.map(r => r[column] ?? '');
export const decidedIn = (roles: Roles) => Object.keys(roles).filter(c => roles[c] === 'decides');

/** Text it reads, never the answer: sentences (a typical value of four or more words), or every row different and
    not a number. Answers are short: "Billing", "Tech support", "yes". */
export function freeText(data: Dataset, column: string) {
  const v = values(data, column).filter(x => x.trim());
  if (!v.length) return false;
  const words = v.map(x => x.trim().split(/\s+/).length).sort((a, b) => a - b);
  return words[Math.floor(words.length / 2)] >= 4 || (new Set(v).size === v.length && !v.every(x => Number.isFinite(Number(x))));
}
export const decidable = (data: Dataset, column: string) => !ID_NAME.test(column) && !freeText(data, column) && valid(infer(values(data, column)));

/** What the assistant sees: column names, kinds and five sample values, never the whole file. */
export function summary(data: Dataset): FileSummary {
  return { name: data.name, kind: data.kind, rows: data.rows.length, columns: data.columns.map(c => {
    const v = values(data, c).filter(x => x.trim()), q = infer(v);
    const kind = !v.length ? 'empty' : ID_NAME.test(c) ? 'id' : freeText(data, c) ? 'free_text' : q.type === 'yesno' ? 'yes_no' : q.type === 'score' ? 'number' : q.type === 'choice' ? 'choice' : 'free_text';
    return { name: c, kind, samples: [...new Set(v)].slice(0, 5).map(x => x.slice(0, 200)), distinct: new Set(v).size };
  }) };
}

/** The scripted fallback: the goal names the decision when one of its words is in a column name. */
export function scriptedRoles(data: Dataset, goal: string): Roles {
  const roles = guessRoles(data);
  if (data.kind !== 'table') return roles;
  for (const c of data.columns) if (roles[c] === 'reads' && SOUNDS_LIKE_A_DECISION.test(c) && !freeText(data, c)) roles[c] = 'unused';
  const words = tokens(goal);
  const match = data.columns.find(c => decidable(data, c) && tokens(named(c)).some(t => words.some(w => t.startsWith(w.slice(0, 5)) || w.startsWith(t.slice(0, 5)))));
  if (!match || roles[match] === 'decides') return roles;
  return Object.fromEntries(Object.entries(roles).map(([c, r]) => [c, c === match ? 'decides' : r === 'decides' ? 'reads' : r]));
}
export function scriptedSuggestion(data: Dataset, roles: Roles) {
  return data.kind !== 'table' ? undefined : data.columns.find(c => roles[c] !== 'decides' && SOUNDS_LIKE_A_DECISION.test(c) && decidable(data, c));
}

/** The assistant's choice, kept only where the real rows agree: decided columns must hold answers, reads must exist. */
export function checkedRoles(data: Dataset, reply: { reads: string[]; decides: string[] }): Roles | null {
  const decide = reply.decides.filter(c => data.columns.includes(c) && decidable(data, c));
  if (!decide.length) return null;
  // An ID tells the model nothing about the answer: drop it whatever the assistant says.
  const read = data.kind === 'table' ? reply.reads.filter(c => data.columns.includes(c) && !decide.includes(c) && !ID_NAME.test(c)) : data.columns.filter(c => !decide.includes(c));
  if (!read.length) return null;
  return Object.fromEntries([...data.columns.filter(c => !decide.includes(c)).map(c => [c, read.includes(c) ? 'reads' : 'unused'] as const), ...decide.map(c => [c, 'decides'] as const)]);
}

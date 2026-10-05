import type { ColumnMapping, CsvData } from './training-csv';

export type ReviewEdit = { answer?: string; excluded?: boolean; confirmed?: boolean; needsReview?: boolean };
export type ReviewEdits = Record<number, ReviewEdit>;
export type ReviewIssue = { index: number; message: string };
export type DataReview = ReturnType<typeof reviewData>;
const normalized = (header: string) => header.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Suggestions deliberately leave unknown fields unselected for client review. */
export function suggestMapping(data: CsvData): ColumnMapping {
  const answerNames = ['correct_decision', 'correct_answer', 'expected_answer', 'expected_label', 'correct_label', 'label', 'answer', 'decision', 'outcome', 'category', 'team'];
  const answer = answerNames.map(name => data.headers.find(header => normalized(header) === name)).find(Boolean) || '';
  const group = data.headers.find(header => /^(case_group|group_id|source_group|ticket_id|conversation_id|case_id|order_id|document_id)$/.test(normalized(header))) || '';
  const inputs = data.headers.filter(header => header !== answer && header !== group && /^(information|customer_message|context|message|text|body|subject|description|input|request|ticket_text|content)$/.test(normalized(header)));
  return { inputs, answer, group };
}

export function suggestAnswers(data: CsvData, answer: string): string[] {
  const index = data.headers.indexOf(answer);
  if (index < 0) return [];
  const values = [...new Set(data.rows.map(row => row[index].trim()).filter(Boolean))];
  return values.length <= 16 && values.every(value => value.length <= 100) ? values : [];
}

/** Corrections are a separate draft; the original spreadsheet is never changed. */
export function reviewData(data: CsvData, mapping: ColumnMapping, outcomes: string[], edits: ReviewEdits) {
  const answerIndex = data.headers.indexOf(mapping.answer);
  const groupIndex = data.headers.indexOf(mapping.group);
  const inputIndices = [...mapping.inputs].sort().map(header => data.headers.indexOf(header));
  const issues: ReviewIssue[] = [];
  const blockers: string[] = [];
  const rows: string[][] = [], sourceRows: number[] = [], includedIndices: number[] = [];
  const seen = new Map<string, { index: number; answer: string }>();
  const groups = new Map(outcomes.map(answer => [answer, new Set<string>()]));
  const counts = new Map(outcomes.map(answer => [answer, 0]));
  let excluded = 0, confirmed = 0;
  if (answerIndex < 0) blockers.push('Choose the column containing the correct answer.');
  if (!inputIndices.length || inputIndices.includes(-1)) blockers.push('Choose the information available before the decision.');
  if (outcomes.length < 2 || outcomes.length > 16 || new Set(outcomes).size !== outcomes.length || outcomes.some(answer => !answer || answer.length > 100)) blockers.push('Add 2–16 different possible answers, up to 100 characters each.');
  for (const [index, original] of data.rows.entries()) {
    const edit = edits[index] || {};
    if (edit.excluded) { excluded++; continue; }
    const row = [...original];
    if (answerIndex >= 0 && edit.answer !== undefined) row[answerIndex] = edit.answer.trim();
    const answer = answerIndex >= 0 ? row[answerIndex].trim() : '';
    const information = inputIndices.map(column => row[column] || '');
    const fingerprint = JSON.stringify(information);
    const group = groupIndex >= 0 ? row[groupIndex].trim() : fingerprint;
    const issue = (message: string) => issues.push({ index, message });
    if (!answer) issue('Choose the correct answer for this example.');
    else if (!outcomes.includes(answer)) issue(`“${answer}” is not a possible answer. Correct it here or update the decision.`);
    if (edit.needsReview) issue('An expert still needs to review this example. Confirm its answer or leave it out.');
    if (information.every(value => !value.trim())) issue('The selected information is empty. Choose another field or leave this example out.');
    if (mapping.group && !group) issue('The case reference is missing. Fix it in the spreadsheet or leave this example out.');
    const prior = seen.get(fingerprint);
    if (prior && inputIndices.length) {
      const message = prior.answer === answer ? 'Identical information appears more than once. Keep one example or select a field that distinguishes the cases.' : 'Identical information has conflicting answers. Correct the answers and keep one example, or select a distinguishing field.';
      issue(message);
      if (!issues.some(item => item.index === prior.index && item.message === message)) issues.push({ index: prior.index, message });
    } else seen.set(fingerprint, { index, answer });
    if (groups.has(answer)) { groups.get(answer)!.add(group); counts.set(answer, counts.get(answer)! + 1); }
    if (edit.confirmed && !edit.needsReview) confirmed++;
    rows.push(row); sourceRows.push(data.sourceRows?.[index] ?? index + 2); includedIndices.push(index);
  }
  if (!rows.length) blockers.push('Keep at least one example. All examples have been left out.');
  const distribution = outcomes.map(answer => ({ answer, count: counts.get(answer) || 0, groups: groups.get(answer)?.size || 0 }));
  for (const item of distribution) if (item.groups < 3) blockers.push(`“${item.answer}” needs at least 3 separate cases to appear in training and both evaluation sets.`);
  const sample = [...new Set([
    ...outcomes.map(answer => includedIndices.find(index => (edits[index]?.answer ?? data.rows[index][answerIndex]) === answer)).filter((index): index is number => index !== undefined),
    ...issues.slice(0, 10).map(issue => issue.index),
    ...Array.from({ length: Math.min(20, includedIndices.length) }, (_, index) => includedIndices[Math.floor(index * includedIndices.length / Math.min(20, includedIndices.length))]),
  ])].slice(0, 20);
  return { data: { headers: data.headers, rows, sourceRows }, issues, blockers, sample, distribution, excluded, confirmed, included: rows.length };
}

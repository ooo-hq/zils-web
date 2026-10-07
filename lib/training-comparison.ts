import { MAX_COMPARISON_BYTES, type Job } from './training';

export function trainingComparison(job: Job) {
  if (job.status !== 'completed' || job.result?.delivery.status !== 'accepted') return null;
  const selected = job.result.miners.find(row => row.uid === job.result?.delivery.uid && row.status === 'evaluated');
  if (selected?.accuracy === undefined || selected.brier === undefined) return null;
  const baseline = job.result.baseline;
  const difference = selected.accuracy - baseline.accuracy;
  const count = selected.cases ?? baseline.cases ?? job.dataset_counts?.test;
  return {
    baseline: { ...baseline, name: job.selection?.previous ? 'Previous trained model' : job.model?.name ?? 'Starting model' },
    selected: { accuracy: selected.accuracy, brier: selected.brier }, count,
    difference,
    title: Math.abs(difference) < 1e-9 ? 'Same accuracy on the selection test' : difference > 0 ? 'Higher accuracy on the selection test' : 'Lower accuracy on the selection test',
    probabilityImproved: selected.brier < baseline.brier - 1e-9,
  };
}

export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export const points = (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}`;

export function correctCount(accuracy: number, count?: number) {
  if (!count || Math.abs(accuracy * count - Math.round(accuracy * count)) > 1e-6) return null;
  return `${Math.round(accuracy * count)} of ${count} correct`;
}

export async function validateComparisonFile(file: Blob) {
  if (!file.size || file.size > MAX_COMPARISON_BYTES) throw new Error('Choose a nonempty JSONL file, up to 5 MiB.');
  const lines = (await file.text()).split(/\r?\n/).filter(line => line.trim());
  if (!lines.length || lines.length > 500) throw new Error('Use 1–500 new test examples.');
  for (const [index, line] of lines.entries()) {
    let row;
    try { row = JSON.parse(line); } catch { throw new Error(`Line ${index + 1}: invalid JSON.`); }
    if (!row || typeof row !== 'object' || ['id', 'group_id', 'family', 'label'].some(key => typeof row[key] !== 'string' || !row[key]) || !('state' in row) || !row.question || typeof row.question !== 'object') throw new Error(`Line ${index + 1}: requires id, group_id, family, state, question, and label.`);
  }
  return lines.length;
}

import record from '@/public/model/abcd-002.json';

export const supportStudy = record;
export const supportBase = record.test.metrics.base;
export const supportAdapter = record.test.metrics.candidate;
export const supportGain = record.test.accuracy_gain_percentage_points.toFixed(1);
export const supportErrorReduction = ((supportAdapter.correct - supportBase.correct) / (supportBase.count - supportBase.correct) * 100).toFixed(0);
export const supportSource = '/model/abcd-002.json';
export const supportMethod = '/model/abcd-002.md';
export const supportComparisons = [
  { name: 'Unchanged JevK5', note: 'No ABCD-specific training', metrics: supportBase, trained: false },
  { name: 'Trained JevK5', note: 'Trained on 1,024 separate conversations', metrics: supportAdapter, trained: true },
] as const;

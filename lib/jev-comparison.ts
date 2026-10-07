import record from '@/public/model/abcd-002-jev.json';

export const jevStudy = record;
export const jevMetrics = record.test.metrics.jev;
export const jevTrained = record.test.metrics.trained_jevk5;
export const jevPaired = record.test.comparisons.trained_vs_jev;
export const jevGain = jevPaired.accuracy_gain_percentage_points.toFixed(1);
export const jevErrorReduction = ((jevTrained.correct - jevMetrics.correct) / (jevMetrics.n - jevMetrics.correct) * 100).toFixed(1);
export const jevSource = '/model/abcd-002-jev.json';
export const jevMethod = '/model/abcd-002-jev.md';
export const jevPredictions = '/model/abcd-002-jev-predictions.json';
export const jevComparisons = [
  { name: 'Shared Zils', note: 'No ABCD-specific training', metrics: { ...record.test.metrics.shared_jevk5, count: record.test.metrics.shared_jevk5.n }, trained: false },
  { name: 'TypeSafe Jev 1.13', note: 'Hosted Jev 1.13.0 · Same inputs and choices', metrics: { ...jevMetrics, count: jevMetrics.n }, trained: false },
  { name: 'Trained Zils', note: 'Trained on 1,024 separate conversations', metrics: { ...jevTrained, count: jevTrained.n }, trained: true },
] as const;

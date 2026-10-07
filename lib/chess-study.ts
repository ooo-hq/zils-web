import study from '@/public/model/chess-001.json';
import protocol from '@/public/model/chess-001-protocol.json';

export const chessStudy = study;
export const chessProtocol = protocol;
export const chessComparisons = [
  { key: 'trained', name: 'Chess-trained Zils', note: 'Fresh adapter · 2,048 training positions', adapted: true },
  { key: 'jev', name: 'TypeSafe Jev 1.13.0', note: 'Regular Jev · same test inputs', adapted: false },
  { key: 'shared', name: 'Shared Zils', note: 'No chess-specific adapter', adapted: false },
].map(row => ({
  ...row,
  metrics: study.results[row.key as keyof typeof study.results],
  correct: study.independent_audit.models[row.key as keyof typeof study.independent_audit.models].correct,
}));

export const chessPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
export const chessPoints = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}`;

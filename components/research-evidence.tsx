import { jevPaired, jevTrained, jevMetrics, jevPredictions } from '@/lib/jev-comparison';
import s from './research-guide.module.css';

export function ResearchEvidence() {
  const outcomes = [
    { label: 'Both correct', count: jevPaired.both_correct, style: s.bothCorrect },
    { label: 'Only trained model correct', count: jevPaired.trained_correct_other_wrong, style: s.trainedOnly },
    { label: 'Only JEV correct', count: jevPaired.other_correct_trained_wrong, style: s.jevOnly },
    { label: 'Both incorrect', count: jevPaired.both_wrong, style: s.bothWrong },
  ];
  let offset = 0;
  return (
    <figure className={s.evidenceFigure} aria-labelledby="paired-results-title">
      <figcaption id="paired-results-title" className={s.figureTitle}>
        <span>One test. {jevTrained.n} support decisions.</span>
        <span>Trained with Zils compared with TypeSafe JEV</span>
      </figcaption>
      <svg className={s.evidenceMatrix} viewBox="0 0 398 198" aria-hidden="true">
        {outcomes.map(outcome => {
          const start = offset;
          offset += outcome.count;
          return <g key={outcome.label} className={outcome.style} data-outcome={outcome.label}>
            {Array.from({ length: outcome.count }, (_, i) => {
              const index = start + i;
              return <rect key={i} x={(index % 25) * 16 + 1} y={Math.floor(index / 25) * 10 + 1} width="12" height="6" rx="1" />;
            })}
          </g>;
        })}
      </svg>
      <p className={s.matrixNote}>Each mark is one conversation. Grouped by outcome.</p>
      <dl className={s.matrixLegend}>
        {outcomes.map(outcome => <div key={outcome.label}>
          <dt><span className={`${s.swatch} ${outcome.style}`} aria-hidden="true" />{outcome.label}</dt>
          <dd>{outcome.count}</dd>
        </div>)}
      </dl>
      <div className={s.figureResult}><p><strong>{jevTrained.correct - jevMetrics.correct} more correct decisions</strong><span>On this test, with the same inputs and choices.</span></p><a href={jevPredictions}>View all 500 predictions</a></div>
    </figure>
  );
}

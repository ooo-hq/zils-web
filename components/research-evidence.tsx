import { jevPaired, jevTrained, jevMetrics, jevPredictions } from '@/lib/jev-comparison';
import { OutcomeGrid } from '@/components/site/outcome-grid';
import s from './research-guide.module.css';

export function ResearchEvidence() {
  const outcomes = [
    { label: 'Both correct', count: jevPaired.both_correct, color: 'rgba(var(--zs-fg-rgb), .3)' },
    { label: 'Only trained model correct', count: jevPaired.trained_correct_other_wrong, color: 'var(--zs-lilac)' },
    { label: 'Only JEV correct', count: jevPaired.other_correct_trained_wrong, color: 'var(--zs-orange)' },
    { label: 'Both incorrect', count: jevPaired.both_wrong, color: 'transparent' },
  ];
  return (
    <figure className={s.evidenceFigure} aria-labelledby="paired-results-title">
      <figcaption id="paired-results-title" className={s.figureTitle}>
        <span>One test. {jevTrained.n} support decisions.</span>
        <span>Trained with Zils compared with TypeSafe JEV</span>
      </figcaption>
      <OutcomeGrid groups={outcomes} />
      <p className={s.matrixNote}>Each mark is one conversation. Grouped by outcome.</p>
      <dl className={s.matrixLegend}>
        {outcomes.map(outcome => <div key={outcome.label}>
          <dt><span className={s.swatch} style={{ background: outcome.color }} aria-hidden="true" />{outcome.label}</dt>
          <dd>{outcome.count}</dd>
        </div>)}
      </dl>
      <div className={s.figureResult}><p><strong>{jevTrained.correct - jevMetrics.correct} more correct decisions</strong><span>On this test, with the same inputs and choices.</span></p><a href={jevPredictions}>View all 500 predictions</a></div>
    </figure>
  );
}

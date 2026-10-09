import { supportBase, supportAdapter } from '@/lib/support-study';
import { jevMetrics } from '@/lib/jev-comparison';
import { chessStudy, chessPercent } from '@/lib/chess-study';
import { flightImprovement, flightSplits } from '@/lib/flight-study';
import { benchmark, readComparison } from '@/lib/model-benchmark';
import s from './research-guide.module.css';

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

export function ResearchOverview() {
  const { fez, kev } = readComparison(benchmark);
  const studies = [
    {
      href: '#jev-comparison', title: 'Choose the next support action', scope: `${supportBase.count} test conversations · ABCD`,
      result: `${percent(supportBase.accuracy)} → ${percent(supportAdapter.accuracy)}`, measure: 'Accuracy before → after training',
      comparison: `TypeSafe Jev: ${percent(jevMetrics.accuracy)} on the same test.`,
      meaning: 'Training improved agreement with recorded actions. This does not measure whether the whole customer issue was resolved.',
    },
    {
      href: '#chess-study', title: 'Find a checkmate in one move', scope: '512 test positions · Lichess puzzles',
      result: `${chessPercent(chessStudy.results.shared.accuracy)} → ${chessPercent(chessStudy.results.trained.accuracy)}`, measure: 'Accuracy before → after training',
      comparison: `TypeSafe Jev: ${chessPercent(chessStudy.results.jev.accuracy)}. Chess-rules software: 100%.`,
      meaning: 'Specialization helped on this restricted task. It does not establish full-game chess strength or an advantage over a rules engine.',
    },
    {
      href: '#flight-study', title: 'Estimate the risk of a late flight', scope: `${flightSplits.test.count.toLocaleString('en-US')} later test flights · US flight records`,
      result: `${flightImprovement}% less probability error`, measure: 'Relative Brier reduction vs the base model',
      comparison: 'Historical delay rates had the best measured score.',
      meaning: 'The adapter improved risk estimates but did not meet the requirement to beat both baselines. No flight model was deployed.',
    },
    {
      href: '#quality', title: 'Earlier public decision benchmark', scope: `${fez.metrics.n_attempted} public items · Kev 0.8B model line`,
      result: `${fez.metrics.n_correct} correct for Zils; ${kev.metrics.n_correct} for Kev`, measure: 'Same accuracy; worse probability estimates',
      comparison: 'The unchanged published Kev checkpoint is the baseline.',
      meaning: 'This earlier run did not establish an improvement. Its tasks, models, and scoring differ from the studies above.',
    },
  ];
  return (
    <section id="findings" aria-labelledby="findings-heading" className={s.overview}>
      <div className={s.sectionHeading}>
        <h2 id="findings-heading">What we’ve measured.</h2>
        <p>Read each result against its own task and baseline. These experiments do not form a single leaderboard.</p>
      </div>
      <div className={s.columnLabels} aria-hidden="true"><span>Decision task</span><span>Recorded result</span><span>Interpretation</span></div>
      <div className={s.studies}>
        {studies.map(study => <article key={study.href} className={s.study}>
          <div><h3><a href={study.href}>{study.title}</a></h3><p className={s.scope}>{study.scope}</p></div>
          <div><p className={s.result}>{study.result}</p><p className={s.measure}>{study.measure}</p><p className={s.comparator}>{study.comparison}</p></div>
          <p className={s.meaning}>{study.meaning}</p>
        </article>)}
      </div>
      <p className={s.note}>Support training and the Jev comparison reuse the same trained model and 500 test cases. They are two comparisons of one experiment, not independent replications.</p>
    </section>
  );
}

export function ResearchModelGuide() {
  return (
    <section id="approach" aria-labelledby="approach-heading" className={s.approach}>
      <div className={s.sectionHeading}>
        <h2 id="approach-heading">What we’re training.</h2>
        <p>A model that assigns probabilities to a set of possible answers. Each experiment tests a specific decision, such as which action to take next.</p>
      </div>
      <ol className={s.process}>
        <li><span className={s.step}>1</span><div><h3>Start with a shared model.</h3><p>The support, flight, and chess studies use the published JevK5 4B weights. This unchanged model is the baseline for measuring what training adds.</p></div></li>
        <li><span className={s.step}>2</span><div><h3>Teach one task with an adapter.</h3><p>A LoRA adapter is a small set of learned weights added to the model. The base weights stay frozen while the adapter learns from examples for that task.</p></div></li>
        <li><span className={s.step}>3</span><div><h3>Test on separate examples.</h3><p>Compare models on the same held-out cases. Measure correctness, probability quality, and simple alternatives. Test data does not select the adapter.</p></div></li>
      </ol>
      <details className={s.details}>
        <summary>Model names, comparison controls, and deployment status</summary>
        <div className={s.detailBody}>
          <dl className={s.definitions}>
            <div><dt>Shared Zils and trained Zils</dt><dd>Shared Zils is the unadapted JevK5 4B baseline. Trained Zils adds the task-specific adapter; the support, flight, and chess adapters are separate models.</dd></div>
            <div><dt>TypeSafe Jev</dt><dd>The external hosted comparator is Jev 1.13.0. It receives the same test inputs and choices. The support comparison reuses recorded Zils predictions and makes fresh Jev API calls; their timing measurements are not comparable.</dd></div>
            <div><dt>Earlier Kev 0.8B</dt><dd>A different model line, used in the archived JevBench comparison. Its percentages and probability-error scores should not be mixed with the newer studies.</dd></div>
            <div><dt>Research and deployment</dt><dd>The research adapters shown here have not been deployed. A benchmark result is evidence about that experiment; it is not a measurement of the shared playground or a guarantee for a customer-trained model.</dd></div>
          </dl>
          <p>Each study records its own split, selection rule, and evaluation protocol. The support study selects a checkpoint on development data; the flight study calibrates probabilities on a later, separate month; the chess study reserves calibration data but does not use it. A held-out test prevents direct training leakage, but cannot rule out public-data exposure during base-model pretraining.</p>
        </div>
      </details>
      <a href="#metrics" className={s.metricLink}>How to read accuracy, confidence, and uncertainty</a>
    </section>
  );
}

export function ResearchMetricGuide() {
  return (
    <section id="metrics" aria-labelledby="metrics-heading" className={s.metrics}>
      <div className={s.sectionHeading}>
        <h2 id="metrics-heading">Read the numbers.</h2>
        <p>Being correct and knowing how likely you are to be correct are different properties. We report both.</p>
      </div>
      <dl className={s.definitions}>
        <div><dt>Accuracy</dt><dd>The fraction of decisions that match the test answer. On the support test, 396 / 500 = 79.2%. It measures the recorded next action, not the success of an entire conversation.</dd></div>
        <div><dt>Percentage points vs fewer mistakes</dt><dd>79.2% − 70.6% = an 8.6-point accuracy gain. The same result is 43 fewer errors out of Jev’s 147, or 29.3% fewer mistakes. These describe the same comparison using different denominators.</dd></div>
        <div><dt>Confidence and coverage</dt><dd>Confidence here is the probability assigned to the chosen answer. Coverage is the share of cases above a probability threshold. High accuracy on a small confident subset does not mean high accuracy on all cases.</dd></div>
        <div><dt>Calibration</dt><dd>Among predictions assigned about 90% probability, roughly 90% should be correct. A model can improve accuracy while remaining overconfident. ECE summarizes the gap between confidence and accuracy across bins.</dd></div>
      </dl>
      <details className={s.details}>
        <summary>Technical reference: Brier, F1, ROC-AUC, NLL, and intervals</summary>
        <div className={s.detailBody}>
          <dl className={s.definitions}>
            <div><dt>Brier score · lower is better</dt><dd>Mean squared probability error. For binary flight outcomes: mean((p − y)²), where y is 0 or 1. For multiclass decisions, sum the squared errors across choices before averaging. Different formulations and tasks have different scales; compare within a study.</dd></div>
            <div><dt>Macro F1 · higher is better</dt><dd>F1 balances precision and recall for an answer category. Macro F1 averages the category scores equally, so frequent answers do not dominate the result. The support calculation uses categories with support in the test set.</dd></div>
            <div><dt>ROC-AUC · higher is better</dt><dd>Measures how well scores rank positive cases above negative ones across thresholds. In the flight study, it describes delay-risk ranking. It does not show that the probabilities are calibrated or that a chosen alert threshold works.</dd></div>
            <div><dt>Negative log likelihood · lower is better</dt><dd>Penalizes low probability on a correct answer. The chess study uses −log(total probability on all checkmating moves), so positions with multiple valid moves receive appropriate credit.</dd></div>
            <div><dt>Paired 95% bootstrap intervals</dt><dd>Resample the test units and recalculate the difference while keeping models paired on the same cases. Support uses conversations, chess uses games, and flight uses whole dates. These intervals estimate test-sample uncertainty; they do not measure variation across training seeds or future domains.</dd></div>
            <div><dt>Reproducibility</dt><dd>Protocols, reports, result files, prediction records where published, and hashes let readers inspect the evidence. They do not imply every checkpoint is distributed or every run can be reproduced from the repository alone. Check each study’s artifact and release limits.</dd></div>
          </dl>
        </div>
      </details>
    </section>
  );
}

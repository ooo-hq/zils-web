import Link from 'next/link';
import {
  supportStudy, supportBase, supportAdapter, supportGain, supportErrorReduction,
  supportComparisons, supportSource, supportMethod,
} from '@/lib/support-study';

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const number = (value: number) => value.toLocaleString('en-US');
const link = 'underline decoration-edge-strong underline-offset-4 hover:text-accent hover:decoration-accent';
const cell = 'border-t border-edge px-4 py-4 text-right tabular-nums';

function AccuracyComparison() {
  return (
    <figure aria-label="Accuracy on 500 untouched support conversations" className="min-w-0 rounded-md bg-surface p-6 sm:p-8">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">Correct next actions</span>
        <span className="text-xs text-muted">Same 500 test conversations</span>
      </figcaption>
      <dl className="mt-8 space-y-8">
        {supportComparisons.map(({ name, note, metrics, trained }) => (
          <div key={name}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className={`text-sm ${trained ? 'font-semibold text-accent' : 'text-ink'}`}>{name}</dt>
              <dd className={`text-[32px] font-semibold leading-none tracking-[-0.045em] tabular-nums ${trained ? 'text-accent' : 'text-ink'}`}>{percent(metrics.accuracy)}</dd>
            </div>
            <div aria-hidden="true" className="mt-3 h-3 overflow-hidden rounded-sm bg-edge">
              <div className={`h-full rounded-sm ${trained ? 'bg-accent' : 'bg-[#858898]'}`} style={{ width: `${metrics.accuracy * 100}%` }} />
            </div>
            <dd className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs leading-5 text-muted">
              <span>{note}</span><span className="tabular-nums">{metrics.correct} / {metrics.count} correct</span>
            </dd>
          </div>
        ))}
      </dl>
      <div aria-hidden="true" className="mt-5 flex justify-between text-[11px] tabular-nums text-subtle"><span>0%</span><span>100%</span></div>
      <p className="mt-6 border-t border-edge pt-5 text-sm leading-6">
        <strong className="font-semibold text-accent">+{supportGain} percentage points</strong>
        <span className="text-muted"> · {supportAdapter.correct - supportBase.correct} more correct decisions</span>
      </p>
    </figure>
  );
}

export function SupportStudySummary() {
  return (
    <section id="support-evidence" aria-labelledby="support-evidence-heading" className="mx-auto max-w-5xl scroll-mt-8 border-t border-edge px-6 py-20 sm:px-8">
      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-xs text-muted">ABCD support-workflow study · October 2026</p>
          <h2 id="support-evidence-heading" className="mt-4 max-w-[18ch] text-[clamp(2rem,4.4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.055em]">Training improved support decisions.</h2>
          <p className="mt-5 max-w-[45ch] text-[15px] leading-7 text-muted">
            We trained JevK5 to choose the next support tool from {supportStudy.splits.action_choices} options.
            On {supportBase.count} untouched conversations, it made <strong className="font-semibold text-ink">{supportErrorReduction}% fewer mistakes</strong> after training.
          </p>
          <p className="mt-5 text-sm text-muted">{number(supportStudy.splits.training_conversations)} training conversations. Separate development and test sets.</p>
          <Link href="/model#support-study" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-action px-5 py-3 text-[13px] font-medium text-on-action hover:bg-action-hover">See the comparison</Link>
        </div>
        <AccuracyComparison />
      </div>
      <p className="mt-7 max-w-[80ch] text-xs leading-6 text-muted">Measured agreement with recorded actions in public role-play conversations. This is a task-specific research result; confidence remains imperfect.</p>
    </section>
  );
}

export function SupportStudyDetails() {
  const test = supportStudy.test;
  const baseline = supportStudy.development.baseline;
  const checkpoints = supportStudy.development.candidates;
  const metrics = [
    ['Before training', supportBase], ['After training', supportAdapter],
    ['Previous-action frequency', test.metrics.previous_action_frequency],
    ['Training-action frequency', test.metrics.training_action_frequency],
  ] as const;
  return (
    <section id="support-study" aria-labelledby="support-study-heading" className="scroll-mt-20 border-t border-edge py-16 sm:py-20">
      <p className="text-xs text-muted">Completed experiment · 6 October 2026 · ABCD support conversations</p>
      <h2 id="support-study-heading" className="mt-4 max-w-[24ch] text-[clamp(2.1rem,4.4vw,3.3rem)] font-semibold leading-[1.04] tracking-[-0.055em]">Better at choosing the next support action.</h2>
      <p className="mt-5 max-w-[68ch] text-[15px] leading-7 text-muted">After training on {number(supportStudy.splits.training_conversations)} separate conversations, JevK5’s accuracy rose from {percent(supportBase.accuracy)} to {percent(supportAdapter.accuracy)} on the untouched test set. The task was to choose the next recorded support action from all {supportStudy.splits.action_choices} tool choices.</p>

      <div className="mt-10 grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.035em]">Learn, select, then test.</h3>
          <ol className="mt-5 divide-y divide-edge border-y border-edge">
            {[
              ['Train', `${number(supportStudy.splits.training_conversations)} conversations`, 'One fixed recipe. Three saved checkpoints.'],
              ['Select', `${supportStudy.splits.development_conversations} development conversations`, 'Choose the strongest qualifying checkpoint.'],
              ['Test', `${supportStudy.splits.test_conversations} untouched conversations`, 'Freeze the adapter, then compare both models on identical cases.'],
            ].map(([label, count, note], i) => <li key={label} className="flex gap-4 py-5"><span aria-hidden="true" className="pt-0.5 text-xs text-subtle">{i + 1}</span><div><h4 className="text-sm font-semibold">{label} · {count}</h4><p className="mt-1 text-xs leading-6 text-muted">{note}</p></div></li>)}
          </ol>
          <p className="mt-5 text-sm leading-6 text-muted">The adapter corrected {test.paired_cases_improved} baseline mistakes and introduced {test.paired_cases_worsened} new ones. Total mistakes fell from {supportBase.count - supportBase.correct} to {supportAdapter.count - supportAdapter.correct}.</p>
        </div>
        <AccuracyComparison />
      </div>

      <div className="mt-10 grid gap-6 border-y border-edge py-6 sm:grid-cols-3">
        {[
          ['Accuracy gain', `+${supportGain} points`, 'On the final test set'],
          ['Fewer mistakes', `${supportErrorReduction}%`, 'Compared with before training'],
          ['Lower probability error', `${test.brier_relative_improvement_percent.toFixed(1)}%`, 'Relative decrease in multiclass Brier score'],
        ].map(([label, value, note]) => <div key={label}><p className="text-xs text-muted">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-0.035em] tabular-nums">{value}</p><p className="mt-2 text-xs leading-5 text-subtle">{note}</p></div>)}
      </div>
      <p className="mt-5 text-sm leading-7 text-muted">The 95% interval for the accuracy gain is <strong className="font-medium text-ink">+{test.accuracy_gain_95_percent_paired_bootstrap_percentage_points[0].toFixed(1)} to +{test.accuracy_gain_95_percent_paired_bootstrap_percentage_points[1].toFixed(1)} percentage points</strong>, from 2,000 paired resamples of test conversations. The trained adapter also beat both simple frequency baselines.</p>

      <details className="group mt-8 rounded-md border border-edge">
        <summary className="cursor-pointer px-5 py-5 text-sm font-semibold marker:text-accent hover:text-accent">All scores, training checkpoints, and methodology</summary>
        <div className="border-t border-edge p-5 sm:p-6">
          <div role="region" aria-label="Support study final test scores" tabIndex={0} className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[580px] border-collapse text-sm">
              <caption className="pb-4 text-left text-xs leading-6 text-muted">Final test only. Same 500 conversations. Higher accuracy and macro F1 are better; lower Brier error is better.</caption>
              <thead><tr><th scope="col" className="px-4 py-3 text-left font-medium">Model</th><th scope="col" className="px-4 py-3 text-right font-medium">Accuracy</th><th scope="col" className="px-4 py-3 text-right font-medium">Macro F1</th><th scope="col" className="px-4 py-3 text-right font-medium">Brier error</th></tr></thead>
              <tbody>{metrics.map(([name, metric]) => <tr key={name}><th scope="row" className="border-t border-edge px-4 py-4 text-left font-normal">{name}</th><td className={cell}>{percent(metric.accuracy)}</td><td className={cell}>{metric.macro_f1.toFixed(4)}</td><td className={cell}>{metric.multiclass_brier.toFixed(6)}</td></tr>)}</tbody>
            </table>
          </div>
          <div role="region" aria-label="Development checkpoint scores" tabIndex={0} className="mt-8 overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <caption className="pb-4 text-left text-xs leading-6 text-muted">Development results used for selection. These are a separate set of 500 conversations, not the final test above.</caption>
              <thead><tr><th scope="col" className="px-4 py-3 text-left font-medium">Training examples</th><th scope="col" className="px-4 py-3 text-right font-medium">Accuracy</th><th scope="col" className="px-4 py-3 text-right font-medium">Brier error</th></tr></thead>
              <tbody>{[{ checkpoint_examples: 0, ...baseline }, ...checkpoints].map(row => <tr key={row.checkpoint_examples}><th scope="row" className="border-t border-edge px-4 py-4 text-left font-normal">{row.checkpoint_examples === 0 ? 'Before training' : number(row.checkpoint_examples)}</th><td className={cell}>{percent(row.accuracy)}</td><td className={cell}>{row.multiclass_brier.toFixed(6)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-8 space-y-5 text-sm leading-7 text-muted">
            <p><strong className="font-medium text-ink">What the model sees.</strong> The conversation so far, previously completed tool calls and their results, and a compact catalog of workflow sequences. The current answer, future turns, and labeled workflow metadata are excluded. Each case comes from a distinct conversation in its official split.</p>
            <p><strong className="font-medium text-ink">One fixed recipe.</strong> JevK5 4B with an attention-only rank-16 LoRA adapter, one epoch, learning rate 0.00001, and seed 553. The base weights stayed frozen. Training used groups of 15 or 16 answer choices; every evaluation offered all 30 through JevK5’s native selection process. Published temperatures stayed at 1.22 and 0.93; no confidence recalibration was fitted.</p>
            <p><strong className="font-medium text-ink">Selection before testing.</strong> A checkpoint needed at least 59% development accuracy, lower Brier error, and no macro-F1 regression. Highest accuracy won among qualifying checkpoints. All three qualified; the 1,024-example checkpoint was frozen before the final test.</p>
            <p><strong className="font-medium text-ink">How improvement is measured.</strong> The +{supportGain}-point gain is the difference in accuracy. The {supportErrorReduction}% figure is the relative reduction in mistakes. The {test.brier_relative_improvement_percent.toFixed(1)}% probability improvement is the relative reduction in multiclass Brier error, the summed squared difference between predicted probabilities and the recorded answer.</p>
          </div>
        </div>
      </details>

      <div className="mt-8 rounded-md bg-surface p-5 sm:p-6">
        <h3 className="text-sm font-semibold">What this result establishes</h3>
        <p className="mt-2 text-sm leading-7 text-muted">Training improved next-action prediction on ABCD’s public support role-play conversations. It does not measure complete conversation success, flight prediction, or customer readiness. This used an isolated research training runner; the full customer-facing training service was not evaluated.</p>
        <p className="mt-3 text-sm leading-7 text-muted">Confidence still runs high: {supportAdapter.confident_wrong_at_90_percent} of {supportAdapter.confident_cases_at_90_percent} predictions made with at least 90% confidence were wrong. One recipe and one training seed were tested. Public-data exposure during base-model pretraining cannot be ruled out. The adapter has not been deployed.</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <a href={supportMethod} className={link}>Study report</a>
        <a href={supportSource} className={link}>Recorded results (JSON)</a>
        <a href="/model/abcd-002-protocol.json" className={link}>Frozen protocol</a>
        <a href={supportStudy.dataset.url} className={link}>ABCD dataset</a>
      </div>
    </section>
  );
}

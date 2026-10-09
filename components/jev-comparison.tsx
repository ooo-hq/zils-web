import { AccuracyComparison } from '@/components/support-study';
import {
  jevStudy, jevMetrics, jevTrained, jevPaired, jevGain, jevErrorReduction,
  jevComparisons, jevSource, jevMethod, jevPredictions,
} from '@/lib/jev-comparison';

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const link = 'underline decoration-edge-strong underline-offset-4 hover:text-accent hover:decoration-accent';
const cell = 'border-t border-edge px-4 py-4 text-right tabular-nums';

export function JevComparisonDetails() {
  const interval = jevPaired.accuracy_gain_95_ci_percentage_points;
  return (
    <section id="jev-comparison" aria-labelledby="jev-comparison-heading" className="scroll-mt-20 border-t border-edge py-16 sm:py-20">
      <p className="text-xs text-muted">Completed comparison · 6 October 2026 · 500 ABCD test conversations</p>
      <h2 id="jev-comparison-heading" className="mt-4 max-w-[24ch] text-[clamp(2.1rem,4.4vw,3.3rem)] font-semibold leading-[1.04] tracking-[-0.055em]">Support decisions: more correct next actions.</h2>
      <p className="mt-5 max-w-[68ch] text-[15px] leading-7 text-muted">Given a customer conversation, its previous actions, and a workflow guide, choose the next action from {jevStudy.splits.action_choices} options. ABCD is a public dataset of support role-play conversations; the recorded action is the test answer.</p>
      <p className="mt-4 max-w-[68ch] text-[15px] leading-7 text-muted">Trained Zils matched that answer {percent(jevTrained.accuracy)} of the time, compared with {percent(jevMetrics.accuracy)} for TypeSafe Jev 1.13.0. Both received the same inputs, instructions, and choices.</p>

      <div className="mt-10 grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.035em]">What the comparison holds fixed</h3>
          <p className="mt-4 text-sm leading-7 text-muted">The Zils adapter trained on {jevStudy.splits.training_conversations.toLocaleString('en-US')} separate conversations and was selected on a different development set. Its weights were frozen before the final test cases were prepared.</p>
          <p className="mt-4 text-sm leading-7 text-muted">We then called TypeSafe’s hosted Jev API on those same test inputs. The Zils scores reuse verified predictions from the completed training study. No test answers were sent to either model, and no model or prompt was tuned during this comparison.</p>
          <p className="mt-4 text-sm leading-7 text-muted">Trained Zils got <strong className="font-medium text-ink">{jevPaired.trained_correct_other_wrong} cases right that Jev missed</strong>. Jev got {jevPaired.other_correct_trained_wrong} right that our trained model missed.</p>
        </div>
        <AccuracyComparison includeJev />
      </div>

      <div className="mt-10 grid gap-6 border-y border-edge py-6 sm:grid-cols-3">
        {[
          ['Accuracy gain', `+${jevGain} points`, 'Compared with TypeSafe Jev'],
          ['Fewer mistakes', `${jevErrorReduction}%`, `${jevMetrics.n - jevMetrics.correct} mistakes reduced to ${jevTrained.n - jevTrained.correct}`],
          ['More correct actions', String(jevTrained.correct - jevMetrics.correct), 'Across the same 500 conversations'],
        ].map(([label, value, note]) => <div key={label}><p className="text-xs text-muted">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-0.035em] tabular-nums">{value}</p><p className="mt-2 text-xs leading-5 text-subtle">{note}</p></div>)}
      </div>
      <p className="mt-5 text-sm leading-7 text-muted">The 95% interval for the accuracy advantage is <strong className="font-medium text-ink">+{interval[0].toFixed(1)} to +{interval[1].toFixed(1)} percentage points</strong>, from 2,000 paired resamples of test conversations. This measures uncertainty across these conversations, not across different training runs.</p>

      <div className="mt-8 rounded-md bg-surface p-5 sm:p-6">
        <h3 className="text-lg font-semibold">Confidence is a separate test.</h3>
        <p className="mt-2 text-sm leading-7 text-muted">Jev was more accurate among its smaller set of answers assigned at least 90% probability. Our model assigned that probability to more cases, but made more mistakes within them. These groups contain different cases and have different coverage.</p>
        <div role="region" aria-label="Jev comparison confidence and coverage" tabIndex={0} className="mt-5 overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[540px] border-collapse text-sm">
            <caption className="pb-3 text-left text-xs leading-6 text-muted">Probability of the chosen action ≥90%. TypeSafe’s separate confidence field is not used.</caption>
            <thead><tr><th scope="col" className="px-4 py-3 text-left font-medium">Model</th><th scope="col" className="px-4 py-3 text-right font-medium">Cases / 500</th><th scope="col" className="px-4 py-3 text-right font-medium">Mistakes</th><th scope="col" className="px-4 py-3 text-right font-medium">Accuracy in group</th></tr></thead>
            <tbody>{jevComparisons.map(({ name, metrics }) => {
              const coverage = metrics.coverage.find(row => row.threshold === .9)!;
              return <tr key={name}><th scope="row" className="border-t border-edge px-4 py-4 text-left font-normal">{name}</th><td className={cell}>{coverage.automated}</td><td className={cell}>{coverage.wrong}</td><td className={cell}>{percent(coverage.accuracy_among_automated!)}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </div>

      <details className="group mt-8 rounded-md border border-edge">
        <summary className="cursor-pointer px-5 py-5 text-sm font-semibold marker:text-accent hover:text-accent">All scores, API checks, and method</summary>
        <div className="border-t border-edge p-5 sm:p-6">
          <div role="region" aria-label="Jev comparison full test scores" tabIndex={0} className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[580px] border-collapse text-sm">
              <caption className="pb-4 text-left text-xs leading-6 text-muted">All 500 cases included. Higher accuracy and macro F1 are better; lower Brier probability error is better.</caption>
              <thead><tr><th scope="col" className="px-4 py-3 text-left font-medium">Model</th><th scope="col" className="px-4 py-3 text-right font-medium">Accuracy</th><th scope="col" className="px-4 py-3 text-right font-medium">Macro F1</th><th scope="col" className="px-4 py-3 text-right font-medium">Brier error</th></tr></thead>
              <tbody>{jevComparisons.map(({ name, metrics }) => <tr key={name}><th scope="row" className="border-t border-edge px-4 py-4 text-left font-normal">{name}</th><td className={cell}>{percent(metrics.accuracy)}</td><td className={cell}>{metrics.macro_f1.toFixed(4)}</td><td className={cell}>{metrics.multiclass_brier.toFixed(6)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
            <p><strong className="font-medium text-ink">Model foundation.</strong> Trained Zils combines the published JevK5 4B weights with our ABCD-specific adapter.</p>
            <p><strong className="font-medium text-ink">Identical evidence.</strong> Each model received the prior conversation, completed actions and results, compact workflow catalog, and the same ordered choices. Current answers, future turns, and labeled workflow metadata were excluded. Each case comes from a distinct conversation.</p>
            <p><strong className="font-medium text-ink">Preserved API responses.</strong> All 500 Jev calls returned answers. {jevMetrics.distributions_normalized} probability vectors summed to 0.99; they were normalized for Brier scoring. One returned choice differed from its probability ranking. Accuracy uses the returned choice; using the highest-probability option instead gives {percent(jevMetrics.canonical_argmax_correct / jevMetrics.n)}. No cases were dropped or re-queried.</p>
            <p><strong className="font-medium text-ink">Usage and timing.</strong> Jev reported {jevMetrics.total_input_tokens.toLocaleString('en-US')} input tokens, an estimated ${jevStudy.test.jev_api_cost_usd.toFixed(5)} at the provider’s listed rate. API response time includes networking; the earlier Zils timings measure local GPU inference. They do not establish a comparable speed advantage.</p>
          </div>
        </div>
      </details>

      <p className="mt-6 max-w-[80ch] text-sm leading-7 text-muted">This measures recorded next-action agreement in public role-play conversations. It does not establish complete conversation success or a general model ranking. One training recipe and seed were used; public-data pretraining overlap cannot be excluded. The prompt was developed for Zils and was not separately optimized for Jev. The research adapter has not been deployed.</p>
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <a href={jevMethod} className={link}>Comparison report</a>
        <a href={jevSource} className={link}>Recorded results (JSON)</a>
        <a href={jevPredictions} className={link}>All 500 paired predictions</a>
        <a href="#support-study" className={link}>Original training study</a>
      </div>
    </section>
  );
}

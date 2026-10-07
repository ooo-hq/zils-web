import Link from 'next/link';
import {
  flightStudy, flightSplits, flightSource, flightMethod, flightImprovement, flightComparisons,
} from '@/lib/flight-study';

const number = (value: number) => value.toLocaleString('en-US');
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const link = 'underline decoration-edge-strong underline-offset-4 hover:text-accent hover:decoration-accent';
const cell = 'border-t border-edge px-4 py-4 text-right tabular-nums';

function ProbabilityComparison() {
  return (
    <figure className="min-w-0 rounded-md bg-surface p-6 sm:p-8">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">Probability error</span>
        <span className="text-xs text-muted">Brier score · Lower is better</span>
      </figcaption>
      <dl className="mt-7 space-y-6">
        {flightComparisons.map(({ name, note, metrics, adapted }) => (
          <div key={name}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className={`text-sm ${adapted ? 'font-semibold text-accent' : 'text-ink'}`}>{name}</dt>
              <dd className={`text-sm tabular-nums ${adapted ? 'font-semibold text-accent' : 'text-ink'}`}>{metrics.brier.toFixed(4)}</dd>
            </div>
            <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-sm bg-edge">
              <div className={`h-full rounded-sm ${adapted ? 'bg-accent' : 'bg-[#858898]'}`} style={{ width: `${metrics.brier / 0.2 * 100}%` }} />
            </div>
            <dd className="mt-2 text-xs leading-5 text-muted">{note}</dd>
          </div>
        ))}
      </dl>
      <div aria-hidden="true" className="mt-5 flex justify-between text-[11px] tabular-nums text-subtle"><span>0</span><span>0.20</span></div>
      <p className="mt-5 border-t border-edge pt-4 text-xs leading-5 text-muted">
        Both models had their confidence scores adjusted on separate February data. All three were tested on the same March flights.
      </p>
    </figure>
  );
}

export function FlightStudySummary() {
  return (
    <section id="flight-evidence" aria-labelledby="flight-evidence-heading" className="mx-auto max-w-5xl scroll-mt-8 border-t border-edge px-6 py-20 sm:px-8">
      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-xs text-muted">Public flight-data study · October 2026</p>
          <h2 id="flight-evidence-heading" className="mt-4 max-w-[17ch] text-[clamp(2rem,4.4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.055em]">
            Training improved flight-risk predictions.
          </h2>
          <p className="mt-5 max-w-[45ch] text-[15px] leading-7 text-muted">
            We trained a Zils adapter on real flight outcomes, then tested it on later flights held out of adapter training.
            Its probability error was <strong className="font-semibold text-ink">{flightImprovement}% lower than the base model’s</strong>.
          </p>
          <p className="mt-5 text-sm text-muted">
            <span className="font-semibold tabular-nums">{number(flightSplits.train.count)}</span> training flights
            <span aria-hidden="true" className="mx-3 text-neutral-400">/</span>
            <span className="font-semibold tabular-nums">{number(flightSplits.test.count)}</span> held-out test flights
          </p>
          <Link href="/model#flight-study" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-[#4942c7] px-5 py-3 text-[13px] font-medium text-white hover:bg-[#39339f]">
            Read the flight study
          </Link>
        </div>
        <ProbabilityComparison />
      </div>
      <p className="mt-7 max-w-[78ch] text-xs leading-6 text-muted">
        Historical delay rates scored slightly better than the adapter. This experiment demonstrates improvement over the base on one task; it does not establish a deployment-ready flight predictor.
      </p>
    </section>
  );
}

export function FlightStudyDetails() {
  const improvement = flightStudy.adapter_brier_improvement;
  const rawRows = [
    ['Shared Zils, raw', flightStudy.metrics.base_raw],
    ['Flight-trained Zils, raw', flightStudy.metrics.adapter_raw],
  ] as const;

  return (
    <section id="flight-study" aria-labelledby="flight-study-heading" className="scroll-mt-20 border-t border-edge py-16 sm:py-20">
      <p className="text-xs text-muted">Completed experiment · 5 October 2026 UTC</p>
      <h2 id="flight-study-heading" className="mt-4 max-w-[23ch] text-[clamp(2.1rem,4.4vw,3.3rem)] font-semibold leading-[1.04] tracking-[-0.055em]">
        A base model. A flight adapter. A measurable improvement.
      </h2>
      <p className="mt-5 max-w-[68ch] text-[15px] leading-7 text-muted">
        Could training on past flights improve Zils’ estimates of arrival delays?
        On {number(flightSplits.test.count)} held-out flights, the trained adapter reduced probability error by {flightImprovement}% versus the base.
        A simple historical-rate baseline still had the best measured score.
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.035em]">Learn from the past. Test on later flights.</h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            Public US Bureau of Transportation Statistics records, departing JFK, LGA, and EWR.
            The decision: will a completed flight arrive at least 15 minutes late?
          </p>
          <ol className="mt-6 divide-y divide-edge border-y border-edge">
            {[
              ['January 2025', 'Train the adapter', flightSplits.train.count],
              ['February 2025', 'Adjust confidence scores', flightSplits.calibration.count],
              ['March 2025', 'Test both models', flightSplits.test.count],
            ].map(([date, purpose, count]) => (
              <li key={date} className="flex items-center justify-between gap-4 py-4">
                <div><p className="text-sm font-medium">{purpose}</p><p className="mt-1 text-xs text-muted">{date}</p></div>
                <p className="whitespace-nowrap text-sm tabular-nums">{number(Number(count))} flights</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs leading-6 text-muted">
            Only scheduled information entered the model: date, airline, route, times, duration, and distance. Actual delays and arrival times supplied the answers for training and scoring, never the prediction inputs.
          </p>
        </div>
        <ProbabilityComparison />
      </div>

      <div className="mt-10 grid gap-8 border-y border-edge py-8 md:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.03em]">What training improved</h3>
          <p className="mt-3 text-sm leading-7 text-muted">
            The adapter produced better probability estimates and ranked delay risk more accurately.
            Its risk-ranking score (ROC-AUC) rose from {flightStudy.metrics.base_calibrated.roc_auc.toFixed(3)} to {flightStudy.metrics.adapter_calibrated.roc_auc.toFixed(3)}.
            The measured probability-error improvement over the base was supported by a 95% interval that stayed above zero.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.03em]">Where it fell short</h3>
          <p className="mt-3 text-sm leading-7 text-muted">
            Historical rates scored slightly better; the difference was uncertain.
            The experiment required the adapter to beat both references. It did not meet that bar, and no model was deployed from this run.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-md bg-soft p-6">
        <h3 className="font-semibold">Why {percent(flightStudy.metrics.adapter_calibrated.accuracy)} accuracy is not the headline</h3>
        <p className="mt-2 max-w-[78ch] text-sm leading-7 text-muted">
          Most flights were not late. At a 50% probability cutoff, the adapter predicted “not late” for every flight and flagged none of the {flightSplits.test.late} late arrivals.
          The improvement was in its risk estimates, not in useful delay alerts at that threshold. An alert threshold needs its own validation.
        </p>
      </div>

      <details className="group mt-8 rounded-md border border-edge">
        <summary className="cursor-pointer px-5 py-5 text-sm font-semibold marker:text-accent hover:text-accent">All scores, methodology, and limitations</summary>
        <div className="border-t border-edge p-5 sm:p-6">
          <div role="region" aria-label="Flight study model scores" tabIndex={0} className="overflow-x-auto">
            <table className="w-full min-w-[580px] border-collapse text-sm">
              <caption className="pb-4 text-left text-xs leading-6 text-muted">Same {number(flightSplits.test.count)} test flights. Lower Brier error is better; higher ROC-AUC is better.</caption>
              <thead><tr><th scope="col" className="px-4 py-3 text-left font-medium">Model</th><th scope="col" className="px-4 py-3 text-right font-medium">Brier error</th><th scope="col" className="px-4 py-3 text-right font-medium">Accuracy</th><th scope="col" className="px-4 py-3 text-right font-medium">ROC-AUC</th></tr></thead>
              <tbody>
                {[
                  ...flightComparisons.map(row => [row.name === 'Historical delay rates' ? row.name : `${row.name}, calibrated`, row.metrics] as const),
                  ...rawRows,
                ].map(([name, metrics]) => <tr key={name}><th scope="row" className="border-t border-edge px-4 py-4 text-left font-normal">{name}</th><td className={cell}>{metrics.brier.toFixed(6)}</td><td className={cell}>{percent(metrics.accuracy)}</td><td className={cell}>{metrics.roc_auc.toFixed(4)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="mt-8 space-y-5 text-sm leading-7 text-muted">
            <p><strong className="font-medium text-ink">What the percentage means.</strong> The {flightImprovement}% headline is the relative decrease in binary Brier error: (base error − adapter error) ÷ base error. It is not a percentage-point increase in accuracy. Binary Brier is the average squared difference between the predicted chance of a late arrival and what happened.</p>
            <p><strong className="font-medium text-ink">A fair comparison.</strong> Both models had their confidence adjusted independently using February data only. Raw temperatures were 1.22 for the base and 1.0 for the adapter; fitted temperatures were {flightStudy.temperatures.base.toFixed(6)} and {flightStudy.temperatures.adapter.toFixed(6)}. Historical rates used the same January sample, grouped by airline, origin, and four-hour departure window, with smoothing toward the overall rate.</p>
            <p><strong className="font-medium text-ink">Uncertainty.</strong> We resampled whole test dates {number(improvement.base_calibrated.resamples)} times. The 95% interval for adapter Brier improvement versus the base was [{improvement.base_calibrated.ci95.map(value => `+${value.toFixed(6)}`).join(', ')}]. Versus historical rates it was [{improvement.historical_rate.ci95.map(value => `${value > 0 ? '+' : ''}${value.toFixed(6)}`).join(', ')}], crossing zero. Positive values favor the adapter.</p>
            <p><strong className="font-medium text-ink">One fixed training recipe.</strong> JevK5 4B, one epoch, rank-16 LoRA, seed {flightStudy.training.seed}. The base weights stayed frozen. Training took {(flightStudy.training.training_seconds / 60).toFixed(1)} minutes on an RTX 4090. Median forward calls took {flightStudy.median_forward_ms.base.toFixed(1)} ms for the base and {flightStudy.median_forward_ms.adapter.toFixed(1)} ms for the adapter, excluding tokenization, loading, and API overhead. These are recorded timings, not a serving guarantee.</p>
            <p><strong className="font-medium text-ink">Scope and limits.</strong> One recipe, three airports, one season, and {improvement.base_calibrated.date_clusters} test dates. Canceled and diverted flights were excluded, so this does not cover all scheduled flights. There were no live weather, congestion, or inbound-aircraft feeds. Public records may have appeared in base-model pretraining. Historical schedules are not a timestamped record of what was known at booking time. This result does not establish general improvement or customer readiness.</p>
          </div>
        </div>
      </details>

      <nav aria-label="Flight study evidence" className="mt-7 flex flex-wrap gap-x-6 gap-y-4 text-sm">
        <a href={flightMethod} className={link}>Full report &amp; reproduction</a>
        <a href={flightSource} className={link}>Recorded results (JSON)</a>
        <a href="/model/flight-delay-001-protocol.json" className={link}>Frozen protocol</a>
        <a href="/model/flight-delay-001-manifest.json" className={link}>Data sources &amp; hashes</a>
      </nav>
    </section>
  );
}

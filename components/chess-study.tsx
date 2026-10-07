import Link from 'next/link';
import { chessComparisons, chessPercent, chessPoints, chessProtocol, chessStudy } from '@/lib/chess-study';

const link = 'underline decoration-edge-strong underline-offset-4 hover:text-accent';
const cell = 'border-t border-edge px-4 py-4 text-right tabular-nums';

function ChessComparison() {
  return (
    <figure className="min-w-0 rounded-md bg-surface p-6 sm:p-8">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">Checkmate accuracy</span>
        <span className="text-xs text-muted">Same 512 test positions · Higher is better</span>
      </figcaption>
      <dl className="mt-7 space-y-6">
        {chessComparisons.map(({ key, name, note, adapted, metrics, correct }) => (
          <div key={key}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className={`text-sm ${adapted ? 'font-semibold text-accent' : 'text-ink'}`}>{name}</dt>
              <dd className="shrink-0 text-sm font-semibold tabular-nums">{chessPercent(metrics.accuracy)}</dd>
            </div>
            <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-sm bg-edge">
              <div className={`h-full rounded-sm ${adapted ? 'bg-accent' : 'bg-[#858898]'}`} style={{ width: `${metrics.accuracy * 100}%` }} />
            </div>
            <dd className="mt-2 text-xs leading-5 text-muted">{correct} / 512 correct · {note}</dd>
          </div>
        ))}
      </dl>
      <div aria-hidden="true" className="mt-5 flex justify-between text-[11px] tabular-nums text-subtle"><span>0%</span><span>100%</span></div>
      <p className="mt-5 border-t border-edge pt-4 text-xs leading-6 text-muted">
        All legal checking moves were offered. Every move that immediately checkmates received credit.
      </p>
    </figure>
  );
}

export function ChessStudySummary() {
  return (
    <section id="chess-study" aria-labelledby="chess-study-heading" className="scroll-mt-20 border-t border-edge py-16 sm:py-20">
      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-xs text-muted">New research · Chess · 7 October 2026 UTC</p>
          <h2 id="chess-study-heading" className="mt-4 max-w-[20ch] text-[clamp(2rem,4.4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.055em]">Training improved mate-in-one choices.</h2>
          <p className="mt-5 max-w-[48ch] text-[15px] leading-7 text-muted">
            A fresh chess adapter selected a checkmating move in <strong className="font-semibold text-ink">260 of 512 held-out positions</strong>.
            Accuracy improved by {chessPoints(chessStudy.paired_comparisons.trained_minus_shared.accuracy.right_minus_left)} percentage points over shared JevK5
            and {chessPoints(chessStudy.paired_comparisons.trained_minus_jev.accuracy.right_minus_left)} over TypeSafe Jev.
          </p>
          <Link href="/model/chess-study" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-action px-5 py-3 text-sm font-medium text-on-action hover:bg-action-hover">Read the chess study</Link>
        </div>
        <ChessComparison />
      </div>
      <p className="mt-7 max-w-[82ch] text-xs leading-6 text-muted">This measures one-move choices among legal checks. Deterministic chess software solves 100% of these positions; the study tests specialization on a new task. One training seed, one recipe, no deployment.</p>
    </section>
  );
}

export function ChessStudyDetails() {
  return (
    <div className="space-y-12 pb-16 sm:pb-20">
      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <ChessComparison />
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.035em]">Learn from different games.</h2>
          <p className="mt-3 text-sm leading-7 text-muted">The adapter learned from public Lichess puzzles. All three models saw the same board, instructions, candidate moves, and order at test time.</p>
          <dl className="mt-5 divide-y divide-edge border-y border-edge">
            {[
              ['Training positions', chessProtocol.splits.train.toLocaleString('en-US')],
              ['Calibration positions · reserved, unused', chessProtocol.splits.calibration],
              ['Held-out test positions', chessProtocol.splits.test],
            ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-5 py-4 text-sm"><dt>{label}</dt><dd className="tabular-nums">{value}</dd></div>)}
          </dl>
          <p className="mt-4 text-xs leading-6 text-muted">One position per source game. No repeated source games, exact positions, or color-swapped vertical mirrors across the full sample. Fifteen test positions have multiple winning moves, all accepted.</p>
        </div>
      </div>

      <section aria-labelledby="chess-differences" className="border-t border-edge pt-10">
        <h2 id="chess-differences" className="text-xl font-semibold tracking-[-0.035em]">An improvement with measured uncertainty.</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {([
            ['shared', 'Compared with shared JevK5'],
            ['jev', 'Compared with TypeSafe Jev'],
          ] as const).map(([key, label]) => {
            const difference = chessStudy.paired_comparisons[`trained_minus_${key}`].accuracy;
            return <div key={key} className="rounded-md border border-edge p-6"><h3 className="text-sm text-muted">{label}</h3><p className="mt-3 text-3xl font-semibold tracking-tight text-accent tabular-nums">{chessPoints(difference.right_minus_left)} <span className="text-sm font-normal text-muted">percentage points</span></p><p className="mt-3 text-xs leading-6 text-muted">Paired 95% interval: {difference.paired_game_bootstrap_95pct.map(chessPoints).join(' to ')} points.</p></div>;
          })}
        </div>
        <p className="mt-4 max-w-[86ch] text-xs leading-6 text-muted">Both intervals stay above zero. We resampled the 512 test games 2,000 times, pairing each model’s result on the same position. These are individual intervals without adjustment for multiple comparisons. Only one adapter seed and one fixed recipe were tested.</p>
      </section>

      <section aria-labelledby="chess-scope" className="rounded-md bg-soft p-6 sm:p-8">
        <h2 id="chess-scope" className="text-xl font-semibold tracking-[-0.035em]">A narrow task with an exact answer.</h2>
        <p className="mt-3 max-w-[85ch] text-sm leading-7 text-muted">The task is to choose an immediate checkmate from every legal checking move. Test positions had 2–10 choices; the protocol allows 2–16. This measures restricted mate-in-one selection. Full-game strength, unrestricted move generation, and multi-move planning were not evaluated.</p>
        <dl className="mt-6 grid gap-5 sm:grid-cols-3">
          {[
            ['Uniform random choice · expected', chessStudy.baselines.uniform_expected_accuracy],
            ['Simple capture heuristic', chessStudy.baselines.capture_material],
            ['Deterministic chess-rules oracle', chessStudy.baselines.rules_oracle],
          ].map(([name, value]) => <div key={name}><dt className="text-xs leading-5 text-muted">{name}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{chessPercent(Number(value))}</dd></div>)}
        </dl>
        <p className="mt-5 text-xs leading-6 text-muted">Chess software already solves every position in this task. The experiment asks whether specialization improves JevK5 on a new domain. No model was deployed or promoted.</p>
      </section>

      <details className="rounded-md border border-edge">
        <summary className="cursor-pointer px-5 py-5 text-sm font-semibold marker:text-accent hover:text-accent">All scores, training method, and reliability</summary>
        <div className="border-t border-edge p-5 sm:p-6">
          <div role="region" aria-label="Chess study model scores" tabIndex={0} className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="pb-4 text-left text-xs leading-6 text-muted">All 512 test positions per model. Any immediate checkmate receives credit. Lower negative log likelihood (NLL) is better.</caption>
              <thead><tr>{['Model', 'Correct', 'Accuracy', 'Probability on mating moves', 'NLL', 'Confident mistakes'].map(label => <th scope="col" key={label} className="px-4 py-3 text-left font-medium">{label}</th>)}</tr></thead>
              <tbody>{chessComparisons.map(({ key, name, metrics, correct }) => <tr key={key}><th scope="row" className="border-t border-edge px-4 py-4 text-left font-normal">{name}</th><td className={cell}>{correct} / 512</td><td className={cell}>{chessPercent(metrics.accuracy)}</td><td className={cell}>{chessPercent(metrics.mating_probability_mass)}</td><td className={cell}>{metrics.marginal_nll.toFixed(3)}</td><td className={cell}>{metrics.high_probability_errors} / {metrics.high_probability_predictions} confident choices</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-7 space-y-5 text-sm leading-7 text-muted">
            <p><strong className="font-medium text-ink">Inputs and answers.</strong> The opponent’s setup move was applied first. Models received the resulting board, side to move, and candidate moves with piece/from/to descriptions. Solutions, checkmate notation, ratings, and puzzle or game identifiers stayed out of model requests. A rules engine independently verified every mating alternative and executed all 1,536 selected moves for the final audit.</p>
            <p><strong className="font-medium text-ink">Data selection.</strong> The first 200,000 records of the pinned Lichess archive supplied the pool; this is not a uniform sample of the full database. Positions with fewer than two or more than sixteen checking moves, or where every candidate mated, were excluded. Source-game separation and exact/mirror deduplication still allow related tactical patterns and possible overlap with public pretraining data.</p>
            <p><strong className="font-medium text-ink">Training.</strong> One fresh rank-16 adapter, one epoch, seed 557, and 512 optimizer steps. The final saved checkpoint was used without test-directed tuning. Training and saving took {(chessStudy.training.training_seconds / 60).toFixed(2)} minutes on an RTX 4090, excluding loading and input preparation. Peak training tensor allocation was {(chessStudy.training.peak_gpu_allocated_bytes / 2 ** 30).toFixed(2)} GiB. Both smoke and full adapters passed independent fresh-process reload checks. Native temperatures were retained; calibration data was unused.</p>
            <p><strong className="font-medium text-ink">API reliability.</strong> Jev returned valid answers on the first attempt for 506/512 positions. Six rejected responses were retained and recovered within the three-attempt limit: five probability-sum failures and one inconsistent choice. The reported scores use validated responses after retries. All three model runs completed; no failed or missing positions were dropped.</p>
            <p><strong className="font-medium text-ink">Additional measures.</strong> First-listed move accuracy was {chessPercent(chessStudy.baselines.first_option)}. A confident choice assigns at least 90% probability to the selected move. The table’s mating probability is the total probability assigned to all correct moves. NLL is the negative log of that total, with a floor for zero probability.</p>
          </div>
        </div>
      </details>

      <nav aria-label="Chess study evidence" className="flex flex-wrap gap-x-6 gap-y-4 text-sm">
        <a href="/model/chess-001.md" className={link}>Full report (Markdown)</a>
        <a href="/model/chess-001.json" className={link}>Recorded results (JSON)</a>
        <a href="/model/chess-001-protocol.json" className={link}>Frozen protocol</a>
        <a href="/model/chess-001-preparation.json" className={link}>Preparation checks</a>
        <a href="/model/chess-001-manifest.json" className={link}>Data manifest</a>
      </nav>
    </div>
  );
}

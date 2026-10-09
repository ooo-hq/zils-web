import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { FlightStudyDetails } from '@/components/flight-study';
import { ChessStudySummary } from '@/components/chess-study';
import { SupportStudyDetails } from '@/components/support-study';
import { JevComparisonDetails } from '@/components/jev-comparison';
import { ResearchOverview, ResearchModelGuide, ResearchMetricGuide } from '@/components/research-guide';
import { jevMethod, jevSource } from '@/lib/jev-comparison';
import { SiteHeader } from '@/components/site-header';
import { HeroBackdrop } from '@/components/hero-backdrop';
import s from '@/components/research-guide.module.css';
import { benchmark, readComparison, percent, decimal, milliseconds, comparisonHeadline } from '@/lib/model-benchmark';

export const metadata: Metadata = {
  title: 'zils — teaching small models, testing what they learn',
  description: 'Explore Zils research on support decisions, chess, and flight risk. Compare training gains, simple baselines, confidence, methods, and published evidence.',
  alternates: { canonical: 'https://zils.ai/model' },
};

const REPO = 'https://github.com/ooo-hq/zils';
const METHOD = `${REPO}/blob/main/docs/jevbench-public.md`;
const SOURCE = '/model/jevbench-public-001.json';
const LINK = 'underline decoration-edge-strong underline-offset-4 hover:text-accent hover:decoration-accent';
const CELL = 'border-t border-edge px-3 py-3 text-right tabular-nums sm:px-5';
const HEAD = 'border-t border-edge px-3 py-3 text-left font-normal text-ink sm:px-5';
const CARD = 'rounded-2xl bg-page ring-1 ring-edge';
const SECTIONS = [
  { id: 'findings', title: 'Findings' },
  { id: 'approach', title: 'Approach' },
  { id: 'jev-comparison', title: 'Support' },
  { id: 'chess-study', title: 'Chess' },
  { id: 'flight-study', title: 'Flights' },
  { id: 'quality', title: 'Earlier benchmark' },
  { id: 'metrics', title: 'Metric guide' },
] as const;
const RESOURCES = [
  { href: REPO, title: 'Research code' },
  { href: jevMethod, title: 'Support comparison report' },
  { href: jevSource, title: 'Support results (JSON)' },
] as const;

function time(value: string) {
  return `${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'UTC', hourCycle: 'h23',
  }).format(new Date(value))} UTC`;
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-16 border-t border-edge py-16 sm:py-20">
      <p className="text-xs text-muted">{eyebrow}</p>
      <h2 id={`${id}-heading`} className="mb-8 mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-[1.05] tracking-[-0.05em]">{title}</h2>
      {children}
    </section>
  );
}

export default function ModelPage() {
  const { fez, kev } = readComparison(benchmark);
  const f = fez.metrics;
  const k = kev.metrics;
  const reference = benchmark.published_reference;
  const rows = [
    ['Accuracy', 'Higher is better', percent(k.accuracy), percent(f.accuracy)],
    ['Correct answers', 'Same public items', `${k.n_correct} / ${k.n_attempted}`, `${f.n_correct} / ${f.n_attempted}`],
    ['Brier loss', 'Lower is better', decimal(k.brier_mean), decimal(f.brier_mean)],
    ['Calibration error (ECE)', 'Lower is better', decimal(k.ece), decimal(f.ece)],
    ['Confident mistakes', 'Wrong at ≥90% confidence', k.confident_errors, f.confident_errors],
    ['Median latency', 'Localhost HTTP', milliseconds(k.latency?.p50_s), milliseconds(f.latency?.p50_s)],
    ['p95 latency', 'Localhost HTTP', milliseconds(k.latency?.p95_s), milliseconds(f.latency?.p95_s)],
    ['Valid probability outputs', '', percent(k.schema_validity), percent(f.schema_validity)],
  ];

  return (
    <div className={`${s.page} min-h-screen bg-page font-sans text-ink antialiased selection:bg-[#4942c7] selection:text-white`}>
      <div className="mx-auto max-w-6xl px-6 sm:px-8"><SiteHeader tone="light" current="model" /></div>
      <main id="main-content" tabIndex={-1}>
        <div className="relative overflow-hidden">
          <HeroBackdrop variant="research" />
          <header className="relative mx-auto max-w-5xl px-6 pb-16 pt-10 sm:px-8 sm:pt-16">
            <p className="text-sm text-muted">Zils research</p>
            <h1 className="mt-5 max-w-[20ch] text-balance text-[clamp(2.7rem,6.5vw,4.8rem)] font-semibold leading-[1.02] tracking-[-0.055em]">Teaching small models. Testing what they learn.</h1>
            <p className="mt-6 max-w-[60ch] text-lg leading-8 text-muted">We train models for specific decisions, then test whether their answers improve and their probabilities deserve trust. The comparisons include the model before training, TypeSafe Jev, and simpler methods that sometimes win.</p>
            <a href="#findings" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-action px-5 py-3 text-sm font-medium text-on-action hover:bg-action-hover">Explore the findings</a>
            <nav aria-label="Project resources" className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {RESOURCES.map(r => (
                <a key={r.href} href={r.href} className={`inline-flex min-h-11 items-center ${LINK}`}>{r.title}</a>
              ))}
            </nav>
            <p className="mt-3 text-xs leading-6 text-muted">Recorded experiments with published methods and limitations. Research adapters are separate from the live shared model.</p>
          </header>
        </div>

        <div className="mx-auto max-w-5xl px-6 sm:px-8">
          <nav aria-label="On this page" className="z-10 -mx-2 flex flex-wrap gap-x-4 gap-y-1 bg-page/95 px-2 py-2 backdrop-blur md:sticky md:top-0">
            {SECTIONS.map(section => <a key={section.id} href={`#${section.id}`} className="inline-flex min-h-11 items-center text-[13px] text-muted underline decoration-edge-strong underline-offset-4 hover:text-accent">{section.title}</a>)}
          </nav>

          <ResearchOverview />
          <ResearchModelGuide />
          <JevComparisonDetails />
          <SupportStudyDetails />
          <ChessStudySummary />
          <FlightStudyDetails />

          <Section id="overview" eyebrow="Earlier research · Kev 0.8B" title="Previous experiments, preserved.">
            <p className="max-w-[70ch] text-[15px] leading-7 text-muted">This earlier experiment fine-tuned Kev 0.8B and tested it on the public JevBench items. Accuracy tied the unchanged checkpoint, while probability quality worsened. Its model, tasks, and scoring rules differ from the studies above. Checkpoint and dataset identities are preserved in the method below.</p>
          </Section>

          <Section id="quality" eyebrow="Earlier JevBench comparison" title={comparisonHeadline(fez, kev)}>
            <div className="mb-6 rounded-md bg-surface p-6 sm:p-8">
              <div className="grid gap-6 sm:grid-cols-3">
                {[
                  ['Zils candidate accuracy', percent(f.accuracy), `${f.n_correct} of ${f.n_attempted} public items correct`],
                  ['Probability error (Brier)', decimal(f.brier_mean), 'Lower is better. Compare within this study.'],
                  ['Confident mistakes', String(f.confident_errors), 'Wrong at ≥90% confidence.'],
                ].map(([label, value, note]) => (
                  <div key={label}><p className="text-xs text-muted">{label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em] tabular-nums">{value}</p><p className="mt-2 text-xs leading-6 text-muted">{note}</p></div>
                ))}
              </div>
              <p className="mt-6 border-t border-edge pt-4 text-sm leading-7 text-muted">Zils corrected {benchmark.paired_outcomes.fez_corrected} reference-model errors and introduced {benchmark.paired_outcomes.fez_regressed}. No general improvement is established.</p>
            </div>

            <div className={CARD}>
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-5 sm:px-5">
                <div><h3 className="font-semibold tracking-[-0.02em]">{benchmark.benchmark.name} public comparison</h3><p className="mt-1 text-xs text-subtle">{benchmark.benchmark.subset}</p></div>
                <a href={SOURCE} className="inline-flex min-h-10 items-center gap-3 rounded-md bg-action px-4 py-2 text-xs font-medium text-on-action hover:bg-action-hover">Source data (JSON)<span aria-hidden="true">↗</span></a>
              </div>
              <div role="region" aria-label="Overall model comparison" tabIndex={0} className="overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[320px] border-collapse text-sm">
                  <caption className="sr-only">Recorded Zils and published Kev results on the same public items</caption>
                  <thead className="bg-surface text-xs text-muted"><tr><th scope="col" className={HEAD}>Metric</th><th scope="col" className={`${CELL} text-accent`}>Zils candidate<span className="mt-1 block font-normal text-subtle">Experimental checkpoint</span></th><th scope="col" className={CELL}>Published Kev 0.8B<span className="mt-1 block font-normal text-subtle">Comparison baseline</span></th></tr></thead>
                  <tbody>{rows.map(([name, hint, baseline, candidate]) => <tr key={name} className="hover:bg-surface"><th scope="row" className={HEAD}>{name}<span className="mt-1 block text-xs text-subtle">{hint}</span></th><td className={`${CELL} font-medium`}>{candidate ?? 'Unavailable'}</td><td className={`${CELL} text-muted`}>{baseline ?? 'Unavailable'}</td></tr>)}</tbody>
                </table>
              </div>
              <p className="border-t border-edge px-4 py-4 text-xs leading-6 text-subtle sm:px-5">Brier loss measures probability error; ECE measures the gap between confidence and observed accuracy. Lower is better for both. Timing is {benchmark.runtime.measurement}, on {benchmark.runtime.hardware}, via localhost HTTP. This does not establish a reliable speedup or production SLA.</p>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-[1.3fr_1fr]">
              <div className={`min-w-0 ${CARD}`}>
                <h3 className="px-4 py-4 font-semibold tracking-[-0.02em] sm:px-5">Accuracy by difficulty</h3>
                <div role="region" aria-label="Accuracy by difficulty" tabIndex={0} className="overflow-x-auto overscroll-x-contain">
                  <table className="w-full min-w-[310px] border-collapse text-sm">
                    <caption className="sr-only">Correct and total counts, with accuracy, for each public subset</caption>
                    <thead className="bg-surface text-xs text-muted"><tr><th scope="col" className={HEAD}>Subset</th><th scope="col" className={`${CELL} text-accent`}>Zils</th><th scope="col" className={CELL}>Kev baseline</th></tr></thead>
                    <tbody>{(['easy', 'original', 'hard'] as const).map(name => <tr key={name}><th scope="row" className={`${HEAD} capitalize`}>{name}</th>{[fez, kev].map(model => <td key={model.id} className={CELL}>{model.slices[name]?.n_correct ?? 'Unavailable'} / {model.slices[name]?.n_scorable ?? 'Unavailable'}<span className="block text-xs text-subtle">{percent(model.slices[name]?.accuracy)}</span></td>)}</tr>)}</tbody>
                  </table>
                </div>
              </div>
              <aside className="rounded-md bg-soft p-6" aria-label="Published external reference">
                <p className="text-xs text-muted">External published reference</p><h3 className="mt-2 text-lg font-semibold tracking-[-0.02em]">{reference.name}</h3>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] tabular-nums">{percent(reference.n_correct / reference.n_attempted)}</p><p className="mt-1 text-xs text-muted">{reference.n_correct} / {reference.n_attempted} correct</p>
                <p className="mt-4 text-xs leading-6 text-muted">{reference.scope} Not run on this comparison’s hardware.</p><a href={reference.source_url} className="mt-4 inline-block text-xs font-medium underline underline-offset-4">View upstream outcomes</a>
              </aside>
            </div>

            <dl className="my-8 grid gap-5 text-xs sm:grid-cols-3">
              <div><dt className="text-subtle">Data mode</dt><dd className="mt-1 break-words font-mono">{benchmark.data_mode}</dd><dd className="mt-1 text-subtle">Completed, recorded experiment</dd></div>
              <div><dt className="text-subtle">Verified at</dt><dd className="mt-1 font-mono"><time dateTime={benchmark.verified_at}>{time(benchmark.verified_at)}</time></dd><dd className="mt-1 text-subtle">Evidence time; not page-refresh time</dd></div>
              <div><dt className="text-subtle">Hardware / precision</dt><dd className="mt-1 font-mono">{benchmark.runtime.hardware}</dd><dd className="mt-1 text-subtle">{benchmark.runtime.precision.toUpperCase()}. Same runtime for both models.</dd></div>
            </dl>

            <details className="rounded-md border border-edge bg-surface px-5 py-4 text-sm">
              <summary className="cursor-pointer font-medium marker:text-accent hover:text-accent">Method, checkpoint identities &amp; limitations</summary>
              <div className="mt-5 space-y-5 text-sm leading-7 text-muted">
                <p>This earlier experiment fine-tuned a published Kev 0.8B checkpoint built on Qwen3.5-0.8B-Base. The unchanged published checkpoint is the baseline in this comparison.</p>
                <p>No official JevBench rank or composite score is available: private and sealed tests were not run. Hosted cost was not measured. Other experiment suites are documented separately and cannot form an improvement line with this comparison.</p>
                <dl className="space-y-4 text-xs">
                  <div><dt className="font-medium text-ink">Experiment / collection started</dt><dd>{benchmark.id} / <time dateTime={benchmark.started_at}>{time(benchmark.started_at)}</time></dd></div>
                  {[['Zils checkpoint SHA-256', fez.checkpoint_sha256], ['Published Kev checkpoint SHA-256', kev.checkpoint_sha256], ['Public dataset SHA-256', benchmark.benchmark.dataset_sha256], ['Harness revision', benchmark.benchmark.harness_commit]].map(([label, hash]) => <div key={label}><dt className="font-medium text-ink">{label}</dt><dd><code className="break-all font-mono">{hash}</code></dd></div>)}
                  <div><dt className="font-medium text-ink">Latency scope</dt><dd>{benchmark.runtime.latency_scope}.</dd></div>
                  <div><dt className="font-medium text-ink">Saved temperatures</dt><dd>Zils: {decimal(fez.temperature)}. Kev: {decimal(kev.temperature)}.</dd></div>
                </dl>
                <ul className="list-disc space-y-2 pl-5">{benchmark.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
                <p>The experimental Zils checkpoint is not distributed, so the full comparison cannot be reproduced from the checkout alone.</p>
                <div className="flex flex-wrap gap-x-6 gap-y-3"><a href={METHOD} className={LINK}>Full methodology</a><a href={benchmark.benchmark.upstream_url} className={LINK}>Pinned benchmark harness</a><a href={`${REPO}/blob/main/docs/experiments.md`} className={LINK}>Other experiment suites</a></div>
              </div>
            </details>
          </Section>

          <ResearchMetricGuide />

          <aside id="training" aria-label="Bittensor mining" className="scroll-mt-16 border-t border-edge py-8 text-sm leading-7 text-muted">
            <span id="participants" className="block scroll-mt-16" />
            <span id="testnet" className="block scroll-mt-16" />
            Mining, validation, and the recorded testnet round are on the <Link href="/bittensor" className={LINK}>Bittensor page</Link>.
          </aside>
          <p className="border-t border-edge py-8 text-xs leading-6 text-subtle">All results on this page are recorded experiments. The study reports define their scope, artifacts, and reproduction limits.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

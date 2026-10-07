import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { FlightStudyDetails } from '@/components/flight-study';
import { ChessStudySummary } from '@/components/chess-study';
import { SupportStudyDetails } from '@/components/support-study';
import { JevComparisonDetails } from '@/components/jev-comparison';
import { jevMethod, jevSource } from '@/lib/jev-comparison';
import { SiteHeader } from '@/components/site-header';
import s from '@/components/light.module.css';
import { benchmark, readComparison, percent, decimal, milliseconds, comparisonHeadline } from '@/lib/model-benchmark';

export const metadata: Metadata = {
  title: 'zils — decision model research',
  description: 'ABCD-trained JevK5 reached 79.2% accuracy versus TypeSafe Jev’s 70.6% on the same 500 test conversations. Explore the comparison, confidence tradeoffs, and evidence.',
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
  { id: 'chess-study', title: 'Chess decisions' },
  { id: 'jev-comparison', title: 'TypeSafe Jev comparison' },
  { id: 'support-study', title: 'Support decisions' },
  { id: 'flight-study', title: 'Flight adapter study' },
  { id: 'overview', title: 'Earlier research' },
  { id: 'quality', title: 'JevBench comparison' },
] as const;
const RESOURCES = [
  { href: REPO, title: 'Research code', description: 'Explore training and evaluation.', bg: 'bg-page' },
  { href: jevMethod, title: 'Jev comparison report', description: 'Read the method and measured limits.', bg: 'bg-page' },
  { href: jevSource, title: 'Recorded results', description: 'Inspect the Jev comparison’s scores and evidence.', bg: 'bg-page' },
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
      <p className="flex items-center gap-2 text-[12px] font-medium"><span aria-hidden="true" className="text-base">✳</span> {eyebrow}</p>
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
    <div className="min-h-screen bg-page font-sans text-ink antialiased selection:bg-[#4942c7] selection:text-white">
      <div className="relative overflow-hidden bg-surface">
        <div className="relative mx-auto max-w-6xl px-6 sm:px-8"><SiteHeader tone="light" current="model" /></div>
        <header className="relative mx-auto max-w-5xl px-6 pb-16 pt-10 sm:px-8 sm:pt-16">
          <p className="flex items-center gap-2 text-[12px] font-medium"><span aria-hidden="true" className="text-base">✳</span> Research · Open about the evidence</p>
          <h1 className="mt-5 max-w-[16ch] text-[clamp(2.7rem,6.5vw,4.8rem)] font-semibold leading-[0.98] tracking-[-0.06em]">Decision model research.</h1>
          <p className="mt-6 max-w-[58ch] text-lg leading-8 text-muted">Can training make a decision model better at a specific task? We compare results before and after training, alongside TypeSafe Jev and simple alternatives, then publish what improved and what did not.</p>
          <p className="mt-4 flex w-fit items-center gap-2 rounded-full bg-page/70 px-3 py-1 text-xs text-muted ring-1 ring-edge"><span className="size-1.5 shrink-0 rounded-full bg-[#FF6A00]" />Recorded experiments. Evidence and limitations published together.</p>
          <a href="#jev-comparison" className="mt-8 inline-flex min-h-11 items-center rounded-md bg-action px-5 py-3 text-sm font-medium text-on-action hover:bg-action-hover">Compare trained JevK5 with TypeSafe Jev</a>
          <nav aria-label="Project resources" className="mt-4 grid gap-3 sm:grid-cols-3">
            {RESOURCES.map(r => (
              <a key={r.href} href={r.href} className={`group rounded-md border border-edge p-5 transition-colors hover:border-accent ${r.bg}`}>
                <span className="flex items-center justify-between gap-4 font-semibold tracking-[-0.02em]">{r.title}<span aria-hidden="true" className="transition-transform group-hover:rotate-45">↗</span></span>
                <span className="mt-2 block text-sm leading-6 text-muted">{r.description}</span>
              </a>
            ))}
          </nav>
        </header>
      </div>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-6 sm:px-8">
        <nav aria-label="On this page" className="sticky top-0 z-10 -mx-2 flex gap-1.5 overflow-x-auto bg-page/85 px-2 py-3 backdrop-blur">
          {SECTIONS.map(section => <a key={section.id} href={`#${section.id}`} className="shrink-0 rounded-full bg-page px-4 py-1.5 text-xs text-muted ring-1 ring-edge hover:text-ink">{section.title}</a>)}
        </nav>

        <ChessStudySummary />

        <JevComparisonDetails />

        <SupportStudyDetails />

        <FlightStudyDetails />

        <Section id="overview" eyebrow="Earlier research · Kev 0.8B" title="Previous experiments, preserved.">
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
            <p className="max-w-[58ch] text-[15px] leading-7 text-muted">The comparison below preserves the earlier Kev 0.8B public benchmark. It used different models, tasks, and scoring rules from the JevK5 support and flight studies. Their percentages should not be combined into a single improvement claim.</p>
            <div className={`${CARD} p-5`}>
              <p className="font-mono text-[10px] tracking-[0.12em] text-subtle">PUBLIC BENCHMARK CANDIDATE</p>
              <code className="mt-3 block break-all font-mono text-xs leading-6 text-ink">{fez.checkpoint_sha256}</code>
            </div>
          </div>
        </Section>

        <Section id="quality" eyebrow="Earlier JevBench comparison" title={comparisonHeadline(fez, kev)}>
          <div className={`relative mb-6 overflow-hidden rounded-2xl bg-[#0c0f0c] p-6 font-mono sm:p-8 ${s.tube}`}>
            <span aria-hidden="true" className={`pointer-events-none absolute inset-0 ${s.scanlinesDark}`} />
            <div className={`relative grid gap-6 text-[#9ee89e] sm:grid-cols-3 ${s.phosphor}`}>
              {[
                ['FEZ ACCURACY', percent(f.accuracy), `${f.n_correct} of ${f.n_attempted} public items correct`],
                ['FEZ BRIER LOSS', decimal(f.brier_mean), 'Probability error. Lower is better.'],
                ['FEZ CONFIDENT MISTAKES', String(f.confident_errors), 'Wrong at ≥90% confidence.'],
              ].map(([label, value, note]) => (
                <div key={label}><p className="text-[10px] tracking-[0.14em] text-[#9ee89e]/60">{label}</p><p className="mt-2 text-4xl tracking-[-0.04em]">{value}</p><p className="mt-2 text-[11px] text-[#9ee89e]/70">{note}</p></div>
              ))}
            </div>
            <p className="relative mt-6 border-t border-[#9ee89e]/15 pt-4 text-xs text-[#c9f5c9]/80">Zils corrected {benchmark.paired_outcomes.fez_corrected} reference-model errors and introduced {benchmark.paired_outcomes.fez_regressed}. No general improvement is established.</p>
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
            <aside className="rounded-2xl bg-[#6C93FF] p-6 text-[#15151a]" aria-label="Published external reference">
              <p className="font-mono text-[10px] tracking-[0.12em] text-black/60">PUBLISHED REFERENCE</p><h3 className="mt-2 text-lg font-semibold tracking-[-0.02em]">{reference.name}</h3>
              <p className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{percent(reference.n_correct / reference.n_attempted)}</p><p className="mt-1 text-xs text-black/70">{reference.n_correct} / {reference.n_attempted} correct</p>
              <p className="mt-4 text-xs leading-6 text-black/75">{reference.scope} Not run on this comparison’s hardware.</p><a href={reference.source_url} className="mt-4 inline-block text-xs font-medium underline underline-offset-4">View upstream outcomes ↗</a>
            </aside>
          </div>

          <dl className="my-8 grid gap-5 text-xs sm:grid-cols-3">
            <div><dt className="text-subtle">Data mode</dt><dd className="mt-1 break-words font-mono">{benchmark.data_mode}</dd><dd className="mt-1 text-subtle">Completed, recorded experiment</dd></div>
            <div><dt className="text-subtle">Verified at</dt><dd className="mt-1 font-mono"><time dateTime={benchmark.verified_at}>{time(benchmark.verified_at)}</time></dd><dd className="mt-1 text-subtle">Evidence time; not page-refresh time</dd></div>
            <div><dt className="text-subtle">Hardware / precision</dt><dd className="mt-1 font-mono">{benchmark.runtime.hardware}</dd><dd className="mt-1 text-subtle">{benchmark.runtime.precision.toUpperCase()}. Same runtime for both models.</dd></div>
          </dl>

          <details className="rounded-2xl bg-neutral-100 px-5 py-4 text-sm">
            <summary className="cursor-pointer font-medium marker:text-[#FF6A00] hover:text-accent">Method, checkpoint identities & limitations</summary>
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

        <aside id="training" aria-label="Bittensor mining" className="scroll-mt-16 border-t border-edge py-8 text-sm leading-7 text-muted">
          <span id="participants" className="block scroll-mt-16" />
          <span id="testnet" className="block scroll-mt-16" />
          Mining, validation, and the recorded testnet round are on the <Link href="/bittensor" className={LINK}>Bittensor page</Link>.
        </aside>
        <p className="border-t border-edge py-8 text-xs text-subtle">Zils decision model. Public evidence, read-only access.</p>
      </main>
      <SiteFooter />
    </div>
  );
}

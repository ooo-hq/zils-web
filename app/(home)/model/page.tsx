import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { FlightStudyDetails } from '@/components/flight-study';
import { ChessStudySummary } from '@/components/chess-study';
import { SupportStudyDetails } from '@/components/support-study';
import { JevComparisonDetails } from '@/components/jev-comparison';
import { ResearchOverview, ResearchModelGuide, ResearchMetricGuide } from '@/components/research-guide';
import { supportMethod, supportSource } from '@/lib/support-study';
import { SiteHeader } from '@/components/site-header';
import { SupportTrainingExample } from '@/components/support-decision-examples';
import { HeroBackdrop } from '@/components/hero-backdrop';
import s from '@/components/research-guide.module.css';
import { benchmark, readComparison, percent, decimal, milliseconds, comparisonHeadline } from '@/lib/model-benchmark';

export const metadata: Metadata = {
  title: 'zils — tuned open models can compete',
  description: 'Task-tuned open JevK5 4B models outperformed official hosted TypeSafe JEV 1.13.0 on our support and mate-in-one tests. Also: B300 miner follow-ups, how the base-model competition works (no public round yet), and recorded d3-mini evidence.',
  alternates: { canonical: 'https://zils.ai/model' },
};

const REPO = 'https://github.com/ooo-hq/zils';
const METHOD = `${REPO}/blob/main/docs/jevbench-public.md`;
const SOURCE = '/model/jevbench-public-001.json';
const LINK = 'underline decoration-edge-strong underline-offset-4 hover:text-accent hover:decoration-accent';
const CELL = 'border-t border-edge px-3 py-3 text-right tabular-nums sm:px-5';
const HEAD = 'border-t border-edge px-3 py-3 text-left font-normal text-ink sm:px-5';
const CARD = 'rounded-2xl bg-page ring-1 ring-edge';
const TEXT = 'border-t border-edge px-3 py-3 text-left align-top sm:px-5';
const DOCS = 'https://docs.zils.ai';
const PROMOTION_RULES = [
  ['Sealed score', 'Validators score the submitted weights on a sealed holdout, against the incumbent.'],
  ['Eligibility', 'Skill is positive, accuracy is not below the incumbent’s, and Brier improves by at least 0.01 with a paired-bootstrap 95% lower bound above zero.'],
  ['Round weight', 'Eligible candidates share the round’s weight in proportion to skill.'],
  ['Confirmation', 'The best eligible candidate is re-scored on a second, disjoint sealed draw at least 12 hours later and must stay eligible.'],
  ['Regression suite', 'Before promotion, a fixed suite of reference adapter jobs is retrained on the incumbent and on the candidate. The candidate must be no worse than 0.005 Brier on every job and better on at least one.'],
] as const;
const CHANNELS = [
  ['latest', 'Advances on each confirmed winner.', 'Opt-in, per job.'],
  ['stable', 'Advances at most quarterly, to a base that held latest through a full window without rollback.', 'The default for new customer jobs.'],
] as const;
const D3_PROFILE = [
  ['Profile', 'd3-mini-4.5b-v1'],
  ['Vendor model', 'vllm-sr/d3-mini · 4.54B parameters · Apache-2.0'],
  ['Backbone', 'Qwen3.5-4B (the same as H2O and Imajev), plus a 0.33B vision tower'],
  ['Inputs', 'Text, up to four images, and one video'],
  ['Answers', 'Yes/no, choice (up to 255 outcomes), and score'],
  ['Pinned by Zils', 'A byte-identical mirror, zils-ai/d3-mini-4.5b-v1, and a 4,096-token cap with no truncation'],
] as const;
const D3_EVIDENCE = [
  ['Stock model, round-one sealed holdout, validator decision rule', 'Brier 0.184 · 87.7% accuracy', 'Brier 0.142 · 89.8% accuracy', 'Eligible'],
  ['Adapter on the 500-case ABCD test cohort (frozen production recipe, 4,096 training examples, two seeds)', '83.0%', '83.4%', 'A tie: the interval includes zero'],
  ['Adapter on the historical ABCD cohort', '83.6%', '86.6%', 'd3-mini ahead; interval +0.6 to +5.4 points'],
  ['Exam prompt length, median input tokens', '528', '568', 'd3-mini prompts are about 40 tokens longer'],
] as const;
const SECTIONS = [
  { id: 'findings', title: 'Findings' },
  { id: 'approach', title: 'Approach' },
  { id: 'jev-comparison', title: 'Support' },
  { id: 'chess-study', title: 'Chess' },
  { id: 'flight-study', title: 'Flights' },
  { id: 'base-tier', title: 'Base tier' },
  { id: 'd3-mini', title: 'd3-mini evidence' },
  { id: 'quality', title: 'Earlier benchmark' },
  { id: 'metrics', title: 'Metric guide' },
] as const;
const RESOURCES = [
  { href: REPO, title: 'Research code' },
  { href: supportMethod, title: 'Training study report' },
  { href: supportSource, title: 'Training results (JSON)' },
] as const;

function time(value: string) {
  return `${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'UTC', hourCycle: 'h23',
  }).format(new Date(value))} UTC`;
}

function Table({ label, head, rows, wide }: { label: string; head: readonly string[]; rows: readonly (readonly string[])[]; wide?: boolean }) {
  return (
    <div className={`mt-6 ${CARD}`}>
      <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto overscroll-x-contain">
        <table className={`w-full ${wide ? 'min-w-[640px]' : 'min-w-[420px]'} border-collapse text-sm`}>
          <caption className="sr-only">{label}</caption>
          <thead className="bg-surface text-xs text-muted"><tr>{head.map(name => <th key={name} scope="col" className={HEAD}>{name}</th>)}</tr></thead>
          <tbody>{rows.map(([name, ...cells]) => <tr key={name}><th scope="row" className={`${TEXT} font-normal text-ink`}>{name}</th>{cells.map((cell, i) => <td key={i} className={`${TEXT} text-muted`}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
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
        <div className={s.heroStage}>
          <div className={s.heroAtmosphere}><HeroBackdrop variant="research" /></div>
          <header className={s.hero}>
            <div className={s.heroCopy}>
              <p className={s.heroIdentity}>Zils research</p>
              <h1>Tuned open models can compete.</h1>
              <p className={s.heroLead}>We train open models for a specific job, then test them on examples they haven’t trained on. Here’s what improved, what didn’t, and how we measured it.</p>
              <a href="#findings" className={s.primaryLink}>Explore the findings</a>
              <p className={s.heroNote}>Recorded experiments. Published evidence.<br /> Results apply to each test, not every task.</p>
            </div>
            <SupportTrainingExample />
            <nav aria-label="Project resources" className={s.resources}>
              <span>Explore the evidence</span>
              {RESOURCES.map(r => <a key={r.href} href={r.href}>{r.title}</a>)}
            </nav>
          </header>
        </div>

        <div className={s.researchLayout}>
          <nav aria-label="On this page" className={s.sectionNav}>
            <span>On this page</span>
            {SECTIONS.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
          </nav>
          <div className={s.reports}>
          <ResearchOverview />
          <ResearchModelGuide />
          <JevComparisonDetails />
          <SupportStudyDetails />
          <ChessStudySummary />
          <FlightStudyDetails />

          <Section id="base-tier" eyebrow="Base tier · status as of 17 October 2026" title="A competition for the base model itself.">
            <p className="max-w-[70ch] text-[15px] leading-7 text-muted">Customer adapters train on a pinned base model, and H2O Lightning 4B v1.2.3 remains the default. The base tier is the competition that decides when that base changes. Miners submit a full-weight replacement for the pinned base of a text profile. Validators score it on a sealed holdout against the incumbent, and a candidate is promoted only if it passes every step below.</p>
            <Table label="How a candidate base is scored and promoted" head={['Step', 'Rule']} rows={PROMOTION_RULES} />
            <h3 className="mt-10 text-xl font-semibold tracking-[-0.035em]">Two channels</h3>
            <Table label="Base channels" head={['Channel', 'Advances', 'Who gets it']} rows={CHANNELS} />
            <p className="mt-4 max-w-[70ch] text-sm leading-7 text-muted">New customer jobs default to <code className="font-mono text-xs">stable</code>; <code className="font-mono text-xs">latest</code> is opt-in per job. Existing releases keep serving on their base.</p>
            <div className="mt-8 rounded-md bg-surface p-5 text-sm leading-7 text-muted sm:p-6">
              <p><strong className="font-medium text-ink">Status, 17 October 2026.</strong> Implemented in the subnet repository. Open admission is off by default, and no public round has run.</p>
              <p className="mt-3">Round one’s sealed holdout has 1,458 teacher-authored cases in six families. The incumbent, stock H2O Lightning 4B v1.2.3, scores Brier 0.184 and 87.7% accuracy on it.</p>
            </div>
            <p className="mt-6 text-sm leading-7 text-muted">Want to compete? Read the <a href={DOCS} className={LINK}>miner guide</a> in the Zils docs.</p>
          </Section>

          <Section id="d3-mini" eyebrow="d3-mini · recorded 16 October 2026 · one rented B300" title="d3-mini, tested as a base.">
            <p className="max-w-[70ch] text-[15px] leading-7 text-muted">d3-mini is a candidate base profile. It is not promoted and not live: it is not the default for new jobs, it is not deployed, and its promotion under the competition’s own rules is pending. Its first sealed draw cleared on 16 October 2026; the confirmation draw and the regression suite are still to run.</p>
            <Table label="d3-mini profile" head={['Property', 'Value']} rows={D3_PROFILE} />
            <p className="mt-4 max-w-[70ch] text-sm leading-7 text-muted">Merged on 16–17 October 2026 in the subnet and platform repositories: the profile, runtime, node qualification, images and video, platform routing, a <code className="font-mono text-xs">latest</code> channel that can point at d3-mini, and cross-profile upgrades. Through the training API, an existing task on H2O can be upgraded to a d3-mini adapter by setting <code className="font-mono text-xs">&quot;base_change&quot;: true</code> in the acceptance policy; the frozen previous release is scored on its own base and compared on the same test data. The dashboard does not offer this yet.</p>
            <h3 className="mt-10 text-xl font-semibold tracking-[-0.035em]">What we measured</h3>
            <Table label="d3-mini compared with the H2O incumbent, 16 October 2026" head={['Measure', 'H2O Lightning 4B v1.2.3', 'd3-mini', 'Reading']} rows={D3_EVIDENCE} wide />
            <p className="mt-4 max-w-[70ch] text-sm leading-7 text-muted">A feature probe answered yes/no, score, multi-question, JSON-state, one-, two- and four-image, and short-video requests correctly. It refused a 13,414-token state at the runtime’s 8,192-token limit.</p>
            <div className="mt-8 rounded-md bg-surface p-5 text-sm leading-7 text-muted sm:p-6">
              <p><strong className="font-medium text-ink">Limits.</strong> One card, one day. Nothing above 4,096 tokens was tested. The holdout is teacher-authored, not customer data. Passing the sealed-holdout decision rule makes a candidate eligible; it does not promote it.</p>
            </div>
          </Section>

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
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

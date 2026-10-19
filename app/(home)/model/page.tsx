import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { StickyIndex } from '@/components/site/sticky-index';
import { SiteButton } from '@/components/site/site-button';
import { DetailsRow } from '@/components/site/details-row';
import { FlightStudyDetails } from '@/components/flight-study';
import { ChessStudySummary } from '@/components/chess-study';
import { SupportStudyDetails } from '@/components/support-study';
import { JevComparisonDetails } from '@/components/jev-comparison';
import { ResearchOverview, ResearchModelGuide, ResearchMetricGuide } from '@/components/research-guide';
import { supportMethod, supportSource } from '@/lib/support-study';
import { SupportTrainingExample } from '@/components/support-decision-examples';
import s from '@/components/research-guide.module.css';
import { benchmark, readComparison, percent, decimal, milliseconds, comparisonHeadline } from '@/lib/model-benchmark';

export const metadata: Metadata = {
  title: 'zils — tuned open models can compete',
  description: 'In our October 2026 support and mate-in-one tests, task-tuned open JevK5 4B models outperformed official hosted TypeSafe JEV 1.13.0. JevK5 has since been retired; the base is now d3-mini 4.5B. Also: B300 miner follow-ups, how the base-model competition works (no public round yet), and recorded d3-mini evidence.',
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
  ['King of the hill', 'Only kings are paid. A winner becomes king when the owner promotes it. The base-tier share splits equally over the last five distinct kings still registered.'],
  ['No king', 'An empty track’s share is burned. The vendor base (stock d3-mini today) has no miner, so there is no king yet. Merged 19 October 2026, not yet live on chain.'],
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
  ['Stock model, first draw (round-one sealed holdout), validator decision rule', 'Brier 0.184 · 87.7% accuracy', 'Brier 0.142 · 89.8% accuracy', 'Eligible. Reproduced exactly on the node through the validator path, so real for that set'],
  ['Stock model, confirmation draw (second, disjoint, teacher-authored sealed set: 291 calibration and 1,156 test cases, scored 12 hours later)', 'Brier 0.1794 · 88.5% accuracy', 'Brier 0.1790 · 88.6% accuracy', 'No winner confirmed: improvement 0.0004, paired-bootstrap 95% interval −0.022 to +0.023; the rule needs at least 0.01 with a positive lower bound'],
  ['Families won (of six), first draw and confirmation draw', '0 and 3', '6 and 3', 'The first-draw result did not carry over; the second split three and three, narrowly. H2O improved between draws (0.184 to 0.179) while d3-mini fell (0.142 to 0.179), so the second set is not simply harder'],
  ['Adapter regression suite, one reference job (ABCD; the rule asks for three or four): calibrated Brier and accuracy', 'Brier 0.2801 · 81.6%', 'Brier 0.2515 · 84.0%', 'Passed, on one job'],
  ['Upgrading an existing H2O task to a d3-mini adapter with base_change: Brier', '0.1805 (previous H2O release)', '0.1667 (d3-mini candidate)', 'Improvement 0.0138 against a 0.01 threshold'],
  ['Adapter on the 500-case ABCD test cohort (frozen production recipe, 4,096 training examples, two seeds)', '83.0%', '83.4%', 'A tie: the interval includes zero'],
  ['Adapter on the historical ABCD cohort', '83.6%', '86.6%', 'd3-mini ahead; interval +0.6 to +5.4 points'],
  ['Exam prompt length, median input tokens', '528', '568', 'd3-mini prompts are about 40 tokens longer'],
] as const;
const SECTIONS = [
  { id: 'findings', n: '02', label: 'Findings' },
  { id: 'approach', n: '03', label: 'Approach' },
  { id: 'jev-comparison', n: '04', label: 'Support' },
  { id: 'chess-study', n: '05', label: 'Chess' },
  { id: 'flight-study', n: '06', label: 'Flights' },
  { id: 'base-tier', n: '07', label: 'Base tier' },
  { id: 'd3-mini', n: '08', label: 'd3-mini evidence' },
  { id: 'quality', n: '09', label: 'Earlier benchmark' },
  { id: 'metrics', n: '10', label: 'Metric guide' },
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

function Section({ id, label, eyebrow, title, children }: { id: string; label: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <>
    <SectionRow label={label} />
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-16 py-16 sm:py-20">
      <p className="text-xs text-muted">{eyebrow}</p>
      <h2 id={`${id}-heading`} className="mb-8 mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-[1.05] tracking-[-0.05em]">{title}</h2>
      {children}
    </section>
    </>
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
    <SiteFrame current="model">
      <div className={`${s.res} ${s.page}`}>
        <SectionRow n="01" label="Zils research" note="Recorded experiments · published evidence" />
        <header className={s.hero}>
          <div className={s.heroCopy}>
            <h1>Tuned open models can compete.</h1>
            <p className={s.heroLead}>We train open models for a specific job, then test them on examples they haven’t trained on. Here’s what improved, what didn’t, and how we measured it.</p>
            <SiteButton href="#findings" variant="primary">Explore the findings</SiteButton>
            <p className={s.heroNote}>Recorded experiments. Published evidence.<br /> Results apply to each test, not every task.</p>
          </div>
          <div className={s.heroFig}><SupportTrainingExample /></div>
          <nav aria-label="Project resources" className={s.resources}>
            <span>Explore the evidence</span>
            {RESOURCES.map(r => <a key={r.href} href={r.href}>{r.title}</a>)}
          </nav>
        </header>

        <div className={s.researchLayout}>
          <aside className={s.indexCol}><StickyIndex items={SECTIONS} /></aside>
          <div className={s.reports}>
          <SectionRow label="Findings" />
          <ResearchOverview />
          <SectionRow label="Approach" />
          <ResearchModelGuide />
          <SectionRow label="Support" />
          <JevComparisonDetails />
          <SectionRow label="Support study" />
          <SupportStudyDetails />
          <SectionRow label="Chess" />
          <ChessStudySummary />
          <SectionRow label="Flights" />
          <FlightStudyDetails />

          <Section id="base-tier" label="Base tier" eyebrow="Base tier · status as of 17 October 2026" title="A competition for the base model itself.">
            <p className="max-w-[70ch] text-[15px] leading-7 text-muted">Customer adapters train on a pinned base model. Since 17 October 2026 that base is d3-mini 4.5B (below); before that it was H2O Lightning 4B v1.2.3. The base tier is the competition that decides when that base changes. Miners submit a full-weight replacement for the pinned base of a text profile. Validators score it on a sealed holdout against the incumbent, and a candidate is promoted only if it passes every step below.</p>
            <Table label="How a candidate base is scored and promoted" head={['Step', 'Rule']} rows={PROMOTION_RULES} />
            <h3 className="mt-10 text-xl font-semibold tracking-[-0.035em]">Two channels</h3>
            <Table label="Base channels" head={['Channel', 'Advances', 'Who gets it']} rows={CHANNELS} />
            <p className="mt-4 max-w-[70ch] text-sm leading-7 text-muted">New customer jobs default to <code className="font-mono text-xs">stable</code>; <code className="font-mono text-xs">latest</code> is opt-in per job. Existing releases keep serving on their base.</p>
            <div className="mt-8 rounded-md bg-surface p-5 text-sm leading-7 text-muted sm:p-6">
              <p><strong className="font-medium text-ink">Status, 17 October 2026.</strong> Implemented in the subnet repository. Open admission is off by default, and no public round has run.</p>
              <p className="mt-3">Round one’s sealed holdout has 1,458 teacher-authored cases in six families. The incumbent, stock H2O Lightning 4B v1.2.3, scores Brier 0.184 and 87.7% accuracy on it. d3-mini’s confirmation draw did not confirm a winner, but d3-mini became the base by decision on 17 October (see below), so both channels now point at it and stock d3-mini is the incumbent for round two.</p>
            </div>
            <p className="mt-6 text-sm leading-7 text-muted">Want to compete? Read the <a href={DOCS} className={LINK}>miner guide</a> in the Zils docs. For every attempt so far, in order, see the <Link href="/miners" className={LINK}>miners page</Link>.</p>
          </Section>

          <Section id="d3-mini" label="d3-mini evidence" eyebrow="d3-mini · recorded 16–17 October 2026 · one rented B300" title="d3-mini, tested as a base.">
            <p className="max-w-[70ch] text-[15px] leading-7 text-muted">Under the base tier’s own rules, stock d3-mini was not promotable. On the night of 16–17 October 2026, one rented B300 ran for 6.75 hours. The first sealed draw cleared, but the confirmation draw did not confirm a winner (Brier 0.1790 for d3-mini against 0.1794 for H2O, an improvement of 0.0004 where the rule needs at least 0.01 with a positive lower bound). The adapter regression suite passed, on one reference job where the rule asks for three or four. Under those rules d3-mini was not promoted; it became the base by decision instead (below). No round-two decision was frozen under the exam.</p>
            <Table label="d3-mini profile" head={['Property', 'Value']} rows={D3_PROFILE} />
            <p className="mt-4 max-w-[70ch] text-sm leading-7 text-muted">Merged on 16–17 October 2026 in the subnet and platform repositories: the profile, runtime, node qualification, images and video, platform routing, a <code className="font-mono text-xs">latest</code> channel that can point at d3-mini, and cross-profile upgrades. Through the training API, an existing task on H2O can be upgraded to a d3-mini adapter by setting <code className="font-mono text-xs">&quot;base_change&quot;: true</code> in the acceptance policy; the frozen previous release is scored on its own base and compared on the same test data. The dashboard does not offer this yet.</p>
            <h3 className="mt-10 text-xl font-semibold tracking-[-0.035em]">What we measured</h3>
            <p className="mt-3 max-w-[70ch] text-[15px] leading-7 text-muted"><strong className="font-medium text-ink">Decision, 17 October 2026.</strong> Zils is adopting d3-mini as its base anyway, by the owner’s decision and recorded as an override of the promotion rule rather than a win under it. The grounds are capability: adapters trained on d3-mini beat adapters trained on H2O on the reference job and on ABCD, and d3-mini takes images and video, which H2O does not serve. Since the afternoon of 17 October 2026 both <code className="font-mono text-xs">stable</code> and <code className="font-mono text-xs">latest</code> name d3-mini, so new jobs train on it (4,096-token inputs, up to four images). Existing H2O jobs and releases keep their frozen profile and move only through <code className="font-mono text-xs">base_change</code> upgrade jobs; JevK5 is retired; H2O and Imajev retire once nothing served depends on them.</p>
            <Table label="d3-mini compared with the H2O incumbent, 16–17 October 2026" head={['Measure', 'H2O Lightning 4B v1.2.3', 'd3-mini', 'Reading']} rows={D3_EVIDENCE} wide />
            <p className="mt-4 max-w-[70ch] text-sm leading-7 text-muted">A feature probe answered yes/no, score, multi-question, JSON-state, one-, two- and four-image, and short-video requests correctly. It refused a 13,414-token state at the runtime’s 8,192-token limit.</p>
            <p className="mt-4 max-w-[70ch] text-sm leading-7 text-muted">The merged d3-mini code ran end to end on a GPU for the first time (qualification parity 5.3e-7). A d3-mini training job on the ABCD dataset was accepted, at 84.0% test accuracy and Brier 0.244 against 48.0% for stock d3-mini, and its release answered a text call and a one-image call.</p>
            <div className="mt-8 rounded-md bg-surface p-5 text-sm leading-7 text-muted sm:p-6">
              <p><strong className="font-medium text-ink">Limits.</strong> One card, one night. Nothing above 4,096 tokens was tested. The holdouts are teacher-authored, not customer data. Passing the sealed-holdout decision rule makes a candidate eligible; it does not promote it.</p>
            </div>
          </Section>

          <Section id="overview" label="Earlier research" eyebrow="Earlier research · Kev 0.8B" title="Previous experiments, preserved.">
            <p className="max-w-[70ch] text-[15px] leading-7 text-muted">This earlier experiment fine-tuned Kev 0.8B and tested it on the public JevBench items. Accuracy tied the unchanged checkpoint, while probability quality worsened. Its model, tasks, and scoring rules differ from the studies above. Checkpoint and dataset identities are preserved in the method below.</p>
          </Section>

          <Section id="quality" label="Earlier benchmark" eyebrow="Earlier JevBench comparison" title={comparisonHeadline(fez, kev)}>
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

            <DetailsRow summary="Method, checkpoint identities & limitations">
              <div className="space-y-5 pt-2 text-sm leading-7 text-muted">
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
            </DetailsRow>
          </Section>

          <SectionRow label="Metric guide" />
          <ResearchMetricGuide />

          <aside id="training" aria-label="Bittensor mining" className="scroll-mt-16 border-t border-edge py-8 text-sm leading-7 text-muted">
            <span id="participants" className="block scroll-mt-16" />
            <span id="testnet" className="block scroll-mt-16" />
            Mining, validation, and the recorded testnet round are on the <Link href="/miners" className={LINK}>Bittensor page</Link>.
          </aside>
          <p className="border-t border-edge py-8 text-xs leading-6 text-subtle">All results on this page are recorded experiments. The study reports define their scope, artifacts, and reproduction limits.</p>
          </div>
        </div>
      </div>
    </SiteFrame>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import jevbench from '@/public/model/jevbench-public-001.json';
import round from '@/public/model/testnet-round-001.json';
import { DecisionInstrument, RoundReplay, type ReplayTab } from './live';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { SupportStudySummary } from '@/components/support-study';
import { jevMetrics, jevTrained, jevErrorReduction } from '@/lib/jev-comparison';
import s from './home.module.css';

const TITLE = 'Your data. Your decision model.';
const DESCRIPTION = 'Train, evaluate, and deploy models for your business’s decisions.';

export const metadata: Metadata = {
  title: `zils — ${TITLE}`,
  description: `${DESCRIPTION} A trainable decision primitive for your AI stack, built around authorized labeled examples. Early access; customer delivery is planned.`,
  alternates: { canonical: 'https://zils.ai' },
  openGraph: {
    title: `zils — ${TITLE}`,
    description: `${DESCRIPTION} Early access; customer delivery is planned.`,
    url: 'https://zils.ai',
    siteName: 'Zils',
    type: 'website',
  },
  twitter: { card: 'summary', title: `zils — ${TITLE}`, description: `${DESCRIPTION} Early access; customer delivery is planned.` },
};

// Recorded figures are sourced from public experiment records.
const fez = jevbench.models.find((m) => m.id === 'fez')!.metrics;
const miners = round.miners;
const counts = round.benchmark.counts;
const onChain = round.chain.verification.on_chain_weights as Record<string, number>;

const REPLAY: ReplayTab[] = [
  {
    tab: 'Train',
    lines: [
      ['c', `# recorded round ${round.round_id.slice(0, 8)} · ${round.verified_at.slice(0, 10)}`],
      ['k', `$ base ${round.model.base} @ ${round.model.base_revision.slice(0, 7)}`],
      ['o', `  lora_rank ${round.training.lora_rank} · head_dim ${round.training.head_dim} · lr ${round.training.learning_rate} · epochs ${round.training.epochs}`],
      ['o', `  splits  train ${counts.train.cases} · calibration ${counts.calibration.cases} · test ${counts.test.cases} (held out)`],
      ['o', `  placement  ${round.hardware.participant_placement}`],
      ['o', `  device  ${round.hardware.processor} · ${round.hardware.device} · ${round.hardware.dtype}`],
      ['a', `✓ ${miners.length} candidate checkpoints trained`],
    ],
  },
  {
    tab: 'Evaluate',
    lines: [
      ['k', `$ evaluate · rubric ${round.benchmark.rubric} · ${counts.test.cases} held-out cases`],
      ...miners.map(
        (m) =>
          [
            'o',
            `  uid ${m.uid}  ${m.correct}/${m.cases}  acc ${(m.accuracy * 100).toFixed(1)}%  brier ${m.brier.toFixed(3)}  confident errors ${m.confident_errors}`,
          ] as const,
      ),
      ['c', `# uniform-guess brier would be ${miners[0].uniform_brier.toFixed(3)}; lower is better`],
      ['a', '✓ every candidate beat the uniform baseline'],
    ],
  },
  {
    tab: 'Verify',
    lines: [
      ['k', `$ set_weights · ${round.chain.network}net · netuid ${round.chain.netuid} · commit-reveal`],
      ['o', `  extrinsic ${round.chain.weight_transaction.extrinsic_id}`],
      ['o', `  on-chain u16  ${Object.entries(onChain).map(([uid, w]) => `uid${uid} ${w}`).join(' · ')}`],
      ['c', '# connection dropped during confirmation;'],
      ['c', '# inclusion recovered from the block, not resubmitted'],
      ['a', `✓ weights verified at block ${round.chain.verification.block}`],
    ],
  },
];

const USE_CASES = [
  ['Choose the right model', 'Evaluate whether a request needs a larger model or can stay on a smaller one. Reserve expensive calls for the work that needs them.', 'Request → model'],
  ['Select the next tool', 'Turn context into a choice among the tools your agent can use, without generating a full text response for every selection.', 'Context → tool'],
  ['Know when to escalate', 'Use labeled outcomes to evaluate whether an agent should continue, retry, or ask for review before the next step.', 'Agent state → next action'],
] as const;

const STEPS = [
  ['Provide labeled examples', 'One recurring decision, its possible outcomes, and data you’re authorized to train on, with a separate set held out.'],
  ['Train candidates', 'Adapt a starting model to the task. Recipes and candidate versions stay traceable.'],
  ['Evaluate against a baseline', 'Accuracy, probability quality, consequential mistakes, latency, and total cost vs. your current approach.'],
  ['Deploy a qualifying model', 'Acceptance criteria are agreed before training. Only a candidate that meets them moves on.'],
] as const;

const DELIVERABLES = [
  { title: 'A versioned model', body: 'A selected checkpoint with its identity, training configuration, and dependencies recorded.', art: 'rings' },
  { title: 'Evaluation evidence', body: 'Baseline comparison, dataset and rubric versions, measured tradeoffs, known limitations.', art: 'target' },
  { title: 'A deployment plan', body: 'Self-hosting or a managed endpoint, assessed against your app, hardware, and data requirements.', art: 'stairs' },
] as const;

export default function HomePage() {
  return (
    <div className={`${s.home} min-h-screen bg-page font-sans text-[var(--zils-ink)] antialiased`}>
      <ResearchStatus />

      <div className="relative overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-6 sm:px-8">
          <SiteHeader tone="light" />
        </div>

        <main id="main-content" tabIndex={-1} className="relative">
          {/* ── Hero ─────────────────────────────────────────── */}
          <section className="mx-auto max-w-4xl px-6 pb-24 pt-8 text-center sm:px-8">
            <ZilsWordmark className="text-[112px] text-[var(--zils-accent)] sm:text-[144px]" />
            <p className="mt-8 flex items-center justify-center gap-2 text-[12px] font-medium">
              Specialized decision models · Early access
            </p>
            <h1 className="mt-5 text-balance text-[clamp(2.9rem,7vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.06em]">
              Your data.
              <br />
              Your decision model.
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-[18px] leading-7 text-muted">{DESCRIPTION}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
              <Link href="/contact" className="inline-flex items-center rounded-md bg-action px-5 py-3 text-[13px] font-medium text-on-action transition-colors hover:bg-action-hover">
                Contact us
              </Link>
              <a href="#workflow" className="text-[13px] hover:text-[var(--zils-accent)]">
                See how it works ↓
              </a>
            </div>

            <div className="mt-16">
              <DecisionInstrument />
              <p className="mt-4 text-xs leading-5 text-subtle">
                Illustrative examples. These are not model outputs.
              </p>
            </div>
          </section>

          <SupportStudySummary />

          {/* ── Intro ────────────────────────────────────────── */}
          <section aria-labelledby="intro" className="mx-auto max-w-5xl border-t border-edge px-6 pt-20 text-center sm:px-8">
            <h2 id="intro" className="mt-5 text-[clamp(2.1rem,4.4vw,3.3rem)] font-semibold leading-[1.04] tracking-[-0.055em]">
              Small decisions.
              <br />A big part of your AI bill.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-muted">
              Model selection. Tool choice. Escalation. Zils is building a trainable decision primitive for these repeated judgments: context in, probabilities out. The goal is to replace full LLM calls where a specialized model can meet your quality bar.
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-subtle">
              Potential savings depend on call volume, serving costs, and quality. Customer cost savings have not yet been measured.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 border-y border-edge py-6 text-[11px] text-muted">
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[var(--zils-accent)]" />
                Training &amp; evaluation implemented
              </span>
              <span>Customer delivery planned</span>
              <Link href="/model" className="text-ink hover:text-[var(--zils-accent)]">
                Explore the research ↗
              </Link>
            </div>
          </section>

          {/* ── Use cases ───────────────────────────────────── */}
          <section aria-labelledby="cases" className="mx-auto max-w-5xl px-6 py-24 sm:px-8">
            <Heading id="cases" eyebrow="Inside the AI stack" aside="Train on authorized labeled examples from your workflows. Evaluate against your current stack, including quality, latency, and total cost.">
              Put a decision model
              <br />
              where the calls add up.
            </Heading>
            <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-edge">
              {USE_CASES.map(([title, body, io]) => (
                <article key={title} className="flex flex-col md:px-8 first:md:pl-0 last:md:pr-0">
                  <h3 className="text-[22px] font-semibold tracking-[-0.035em]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
                  <span className="mt-6 self-start font-mono text-xs text-[var(--zils-accent)]">{io}</span>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* ── Workflow + replay ──────────────────────────────── */}
      <section id="workflow" aria-labelledby="workflow-h" className="scroll-mt-8 bg-[var(--zils-surface)] px-6 py-24 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="flex items-center justify-center gap-2 text-[12px] font-medium">
            Training workflow
          </p>
          <h2 id="workflow-h" className="mx-auto mt-4 max-w-2xl text-balance text-center text-[clamp(2.1rem,4.4vw,3.3rem)] font-semibold leading-[1.04] tracking-[-0.055em]">
            Good examples in.
            <br />
            Evidence behind every decision.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center text-sm leading-6 text-muted">
            Train a task-specific adapter, verify its checkpoint, and compare its predictions with a starting model. Evaluate quality before using a candidate for decisions.
          </p>

          <ol className="mt-14 grid gap-px overflow-hidden rounded-md bg-edge ring-1 ring-edge md:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="bg-page/90 p-6">
                <span className="font-mono text-xs text-[var(--zils-accent)]">0{i + 1}</span>
                <h3 className="mt-5 text-[15px] font-semibold tracking-[-0.02em]">{title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted">{body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-20 grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-start">
            <div className="md:pt-12">
              <p className="text-xs text-subtle">Recorded testnet round</p>
              <h3 className="mt-3 text-[28px] font-semibold leading-[1.08] tracking-[-0.04em]">Train. Evaluate. Verify. On the record.</h3>
              <p className="mt-4 text-sm leading-6 text-muted">
                Inspect the recorded Bittensor testnet round, from training through on-chain verification. Every number comes from the public record.
              </p>
              <a href="/model/testnet-round-001.json" className="mt-5 inline-block font-mono text-xs underline decoration-edge-strong underline-offset-4 hover:decoration-ink">
                testnet-round-001.json ↗
              </a>
            </div>
            <RoundReplay tabs={REPLAY} caption={round.limitations.slice(0, 2).join(' ')} />
          </div>
        </div>
      </section>

      {/* ── Deliverables ───────────────────────────────────── */}
      <section aria-labelledby="deliver" className="mx-auto max-w-5xl px-6 py-24 sm:px-8">
        <Heading id="deliver" eyebrow="Planned deliverables" aside="Know what was trained, how it was tested, and what it would take to put it to work.">
          More than a model.
          <br />A basis for confidence.
        </Heading>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {DELIVERABLES.map((d) => (
            <article key={d.title} className="relative flex min-h-[290px] flex-col overflow-hidden rounded-md border border-edge bg-[var(--zils-soft)] p-6">
              <h3 className="text-[22px] font-semibold tracking-[-0.035em]">{d.title}</h3>
              <p className="mt-2 max-w-[24ch] text-[13px] leading-5 text-muted">{d.body}</p>
              <LineArt kind={d.art} />
            </article>
          ))}
        </div>
        <div className="mt-6 grid gap-2 rounded-md bg-[var(--zils-surface)] p-6 text-sm md:grid-cols-[12rem_1fr]">
          <span className="font-semibold">Data, considered.</span>
          <p className="leading-6 text-muted">
            Current research worker bundles include copies of training data; confidential distributed training is not supported. Data handling is part of scoping. No Zils model release is publicly available yet.
          </p>
        </div>
      </section>

      {/* Latest comparison and earlier studies share one research record. */}
      <section aria-labelledby="evidence" className="mx-auto max-w-5xl px-6 pb-20 sm:px-8">
        <div className="grid gap-6 border-t border-edge pt-8 md:grid-cols-[1fr_1.4fr]">
          <h2 id="evidence" className="max-w-[19ch] text-2xl font-semibold leading-tight tracking-[-0.035em]">Latest results. Full research record.</h2>
          <div>
            <p className="text-sm leading-7 text-muted">On {jevMetrics.n} held-out ABCD support conversations, trained Zils reached <strong className="font-semibold text-ink">{(jevTrained.accuracy * 100).toFixed(1)}% accuracy versus {(jevMetrics.accuracy * 100).toFixed(1)}% for TypeSafe Jev</strong>—{jevErrorReduction}% fewer mistakes. The full comparison includes every prediction, confidence tradeoffs, and the test method.</p>
            <p className="mt-4 text-sm leading-7 text-muted">Earlier studies remain available. The flight adapter improved over its base model but trailed simple historical rates. The Kev 0.8B experiment tied the published baseline at {fez.n_correct} of {fez.n_attempted} correct answers, with worse probability estimates. Each study measures a different task.</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <Link href="/model#jev-comparison" className="underline decoration-edge-strong underline-offset-4 hover:text-[var(--zils-accent)]">Read the latest Jev comparison</Link>
              <Link href="/model#flight-study" className="underline decoration-edge-strong underline-offset-4 hover:text-[var(--zils-accent)]">Read the flight study</Link>
              <Link href="/model#quality" className="underline decoration-edge-strong underline-offset-4 hover:text-[var(--zils-accent)]">Read the JevBench comparison</Link>
              <Link href="/bittensor#testnet" className="underline decoration-edge-strong underline-offset-4 hover:text-[var(--zils-accent)]">Inspect the recorded testnet round</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section aria-labelledby="cta" className="px-6 pb-24 sm:px-8">
        <div className="mx-auto max-w-5xl rounded-md bg-[#15151a] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div>
            <h2 id="cta" className="text-balance text-[clamp(2.1rem,5vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.055em] text-white">
              Your next model starts
              <br />
              with a better question.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-neutral-400">
              Where do repeated decisions add up in your AI stack? Tell us about the calls, your labeled examples, and the quality bar a smaller model would need to meet.
            </p>
            <Link href="/contact" className="mt-8 inline-flex items-center rounded-md bg-[#fff] px-5 py-3 text-[13px] font-medium text-black transition-colors hover:bg-[#eceafa]">
              Contact us
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter showSmallWordmark={false} />
    </div>
  );
}

function ResearchStatus() {
  return (
    <div className="border-b border-edge bg-[var(--zils-surface)] text-[11px] text-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-2.5 sm:px-8">
        <span>Research preview</span>
        <Link href="/model#jev-comparison" className="hover:text-[var(--zils-accent)]">
          Trained Zils vs TypeSafe Jev <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}

function Heading({ id, eyebrow, aside, children }: { id: string; eyebrow: string; aside: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_20rem] md:items-end">
      <div>
        <p className="flex items-center gap-2 text-[12px] font-medium">
          {eyebrow}
        </p>
        <h2 id={id} className="mt-4 text-[clamp(2.1rem,4.4vw,3.3rem)] font-semibold leading-[1.04] tracking-[-0.055em]">
          {children}
        </h2>
      </div>
      <p className="text-sm leading-6 text-muted">{aside}</p>
    </div>
  );
}

function LineArt({ kind }: { kind: (typeof DELIVERABLES)[number]['art'] }) {
  const cls = 'pointer-events-none absolute -bottom-8 -right-8 size-44 text-[var(--zils-accent)]/25';
  if (kind === 'rings')
    return (
      <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.7" className={cls}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={20 + i * 12} y={20 + i * 12} width="36" height="36" />
        ))}
      </svg>
    );
  if (kind === 'target')
    return (
      <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.7" className={cls}>
        <circle cx="50" cy="50" r="16" />
        <circle cx="50" cy="50" r="32" />
        <path d="M50 0 V100 M0 50 H100" />
      </svg>
    );
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.7" className={cls}>
      <path d="M0 90 H30 V65 H55 V40 H80 V15 H100" />
      <path d="M0 100 H100" />
    </svg>
  );
}

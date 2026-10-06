import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import testnet from '@/public/model/testnet-round-001.json';

export const metadata: Metadata = {
  title: 'zils — Bittensor mining',
  description: 'Mining, validation, and the recorded Zils Bittensor testnet rehearsal. Explore the training process, participants, and verified on-chain weights.',
  alternates: { canonical: 'https://zils.ai/bittensor' },
};

const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const REPO = 'https://github.com/ooo-hq/zils';
const TESTNET_SOURCE = '/model/testnet-round-001.json';
const LINK = 'underline decoration-edge-strong underline-offset-4 hover:text-accent hover:decoration-accent';
const CELL = 'border-t border-edge px-3 py-3 text-right tabular-nums sm:px-5';
const HEAD = 'border-t border-edge px-3 py-3 text-left font-normal text-ink sm:px-5';
const CARD = 'rounded-2xl bg-page ring-1 ring-edge';
const SECTIONS = [
  { id: 'training', title: 'Training & evaluation' },
  { id: 'participants', title: 'Participants' },
  { id: 'testnet', title: 'Testnet publication' },
] as const;
const PROCESS = [
  ['Train', 'Miners train compatible adapters and decision heads with a fixed one-epoch recipe and different seeds.'],
  ['Submit', 'Each miner freezes a candidate and signs its checkpoint hash for the validator.'],
  ['Evaluate', 'The validator verifies the checkpoint and runs its own evaluation of the model’s probabilities.'],
  ['Reward', 'Family-macro Brier skill determines proposed weights across eligible candidates.'],
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

export default function BittensorPage() {
  return (
    <div className="min-h-screen bg-page font-sans text-ink antialiased selection:bg-[#4942c7] selection:text-white">
      <div className="relative overflow-hidden bg-surface">
        <div className="relative mx-auto max-w-6xl px-6 sm:px-8"><SiteHeader tone="light" current="bittensor" /></div>
        <header className="relative mx-auto max-w-5xl px-6 pb-16 pt-10 sm:px-8 sm:pt-16">
          <p className="flex items-center gap-2 text-[12px] font-medium"><span aria-hidden="true" className="text-base">✳</span> Bittensor · Recorded testnet research</p>
          <h1 className="mt-5 max-w-[16ch] text-[clamp(2.7rem,6.5vw,4.8rem)] font-semibold leading-[0.98] tracking-[-0.06em]">Bittensor mining.</h1>
          <p className="mt-6 max-w-[58ch] text-lg leading-8 text-muted">How miners train decision models, validators evaluate them, and weights reach the chain. One testnet rehearsal is recorded here, with its evidence and limitations.</p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <a href="#testnet" className="inline-flex min-h-11 items-center rounded-md bg-action px-5 py-3 text-sm font-medium text-on-action hover:bg-action-hover">View the recorded round</a>
            <Link href="/model" className={`${LINK} text-sm`}>Model research</Link>
          </div>
        </header>
      </div>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-6 sm:px-8">
        <nav aria-label="On this page" className="sticky top-0 z-10 -mx-2 flex gap-1.5 overflow-x-auto bg-page/85 px-2 py-3 backdrop-blur">
          {SECTIONS.map(section => <a key={section.id} href={`#${section.id}`} className="shrink-0 rounded-full bg-page px-4 py-1.5 text-xs text-muted ring-1 ring-edge hover:text-ink">{section.title}</a>)}
        </nav>

        <Section id="training" eyebrow="Training & evaluation" title="Train. Submit. Evaluate. Reward.">
          <ol className="grid gap-px overflow-hidden rounded-2xl bg-edge ring-1 ring-edge sm:grid-cols-2 lg:grid-cols-4">{PROCESS.map(([title, description], index) => <li key={title} className="bg-page p-6"><span className="font-mono text-xs text-[#FF6A00]">0{index + 1}</span><h3 className="mt-4 font-semibold tracking-[-0.02em]">{title}</h3><p className="mt-2 text-[13px] leading-6 text-muted">{description}</p></li>)}</ol>
          <div className="mt-6 rounded-2xl border border-dashed border-edge-strong p-6"><h3 className="font-semibold tracking-[-0.02em]">One testnet round completed</h3><p className="mt-2 text-sm leading-6 text-muted">Training, signed submissions, evaluation, and revealed chain weights are recorded below. A live submission queue and round feed are not connected.</p><a href="#testnet" className={`${LINK} mt-3 inline-block text-sm`}>View the verified round</a></div>
          <p className="mt-5 max-w-[70ch] text-sm leading-7 text-muted">The local loop works on Apple Silicon and an RTX 4090. Accuracy and latency are diagnostics, not separate reward components. The subnet’s family-macro Brier and JevBench Brier use different aggregation rules.</p>
          <a href={`${REPO}/blob/main/docs/evaluation.md`} className={`${LINK} mt-4 inline-block text-sm`}>Evaluation contract</a>
        </Section>

        <Section id="participants" eyebrow="Participants" title="Three miners. One validator. One host.">
          <p className="mb-5 text-sm text-muted">Three registered miners and one validator completed the recorded subnet {testnet.chain.netuid} rehearsal.</p>
          <dl className={`divide-y divide-edge ${CARD}`}>{[['Miners · UIDs 1–3', 'Trained and submitted three distinct checkpoints'], ['Validator · UID 0', 'Evaluated the checkpoints and published weights']].map(([role, description]) => <div key={role} className="grid gap-x-4 gap-y-1 p-5 sm:grid-cols-[1fr_auto]"><dt className="font-medium">{role}</dt><dd className="text-xs text-muted sm:col-start-1">{description}</dd><dd className="mt-2 font-mono text-[10px] tracking-[0.1em] text-subtle sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:self-center">RECORDED PARTICIPATION</dd></div>)}</dl>
          <p className="mt-4 text-xs leading-6 text-subtle">One operator ran all four processes on one host. Services exited after the round; these counts do not indicate current availability or independent operators.</p>
          <a href={`${REPO}/blob/main/docs/mining.md`} className={`${LINK} mt-4 inline-block text-sm`}>Miner guide</a>
        </Section>

        <Section id="testnet" eyebrow="Testnet publication" title={`Bittensor testnet · Subnet ${testnet.chain.netuid}`}>
          <div className={CARD}>
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <p className="flex items-center gap-2 text-sm"><span className="size-1.5 rounded-full bg-emerald-500" />First training-to-chain round completed. Revealed weights verified.</p>
              <a href={TESTNET_SOURCE} className={`${LINK} text-sm`}>Round evidence (JSON) ↗</a>
            </div>
            <dl className="grid gap-6 border-t border-edge p-5 text-xs sm:grid-cols-2 lg:grid-cols-4">{[['Network', 'Bittensor testnet'], ['Publication receipt', testnet.chain.weight_transaction.extrinsic_id], ['Verified at block', testnet.chain.verification.block.toLocaleString('en-US')], ['Round status', 'Completed · recorded rehearsal']].map(([label, value]) => <div key={label}><dt className="text-subtle">{label}</dt><dd className="mt-2 font-mono">{value}</dd></div>)}</dl>
            <div role="region" aria-label="Recorded testnet miner weights" tabIndex={0} className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <caption className="sr-only">Three evaluated miners and their verified testnet weight allocation</caption>
                <thead className="bg-surface text-xs text-muted"><tr><th scope="col" className={HEAD}>Miner UID</th><th scope="col" className={CELL}>Correct / 224</th><th scope="col" className={CELL}>Requested weight</th><th scope="col" className={CELL}>On-chain value</th></tr></thead>
                <tbody>{testnet.miners.map(miner => <tr key={miner.uid} className="hover:bg-surface"><th scope="row" className={HEAD}>{miner.uid}</th><td className={CELL}>{miner.correct} / {miner.cases}</td><td className={`${CELL} font-medium`}>{percent(miner.requested_weight)}</td><td className={`${CELL} font-mono`}>{miner.on_chain_u16.toLocaleString('en-US')}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="border-t border-edge p-5 text-xs leading-6 text-subtle">Weights are based on family-macro Brier skill. The chain stores maximum-scaled integers; their normalized proportions matched the requested allocation within quantization tolerance. Verified <time dateTime={testnet.verified_at}>{time(testnet.verified_at)}</time>. This is the observation time, not a live refresh.</p>
          </div>
          <p className="mt-4 text-xs leading-6 text-muted">Each 0.8B checkpoint trained for one epoch on 224 examples, calibrated on 112 questions, and was evaluated on the same 224 test questions. This reused synthetic development benchmark is separate from the <Link href="/model#quality" className={LINK}>public JevBench comparison</Link>. All compute ran on one Apple M4 Pro with 24 GiB memory, with GPU jobs serialized.</p>
          <p className="mt-3 text-xs leading-6 text-muted">This closed rehearsal demonstrates the training-to-chain path. It does not establish mainnet deployment, miner earnings, open competition, or automatic model promotion.</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm"><a href={TESTNET_SOURCE} className={LINK}>Scores, methodology & chain evidence</a><a href={`${REPO}/blob/main/docs/testnet.md`} className={LINK}>Testnet guide</a><a href={`${REPO}/blob/main/docs/roadmap.md`} className={LINK}>Roadmap</a></div>
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}

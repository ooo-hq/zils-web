import type { ReactNode } from 'react';
import Link from 'next/link';
import testnet from '@/public/model/testnet-round-001.json';
import s from './miners.module.css';

// Moved verbatim from the retired /bittensor page. Every sentence is checked against tests/browser/fixtures/content-baseline.json.
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const REPO = 'https://github.com/ooo-hq/zils';
const TESTNET_SOURCE = '/model/testnet-round-001.json';
const SECTIONS = [
  { id: 'training', title: 'Training & evaluation' },
  { id: 'participants', title: 'Participants' },
  { id: 'testnet', title: 'Testnet publication' },
  { id: 'base-tier', title: 'Base tier' },
] as const;
const PROCESS = [
  ['Train', 'Miners train compatible adapters and decision heads with a fixed one-epoch recipe and different seeds.'],
  ['Submit', 'Each miner freezes a candidate and signs its checkpoint hash for the validator.'],
  ['Evaluate', 'The validator verifies the checkpoint and runs its own evaluation of the model’s probabilities.'],
  ['Reward', 'Family-macro Brier skill determines proposed weights across eligible candidates.'],
] as const;
const PAYOUT = [
  ['Winner takes all', 'The best eligible candidate takes the round’s whole base-tier share. Eligible runners-up earn nothing.'],
  ['King of the hill', 'Once promoted, the winner’s miner keeps the whole base-tier share every epoch until an eligible challenger appears.'],
] as const;

function time(value: string) {
  return `${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'UTC', hourCycle: 'h23',
  }).format(new Date(value))} UTC`;
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={s.rhSection}>
      <p className={s.rhEyebrow}><span aria-hidden="true">✳</span> {eyebrow}</p>
      <h3 id={`${id}-heading`} className={s.rhTitle}>{title}</h3>
      {children}
    </section>
  );
}

export function Rehearsal() {
  return (
    <div className={s.rh}>
      <nav aria-label="On this page" className={s.rhNav}>
        {SECTIONS.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
      </nav>

      <Section id="training" eyebrow="Training & evaluation" title="Train. Submit. Evaluate. Reward.">
        <ol className={s.rhSteps}>{PROCESS.map(([title, description], index) => <li key={title}><span className={s.rhNum}>0{index + 1}</span><h4>{title}</h4><p>{description}</p></li>)}</ol>
        <div className={s.rhDashed}><h4>One testnet round completed</h4><p>Training, signed submissions, evaluation, and revealed chain weights are recorded below. A live submission queue and round feed are not connected.</p><a href="#testnet" className={s.rhLink}>View the verified round</a></div>
        <p className={s.rhBody}>The local loop works on Apple Silicon and an RTX 4090. Accuracy and latency are diagnostics, not separate reward components. The subnet’s family-macro Brier and JevBench Brier use different aggregation rules.</p>
        <a href={`${REPO}/blob/main/docs/evaluation.md`} className={s.rhLink}>Evaluation contract</a>
      </Section>

      <Section id="participants" eyebrow="Participants" title="Three miners. One validator. One host.">
        <p className={s.rhBody}>Three registered miners and one validator completed the recorded subnet {testnet.chain.netuid} rehearsal.</p>
        <dl className={s.rhCard}>{[['Miners · UIDs 1–3', 'Trained and submitted three distinct checkpoints'], ['Validator · UID 0', 'Evaluated the checkpoints and published weights']].map(([role, description]) => <div key={role} className={s.rhRole}><dt>{role}</dt><dd>{description}</dd><dd className={s.rhTag}>RECORDED PARTICIPATION</dd></div>)}</dl>
        <p className={s.rhFine}>One operator ran all four processes on one host. Services exited after the round; these counts do not indicate current availability or independent operators.</p>
        <a href={`${REPO}/blob/main/docs/mining.md`} className={s.rhLink}>Miner guide</a>
      </Section>

      <Section id="testnet" eyebrow="Testnet publication" title={`Bittensor testnet · Subnet ${testnet.chain.netuid}`}>
        <div className={s.rhCard}>
          <div className={s.rhHead}>
            <p>First training-to-chain round completed. Revealed weights verified.</p>
            <a href={TESTNET_SOURCE} className={s.rhLink}>Round evidence (JSON) ↗</a>
          </div>
          <dl className={s.rhFacts}>{[['Network', 'Bittensor testnet'], ['Publication receipt', testnet.chain.weight_transaction.extrinsic_id], ['Verified at block', testnet.chain.verification.block.toLocaleString('en-US')], ['Round status', 'Completed · recorded rehearsal']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <div role="region" aria-label="Recorded testnet miner weights" tabIndex={0} className={s.rhScroll}>
            <table className={s.rhTable}>
              <caption className="sr-only">Three evaluated miners and their verified testnet weight allocation</caption>
              <thead><tr><th scope="col">Miner UID</th><th scope="col">Correct / 224</th><th scope="col">Requested weight</th><th scope="col">On-chain value</th></tr></thead>
              <tbody>{testnet.miners.map(miner => <tr key={miner.uid}><th scope="row">{miner.uid}</th><td>{miner.correct} / {miner.cases}</td><td>{percent(miner.requested_weight)}</td><td>{miner.on_chain_u16.toLocaleString('en-US')}</td></tr>)}</tbody>
            </table>
          </div>
          <p className={s.rhFine}>Weights are based on family-macro Brier skill. The chain stores maximum-scaled integers; their normalized proportions matched the requested allocation within quantization tolerance. Verified <time dateTime={testnet.verified_at}>{time(testnet.verified_at)}</time>. This is the observation time, not a live refresh.</p>
        </div>
        <p className={s.rhBody}>Each 0.8B checkpoint trained for one epoch on 224 examples, calibrated on 112 questions, and was evaluated on the same 224 test questions. This reused synthetic development benchmark is separate from the <Link href="/model#quality" className={s.rhInline}>public JevBench comparison</Link>. All compute ran on one Apple M4 Pro with 24 GiB memory, with GPU jobs serialized.</p>
        <p className={s.rhBody}>This closed rehearsal demonstrates the training-to-chain path. It does not establish mainnet deployment, miner earnings, open competition, or automatic model promotion.</p>
        <div className={s.rhLinks}><a href={TESTNET_SOURCE} className={s.rhInline}>Scores, methodology & chain evidence</a><a href={`${REPO}/blob/main/docs/testnet.md`} className={s.rhInline}>Testnet guide</a><a href={`${REPO}/blob/main/docs/roadmap.md`} className={s.rhInline}>Roadmap</a></div>
      </Section>

      <Section id="base-tier" eyebrow="Base tier · status as of 18 October 2026" title="A competition for the base model itself.">
        <p className={s.rhBody}>Customer adapters train on one pinned base model. Since 17 October 2026 that base is d3-mini 4.5B. In the base tier, miners submit a full-weight replacement for that base. Validators score each candidate on a sealed holdout against the incumbent, and a candidate is promoted only after it also passes a second sealed draw and an adapter regression suite.</p>
        <dl className={s.rhCard}>{PAYOUT.map(([rule, description]) => <div key={rule} className={s.rhRule}><dt>{rule}</dt><dd>{description}</dd></div>)}</dl>
        <p className={s.rhFine}>The incumbent today is stock d3-mini, a vendor base with no miner behind it, so it pays nobody. No candidate has been promoted, no base-tier weights have been published, and nothing runs on mainnet yet.</p>
        <Link href="/model#base-tier" className={s.rhLink}>Full promotion rules</Link>
      </Section>
    </div>
  );
}

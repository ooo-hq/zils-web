import { MODEL_NAMES, modelDisplayName } from '@/lib/model-name';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { DetailsRow } from '@/components/site/details-row';
import { MinerBoard, MinerRefresh } from '@/components/site/miner-board';
import { InstallCommand } from '@/components/site/install-command';
import { currentBase } from '@/lib/base-model';
import { boardNumbers } from '@/lib/miner-board';
import { baseSubmissions, networkMiners } from '@/lib/network-miners';
import { Rehearsal } from './rehearsal';
import { Competitions } from './competitions';
import s from './miners.module.css';

export const metadata: Metadata = {
  title: 'Zils — miners',
  description: 'Zils training miners: whether they are online, which models they report, and how their candidates did. Plus each attempt to improve the shared base model.',
  alternates: { canonical: 'https://zils.ai/miners' },
};

const DOCS = 'https://docs.zils.ai';
const utc = (iso: string) => new Date(iso).toUTCString().slice(17, 22);

type Compare = { label: string; left: { name: string; value: number; text: string }; right: { name: string; value: number; text: string }; lowerIsBetter?: boolean };
type Entry = { date: string; title: string; outcome: string; tone: 'win' | 'tie' | 'loss' | 'decision' | 'next'; body: string; compare?: Compare };

// Every number below is from the dated reports under output/ (16–17 October 2026). Update this list, not the copy around it.
const TIMELINE: Entry[] = [
  {
    date: '15–16 Oct 2026', title: 'Round zero: can full-weight training beat adapters?', outcome: 'Not yet', tone: 'loss',
    body: 'We retrained every weight of the old base, H2O Lightning 4B, on one rented B300. It worked, but at equal data it trailed the small adapters we already use. No new base qualified, and the weights were not kept.',
    compare: { label: 'Test accuracy on ABCD, 4,096 training examples', left: { name: 'Full weights', value: .798, text: '79.8%' }, right: { name: 'Adapter (LoRA)', value: .844, text: '84.4%' } },
  },
  {
    date: '16 Oct 2026', title: 'A new candidate on the sealed exam', outcome: 'Cleared the first draw', tone: 'win',
    body: 'Stock d3-mini, an open 4.5B model on the same backbone, sat the sealed round-one exam: 1,166 test cases in six families, scored by the validators’ own code. It beat the incumbent and was marked eligible.',
    compare: { label: 'Brier score, lower is better', left: { name: 'H2O (incumbent)', value: .1842, text: '0.184' }, right: { name: 'd3-mini', value: .1419, text: '0.142' }, lowerIsBetter: true },
  },
  {
    date: '16 Oct 2026', title: 'Do adapters on the new base hold up?', outcome: 'Matched or better', tone: 'win',
    body: 'Two training seeds on d3-mini matched the H2O adapter on text (83.4% and 83.6% against 83.0%). On product-inspection photos, a d3-mini adapter scored 169 of 200 against 168 for the image model it would replace.',
    compare: { label: 'Text adapter, test accuracy on ABCD', left: { name: 'H2O adapter', value: .83, text: '83.0%' }, right: { name: 'd3-mini adapter', value: .836, text: '83.6%' } },
  },
  {
    date: '17 Oct 2026', title: 'The confirmation exam', outcome: 'A tie, so no winner', tone: 'tie',
    body: 'The rules ask a winner to repeat its result on a second, fresh sealed exam at least 12 hours later. It did not: the two bases tied, well short of the 0.01 improvement the rules require. The adapter check passed (Brier 0.2515 against 0.2801).',
    compare: { label: 'Brier score on the second exam, lower is better', left: { name: 'H2O (incumbent)', value: .1794, text: '0.1794' }, right: { name: 'd3-mini', value: .1790, text: '0.1790' }, lowerIsBetter: true },
  },
  {
    date: '17 Oct 2026', title: 'd3-mini becomes the base, by decision', outcome: 'Adopted', tone: 'decision',
    body: 'We adopted d3-mini anyway, for what it adds: adapters that train better, up to four images and a video per call, and yes/no, choice and score answers. This is recorded as an override of the promotion rule, not a win under it. H2O and the separate image model stopped serving the same day.',
  },
  {
    date: 'Next', title: 'Round two: beat the base', outcome: 'Open on testnet', tone: 'next',
    body: 'Challenge the current base in your tier. Anyone registered on testnet 579 can enter: upload to Hugging Face, commit on chain, and every validator pulls and scores it. We also want the exam to cover images and video, since that is what the base is used for.',
  },
];

function Bars({ compare }: { compare: Compare }) {
  const max = Math.max(compare.left.value, compare.right.value);
  const rows = [compare.left, compare.right];
  const best = compare.lowerIsBetter ? Math.min(...rows.map(r => r.value)) : Math.max(...rows.map(r => r.value));
  return <figure className={s.compare}>
    <figcaption>{compare.label}</figcaption>
    <dl>{rows.map(row => <div key={row.name} data-best={row.value === best || undefined}>
      <dt>{row.name}</dt>
      <dd className={s.value}>{row.text}</dd>
      <dd aria-hidden="true" className={s.track}><span className={s.fill} style={{ width: `${(row.value / max) * 100}%` }} /></dd>
    </div>)}</dl>
  </figure>;
}

export default async function MinersPage() {
  const [base, network, submissions] = await Promise.all([currentBase(), networkMiners(), baseSubmissions()]);
  const latest = base?.channels.latest;
  const numbers = network && boardNumbers(network);
  return (
    <SiteFrame current="miners">
      <MinerRefresh />
      <SectionRow n="01" label="Testnet · subnet 579" note={network ? `Updated ${utc(network.as_of)} UTC` : undefined} />
      <header className={s.hero}>
        <h1>Miner leaderboard</h1>
        <p>Base-model submissions and customer-training workers, tracked separately. <b>Outside miners can enter the base tier now</b>; customer jobs open once miner terms are live.</p>
      </header>

      {numbers && <dl className={s.nums}>
        <div><dt>Workers online</dt><dd>{numbers.online}<small> / {numbers.total}</small></dd></div>
        <div><dt>Customer jobs</dt><dd>{numbers.jobs}</dd></div>
        <div><dt>Models selected</dt><dd>{numbers.selected}</dd></div>
        <div><dt>Current base</dt><dd className={s.sm}>{modelDisplayName(base?.channels.stable.name) || '—'}</dd></div>
      </dl>}

      <SectionRow n="02" label="Competitions" note="Proposed" />
      <Competitions />

      <SectionRow n="03" label="Customer-training workers" />
      {network
        ? <section id="miners" aria-label="Customer-training workers">
          <p className={s.asof}>These workers train customer adapters. Worker IDs, job selections and skill scores are separate from on-chain base submissions below.</p>
          <MinerBoard miners={network.miners} asOf={network.as_of} />
          <p className={s.asof}><span>Live from the Zils training API · refreshes every 30 seconds</span><span>Updated {utc(network.as_of)} UTC · sort by any column</span></p>
        </section>
        : <p className={s.unavailable}>The leaderboard is unavailable right now.</p>}

      <DetailsRow summary="How to read customer-job results">
        <div className={s.prose}>
          <p><b>Selected</b> is how many of the miner’s candidates a customer job kept as its model, out of the jobs it was given. <b>Jobs</b> are customer training jobs assigned to the miner; <b>evaluated</b> candidates were scored on the job’s held-out test set.</p>
          <p><b>Skill</b> compares a candidate’s probability error (Brier) with guessing evenly between the answers: 0 is no better than guessing, 1 is perfect, so it compares across different jobs.</p>
          <p><b>Online</b> checked in within the last 45 seconds. <b>Seen recently</b> checked in within the last hour. <b>Offline</b> has not checked in for longer than that. <b>Never seen</b> registered but never checked in. <b>Disabled</b> gets no new jobs. Miners that are not online are dimmed.</p>
          <p><b>Models</b> come from each miner’s latest signed check-in, including while it is busy. Inactive rows show the last reported models. These are internal worker IDs, not on-chain UIDs; a listed model does not imply customer serving is available.</p>
          <p>Subnet 579 runs on the Bittensor testnet. Outside miners can already compete in the base tier there (below). Customer jobs stay with Zils miners until miner terms and intake are ready.</p>
        </div>
      </DetailsRow>

      <SectionRow n="04" label="Base tier" />
      <div id="base-tier" className={s.base}>
        <div>
          <h2>Beat <em>the base.</em></h2>
          <p>Every tier has a base to beat. Win a sealed exam, then win again on a fresh one.</p>
        </div>
        <span className={s.pill}>Round two · open on testnet</span>
      </div>
      <section className={s.submissions} aria-labelledby="base-submissions-heading">
        <h3 id="base-submissions-heading">Base-model submissions</h3>
        <p>Latest base commitments from registered hotkeys on testnet 579. Submitted means recorded on chain; it does not mean evaluated, qualified or better than the base.</p>
        {submissions ? <>
          <p className={s.live}>Verified {utc(submissions.as_of)} UTC · block {submissions.block.toLocaleString('en-US')} · checked every 5 minutes</p>
          {submissions.submissions.length ? <div className={s.submissionScroll}><table>
            <caption className="sr-only">Base-model submissions on testnet 579</caption>
            <thead><tr><th>On-chain miner</th><th>Base model</th><th>Submission</th><th>Evaluation</th></tr></thead>
            <tbody>{submissions.submissions.map(row => <tr key={row.hotkey}>
              <td><b>Chain UID {row.uid}</b><small title={row.hotkey}>{row.hotkey.slice(0, 6)}…{row.hotkey.slice(-6)}</small></td>
              <td>{row.model ? (MODEL_NAMES[row.model] ?? row.model) : 'Model not verified'}</td>
              <td><a href={`https://huggingface.co/${row.repo}/tree/${row.revision}`} target="_blank" rel="noopener noreferrer">Submitted ↗</a><small>Block {row.commitment_block.toLocaleString('en-US')}</small></td>
              <td>Not reported</td>
            </tr>)}</tbody>
          </table></div> : <p>No base-model commitments found in this snapshot.</p>}
          <p className={s.live}>Model labels come from candidate metadata. Validator results and rewards are not included in this feed.</p>
        </> : <p role="status">Base submissions are temporarily unavailable. Customer-worker activity above does not indicate base-miner status.</p>}
      </section>
      <section className={s.install} aria-labelledby="install-heading">
        <h3 id="install-heading" className={s.subTitle}>Start mining</h3>
        <InstallCommand command="curl -fsSL https://zils.ai/install.sh | sh" label="Miner install command" />
        <p><a href="https://docs.zils.ai/operations/miner-tuning" className={s.rhInline}>Tune your miner</a>: prepare training data, change the recipe, and compare your candidate with the base before submitting.</p>
        <p><Link href="/z3#relay" className={s.rhInline}>Study with Zils Relay</Link>: train smaller candidates on the shared answers of a larger teacher model.</p>
        <p>Installs the <code>zils</code> and <code>btcli</code> commands, then <code>zils setup</code> asks for your wallet and Hugging Face repo. After that, <code>zils doctor</code> checks each step and prints the command for the next one: register on testnet 579, train a candidate, commit it. Training needs Linux x86_64 with an NVIDIA GPU. Rerun the command to update.</p>
      </section>
      <DetailsRow summary="What we have tried">
        <div className={s.tried}>
          <section aria-labelledby="current-base">
            <h3 id="current-base" className={s.subTitle}>Current base</h3>
            {base ? <>
              <p className={s.baseName}>{modelDisplayName(base.channels.stable.name)}</p>
              <dl className={s.facts}>
                <div><dt>Profile</dt><dd><code>{base.channels.stable.id}</code></dd></div>
                <div><dt>Input limit</dt><dd>{base.model.max_input_tokens.toLocaleString('en-US')} tokens</dd></div>
                <div><dt>Inputs</dt><dd>Text{base.model.inputs?.images ? `, up to ${base.model.inputs.images} images` : ''}{base.model.inputs?.video ? ', video' : ''}</dd></div>
                <div><dt>Channels</dt><dd>stable {latest && latest.id !== base.channels.stable.id ? `${modelDisplayName(base.channels.stable.name)}, latest ${modelDisplayName(latest.name)}` : 'and latest on the same base'}</dd></div>
              </dl>
              <p className={s.live}>Live from the Zils training API.</p>
            </> : <p className={s.live}>Live status is unavailable right now. Last recorded: z3-mini 4.5B on both channels (17 October 2026).</p>}
          </section>

          <section aria-labelledby="how-heading">
            <h3 id="how-heading" className={s.subTitle}>How a new base wins</h3>
            <ol className={s.how}>
              <li><strong>Submit.</strong> A miner uploads replacement weights for the base to Hugging Face, then commits them on chain with <code>zils commit-candidate</code>.</li>
              <li><strong>Score.</strong> Validators score it on a sealed exam the miner never sees, against the current base.</li>
              <li><strong>Confirm.</strong> It must win again on a second, fresh exam, and customer-style adapters trained on it must not get worse.</li>
            </ol>
            <p>The full rules are on the <Link href="/model#base-tier">research page</Link> and in the <a href={DOCS}>miner guide</a>.</p>
          </section>

          <section aria-labelledby="timeline-heading">
            <h3 id="timeline-heading" className={s.subTitle}>What we have tried</h3>
            <ol className={s.timeline}>
              {TIMELINE.map(entry => <li key={entry.title} data-tone={entry.tone}>
                <p className={s.date}>{entry.date}</p>
                <div className={s.entry}>
                  <div className={s.entryHead}><h4>{entry.title}</h4><span className={s.outcome}>{entry.outcome}</span></div>
                  <p>{entry.body}</p>
                  {entry.compare && <Bars compare={entry.compare} />}
                </div>
              </li>)}
            </ol>
            <p className={s.note}>One rented card per run, teacher-authored exams rather than customer data, and one reference job in the adapter check where the rules ask for three or four. Results are recorded as measured, with their dates.</p>
          </section>
        </div>
      </DetailsRow>

      <DetailsRow summary="Testnet rehearsal · 25 Sept 2026"><Rehearsal /></DetailsRow>

      <div className={s.more}>
        <a href={DOCS}>Miner guide</a>
        <Link href="/model#base-tier">Base tier rules</Link>
        <Link href="/bases">Base lineage</Link>
        <a href="/model/testnet-round-001.json">Public chain view</a>
      </div>
    </SiteFrame>
  );
}

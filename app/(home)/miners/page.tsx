import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { currentBase } from '@/lib/base-model';
import { networkMiners, type Miner } from '@/lib/network-miners';
import { blackletter } from '@/components/blackletter';
import texture from '@/components/light.module.css';
import s from './miners.module.css';

export const metadata: Metadata = {
  title: 'Zils — miners',
  description: 'Every miner on the Zils subnet: whether it is online, which base models it can train, and how its candidates did. Plus each attempt to improve the shared base model.',
  alternates: { canonical: 'https://zils.ai/miners' },
};

const STATUS: Record<Miner['status'], string> = { online: 'Online', stale: 'Seen recently', offline: 'Offline', unseen: 'Never seen', disabled: 'Disabled' };
const MODEL_NAMES: Record<string, string> = { 'd3-mini-4.5b-v1': 'd3-mini 4.5B', 'h2o-lightning-4b-v1.2.3': 'H2O 4B' };
const short = (hotkey: string) => hotkey.length > 14 ? `${hotkey.slice(0, 6)}…${hotkey.slice(-6)}` : hotkey;
function ago(iso: string | null, now: number) {
  if (!iso) return '—';
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} days ago`;
}

const DOCS = 'https://docs.zils.ai';

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
    date: 'Next', title: 'Round two: beat d3-mini', outcome: 'Not scheduled yet', tone: 'next',
    body: 'Stock d3-mini is now the model to beat, with the same exam and rules. As of 17 October 2026, open admission for outside miners is built but off, and no public round has run. We also want the exam to cover images and video, since that is what the base is used for.',
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
  const [base, network] = await Promise.all([currentBase(), networkMiners()]);
  const latest = base?.channels.latest;
  const now = network ? Date.parse(network.as_of) : 0;
  return <div className="min-h-screen bg-page font-sans text-ink antialiased selection:bg-[#4942c7] selection:text-white">
    <div className="mx-auto max-w-6xl px-6 sm:px-8"><SiteHeader tone="light" /></div>
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-6 pb-20 sm:px-8">
      <header className={s.hero}>
        <div aria-hidden="true" className={`${s.texture} ${texture.scanlines}`} />
        <div aria-hidden="true" className={`${s.texture} ${texture.grain}`} />
        <div className={s.heroCopy}>
          <h1 className={blackletter.className}>Miners</h1>
          <p>Every miner on the Zils subnet: whether it is online, which base models it can train, and how its candidates did on customer training jobs.</p>
          <p className={s.testnet}><span className={s.badge}>Testnet</span>Subnet 579 on the Bittensor testnet. All miners are currently run by Zils; outside miners can join once the subnet moves to mainnet.</p>
        </div>
        {network && <figure className={s.lampBoard}>
          <ul aria-label="Miners by UID">{network.miners.map(miner => <li key={miner.hotkey} className={s.unit} data-status={miner.status} title={`UID ${miner.uid}, ${STATUS[miner.status].toLowerCase()}, ${miner.hotkey}`}>
            <span className={s.lamp} aria-hidden="true" /><span className={s.unitId}>{miner.uid}</span><span className="sr-only">{STATUS[miner.status]}</span>
          </li>)}</ul>
          <figcaption><strong>{network.summary.online} of {network.summary.miners}</strong> online now{network.summary.stale ? `, ${network.summary.stale} seen in the last hour` : ''}</figcaption>
        </figure>}
      </header>

      <section className={s.board} aria-labelledby="board-heading">
        <h2 id="board-heading" className={s.sectionTitle}>Leaderboard</h2>
        {network ? <>
          <div className={s.tableWrap} role="region" aria-label="Miners" tabIndex={0}><table className={s.table}>
            <thead><tr><th scope="col">UID</th><th scope="col">Hotkey</th><th scope="col">Status</th><th scope="col">Can train</th><th scope="col">Jobs</th><th scope="col">Evaluated</th><th scope="col">Selected</th><th scope="col">Median skill</th><th scope="col">Last seen</th></tr></thead>
            <tbody>{network.miners.map(miner => <tr key={miner.hotkey}>
              <td className={s.num}>{miner.uid}</td>
              <th scope="row"><code title={miner.hotkey}>{short(miner.hotkey)}</code></th>
              <td><span className={s.status} data-status={miner.status}><span className={s.lamp} aria-hidden="true" />{STATUS[miner.status]}</span></td>
              <td>{miner.models.length ? miner.models.map(id => MODEL_NAMES[id] ?? id).join(', ') : '—'}</td>
              <td className={s.num}>{miner.training.assigned}</td>
              <td className={s.num}>{miner.training.evaluated}</td>
              <td className={s.num}>{miner.training.selected}</td>
              <td>{miner.training.median_skill === null ? <span className={s.none}>—</span> : <span className={s.skill}><span aria-hidden="true" className={s.track}><span className={s.fill} style={{ width: `${miner.training.median_skill * 100}%` }} /></span><span className={s.value}>{miner.training.median_skill.toFixed(2)}</span></span>}</td>
              <td>{ago(miner.last_seen, now)}</td>
            </tr>)}</tbody>
          </table></div>
          <p className={s.legend}><strong>Jobs</strong> are customer training jobs assigned to the miner. <strong>Evaluated</strong> candidates were scored on the job&rsquo;s held-out test set; <strong>selected</strong> ones became the customer&rsquo;s model. <strong>Skill</strong> compares a candidate&rsquo;s probability error (Brier) with guessing evenly between the answers: 0 is no better than guessing, 1 is perfect, so it compares across different jobs. Data as of {new Date(network.as_of).toUTCString().replace(' GMT', ' UTC')}, refreshed every minute.</p>
        </> : <p className={s.unavailable}>Live miner data is unavailable right now. Try again in a minute.</p>}
      </section>

      <section className={s.baseTier} aria-labelledby="base-tier-heading">
        <div className={s.baseIntro}>
          <div>
            <h2 id="base-tier-heading" className={s.sectionTitle}>Improving the base model</h2>
            <p>Every customer model is a small adapter on one shared base. Miners can also compete to replace the base itself. No outside miner has submitted a base candidate yet; the attempts below were run by Zils.</p>
          </div>
          <section className={s.current} aria-labelledby="current-base">
            <h2 id="current-base">Current base</h2>
            {base ? <>
              <p className={s.baseName}>{base.channels.stable.name}</p>
              <dl className={s.facts}>
                <div><dt>Profile</dt><dd><code>{base.channels.stable.id}</code></dd></div>
                <div><dt>Input limit</dt><dd>{base.model.max_input_tokens.toLocaleString('en-US')} tokens</dd></div>
                <div><dt>Inputs</dt><dd>Text{base.model.inputs?.images ? `, up to ${base.model.inputs.images} images` : ''}{base.model.inputs?.video ? ', video' : ''}</dd></div>
                <div><dt>Channels</dt><dd>stable {latest && latest.id !== base.channels.stable.id ? `${base.channels.stable.name}, latest ${latest.name}` : 'and latest on the same base'}</dd></div>
              </dl>
              <p className={s.live}>Live from the Zils training API.</p>
            </> : <p className={s.live}>Live status is unavailable right now. Last recorded: d3-mini 4.5B on both channels (17 October 2026).</p>}
          </section>
        </div>

      <section className={s.how} aria-labelledby="how-heading">
        <h3 id="how-heading" className={s.subTitle}>How a new base wins</h3>
        <ol>
          <li><strong>Submit.</strong> A miner on the Bittensor subnet submits a full set of replacement weights for the base.</li>
          <li><strong>Score.</strong> Validators score it on a sealed exam the miner never sees, against the current base.</li>
          <li><strong>Confirm.</strong> It must win again on a second, fresh exam, and customer-style adapters trained on it must not get worse.</li>
        </ol>
        <p>The full rules are on the <Link href="/model#base-tier">research page</Link> and in the <a href={DOCS}>miner guide</a>.</p>
      </section>

      <section className={s.timelineSection} aria-labelledby="timeline-heading">
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
      </section>
    </main>
    <SiteFooter />
  </div>;
}

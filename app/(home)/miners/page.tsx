import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { DetailsRow } from '@/components/site/details-row';
import { InstallCommand } from '@/components/site/install-command';
import { networkBodies, minerRows } from '@/lib/network-bodies';
import { soupBoard, tierView } from '@/lib/soup-board';
import { TIER_NAMES } from '@/lib/soup-tiers';
import { Rehearsal } from './rehearsal';
import { Refresh } from './refresh';
import { TierSoup } from './tier';
import { ChainTable } from './chain';
import { FoodIcon } from '../soup/food-icons';
import s from './miners.module.css';
import b from './board.module.css';

export const metadata: Metadata = {
  title: 'Zils — miners',
  description: 'What each z3 soup is made of tonight, who made each part, who serves it, and where every miner on chain stands.',
  alternates: { canonical: 'https://zils.ai/miners' },
};

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
    date: 'Next', title: 'Every tier becomes a soup', outcome: 'At the mainnet launch', tone: 'next',
    body: 'The base tiers stop crowning one winner. Each night validators average up to five bodies per tier, starting from that tier’s open house models, and pay the soup’s seats. We also want the exam to cover images and video, since that is what the base is used for.',
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
  const [soup, chain] = await Promise.all([soupBoard(), networkBodies()]);
  const views = new Map((soup?.tiers ?? []).map(t => [t.tier, tierView(t)]));
  return (
    <SiteFrame current="miners">
      <Refresh />
      <header className={b.hero}>
        <div>
          <h1>Miners make z3.</h1>
          <p>Each night, validators average up to five model bodies into a soup for each z3 tier. The soup is the model that gets served. Here is what each soup holds tonight, who made each part, and where every miner stands.</p>
        </div>
        <section className={b.start} aria-label="Start mining">
          <InstallCommand command="curl -fsSL https://zils.ai/install.sh | sh" label="Miner install command" />
          <p>Then run <code>zils-miner setup</code>. <Link href="/soup">Bring a body to the soup</Link></p>
        </section>
      </header>

      <SectionRow n="01" label="Tonight’s soup" note="今夜のスープ" />
      <section aria-labelledby="tonight-heading" className={b.tiers}>
        <h2 id="tonight-heading" className="sr-only">Tonight’s soup</h2>
        {!soup && <p className={b.down}>Tonight’s rounds are unavailable right now. Each tier shows its pot of house models until the feed returns.</p>}
        {TIER_NAMES.map(tier => <TierSoup key={tier} tier={tier} view={views.get(tier) ?? null} feed={Boolean(soup)} />)}
        <p className={b.fine}>Seats and the crown are decided on the items of the last three rounds together, because one night’s slice of the private exam is noisier than the greedy margin. The score is tonight’s slice alone, so small moves between rounds are partly noise. Each part’s number is what the soup loses without it, rounded to 0.5 point.</p>
      </section>

      <SectionRow n="02" label="Miners on chain" note={chain ? `Subnet ${chain.netuid}` : undefined} />
      <section aria-label="Miners on chain">
        {chain ? <ChainTable chain={chain} rows={minerRows(chain, soup)} /> : <p className={b.down}>The chain view is unavailable right now.</p>}
      </section>

      <SectionRow n="03" label="How miners earn" note="お品書き" />
      <section aria-labelledby="earn-heading" className={b.earn}>
        <div className={b.earnHead}>
          <h2 id="earn-heading">How miners earn</h2>
          <p>The four tiers share emissions equally, 25% each. Every tier pays five seats of 4% and a crown of 5%: 24 paid spots in all. Whatever nobody earns burns, including the whole share of a tier that has not opened.</p>
        </div>
        <ol className={s.roundSteps} aria-label="A round">
          <li><FoodIcon name="bowl" className={s.stepIcon} /><b>In the pot</b>The tier’s house models, the current members and the best new bodies, at most 20.</li>
          <li><FoodIcon name="ladle" className={s.stepIcon} /><b>Greedy</b>Start from the best single body. Add the next only if the soup scores 0.5 higher. Stop at five.</li>
          <li><FoodIcon name="ticket" className={s.stepIcon} /><b>Pay</b>A seat (4%) for each miner body that lifts the soup by 0.8 or more; scouts re-uploading public models earn a quarter. The crown (5%) goes to a body that beats every house model and the soup alone by 1.2.</li>
          <li><FoodIcon name="flame" className={s.stepIcon} /><b>Burn</b>Anything unearned burns. House models are never paid.</li>
        </ol>
        <p className={b.later}>Feature tracks and customer adapters do not pay yet. The <Link href="/miners/tracks/box">box track</Link> runs as a synthetic-only pilot.</p>
        <div className={b.guide}>
          <p>The installer adds the <code>zils-miner</code> and <code>btcli</code> commands. <code>zils-miner setup</code> asks for your wallet and Hugging Face repo, then <code>zils-miner doctor</code> checks each step and prints the next command: register, train a body, then commit it with <code>zils-miner commit-body</code>. Training needs Linux x86_64 with an NVIDIA GPU. Rerun the installer to update.</p>
          <p><a href="https://docs.zils.ai/operations/soup">Soup guide</a>: what a body must be, how to commit it and how seats are paid. <a href="https://docs.zils.ai/operations/miner-tuning">Tune your miner</a>: prepare training data, change the recipe, and compare your body with the base before committing.</p>
        </div>
      </section>

      <DetailsRow summary="What we have tried">
        <div className={s.tried}>
          <section aria-labelledby="how-heading">
            <h3 id="how-heading" className={s.subTitle}>How a new base wins</h3>
            <ol className={s.how}>
              <li><strong>Commit.</strong> A miner uploads a fine-tuned body to Hugging Face, then commits it on chain with <code>zils-miner commit-body</code>.</li>
              <li><strong>Cook.</strong> Each night validators build the tier’s soup on a sealed exam the miner never sees, and pay its seats.</li>
              <li><strong>Release.</strong> Every 14 to 28 days the soup must beat the current base on two fresh sealed draws, hold its lead 12 hours later, and keep customer-style adapters at least as good.</li>
            </ol>
            <p>There is no single winner: the soup becomes the next version. See <Link href="/soup">the soup</Link>.</p>
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
        <Link href="/soup">The soup</Link>
        <Link href="/model#base-tier">Base tier rules</Link>
        <a href="/model/testnet-round-001.json">Public chain view</a>
      </div>
    </SiteFrame>
  );
}

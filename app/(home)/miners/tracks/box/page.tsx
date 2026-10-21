import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { DetailsRow } from '@/components/site/details-row';
import { Reveal } from '@/components/site/reveal';
import examples from '@/data/box-mvp-examples.json';
import m from '../../miners.module.css';
import s from './box.module.css';

export const metadata: Metadata = {
  title: 'Zils — box track',
  description: 'Synthetic-only testnet pilot: independent mini and lite competitions for bounding-box adapters, with separate reviewed crowns.',
  alternates: { canonical: 'https://zils.ai/miners/tracks/box' },
};

type Box = { top: number; bottom: number; left: number; right: number };
type Example = (typeof examples)[number];

// Historical MVP results: output/{box-mvp-2026-10-19,d3-lite-box-2026-10-20}/report.md.
const RESULTS = [
  { name: 'Stock d3-lite', all: .032, visa: .001, synthetic: .071, hit: '0.5%' },
  { name: 'Stock d3-mini', all: .075, visa: .037, synthetic: .122, hit: '1.8%' },
  { name: 'd3-lite + box adapter', all: .251, visa: .101, synthetic: .435, hit: '18.0%' },
  { name: 'Jev 1.14 box', all: .479, visa: .243, synthetic: .767, hit: '51.8%' },
  { name: 'Stock d3-mini + box adapter', all: .582, visa: .355, synthetic: .859, hit: '62.2%', best: true },
];

const RULES = [
  ['Train', 'Choose the exact mini v1 or lite v1 parent. Train a box adapter with a frozen vision tower. The public synthetic generator is training material; private exam images and seeds stay sealed.'],
  ['Commit', 'Package with python -m zils.feature_miner pack, upload the bundle, then submit with python -m zils.feature_miner commit. The commitment binds the track, parent and adapter. One hotkey has one active commitment.'],
  ['Score', 'On present targets, weight synthetic families equally: gain at least 0.02 mean IoU over the incumbent, with a positive paired 95% lower confidence bound and mean IoU at least 0.40. No family may drop more than 0.02.'],
  ['Confirm', 'Absent-target false positives must be at most 10%; presence Brier may be at most 0.005 worse than the incumbent. The same adapter must pass every gate on two disjoint private draws, evaluated at least 12 hours apart.'],
  ['Crown', 'Reviewed crowning is independent for mini and lite. Among each track’s five most recent distinct kings, those still registered share its rewards equally. Operator baselines earn no crown; an empty track burns its share.'],
  ['Graduate', 'Winning this synthetic pilot does not merge an adapter into the base. Graduation requires a separate review, real-image qualification and the full base regression suite.'],
];

const GUIDE = 'https://github.com/ooo-hq/zils/blob/main/docs/feature-tracks.md';

function Frame({ box, kind }: { box: Box; kind: 'truth' | 'ours' | 'jev' }) {
  // Final position in custom properties, so the CSS can start every box at the full image and close it onto the target.
  return <span className={s.frame} data-kind={kind} style={{
    '--t': `${box.top * 100}%`, '--l': `${box.left * 100}%`,
    '--w': `${(box.right - box.left) * 100}%`, '--h': `${(box.bottom - box.top) * 100}%`,
  } as React.CSSProperties} />;
}

function Card({ example, index }: { example: Example; index: number }) {
  const label = example.source === 'visa' ? `${example.object?.replace('_', ' ')} · defect` : example.target.replace(/^the /, '');
  const winner = example.ours_iou >= example.jev_iou ? 'ours' : 'jev';
  return <Reveal delay={(index % 3) * 0.12}><figure className={s.card}>
    <div className={s.photo}>
      <span className={s.scan} aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size research images; boxes overlay in percent */}
      <img src={example.src} alt={`Test image: ${label}`} />
      <Frame box={example.truth} kind="truth" />
      <Frame box={example.jev} kind="jev" />
      <Frame box={example.ours} kind="ours" />
    </div>
    <figcaption>
      <span className={s.cardLabel}>{label}</span>
      <span className={s.scores}>
        <span data-best={winner === 'ours' || undefined}>Mini {example.ours_iou.toFixed(2)}</span>
        <span data-best={winner === 'jev' || undefined}>Jev {example.jev_iou.toFixed(2)}</span>
      </span>
    </figcaption>
  </figure></Reveal>;
}

export default function BoxTrackPage() {
  const max = Math.max(...RESULTS.map(r => r.all));
  return (
    <SiteFrame current="miners">
      <SectionRow n="01" label="Feature track · boxes" note="Testnet 579 · open" />
      <header className={m.hero}>
        <p className={s.crumb}><Link href="/miners">Miners</Link> / Feature tracks</p>
        <h1><span className={s.target}>Boxes<span className={s.lock} aria-hidden="true"><i /><i /><i /><i /><b>0.97</b></span></span></h1>
        <p>Teach a model to point at a named shape, or say it is absent. <b>Synthetic-only pilot, open on testnet 579.</b> Mini and lite compete separately on newly generated private pilot images. This pilot does not establish real-world box quality.</p>
      </header>

      <dl className={m.nums}>
        <div><dt>Status</dt><dd className={m.sm}>Open on testnet</dd></div>
        <div><dt>Score to beat</dt><dd className={m.sm}>Your track’s incumbent</dd></div>
        <div><dt>Competitions</dt><dd className={m.sm}>Mini / lite</dd></div>
        <div><dt>Validator allocation</dt><dd className={m.sm}>16% / 4%</dd></div>
      </dl>

      <SectionRow n="02" label="Pilot parents and rewards" />
      <section className={s.section} aria-labelledby="parents-heading">
        <h2 id="parents-heading" className={s.h2}>Two parents. Two independent competitions.</h2>
        <div className={s.scroll} tabIndex={0} role="region" aria-label="Pilot parents and allocations">
          <table className={s.table}>
            <thead><tr><th scope="col">Box track parent</th><th scope="col">Share of validator allocation</th></tr></thead>
            <tbody>
              <tr><th scope="row">d3-mini-4.5b-v1</th><td>16%</td></tr>
              <tr><th scope="row">d3-lite-0.8b-v1</th><td>4%</td></tr>
            </tbody>
          </table>
        </div>
        <p className={s.caveat}>The testnet split is 50% base improvement, 20% features and 30% customer adapters, with mini/lite split 80/20 inside both base and box budgets: 40% mini base, 10% lite base, 16% mini boxes, 4% lite boxes, 30% customer adapters. These are this validator’s allocation shares, not guaranteed earnings. Boxes initially receive the whole feature budget; future tracks require an announced reallocation.</p>
        <p className={s.fine}>No qualified box kings yet. Operator references are the initial scores to beat and earn no crown. Both box allocations burn until qualifying miners are crowned. Historical research and small adapter smoke tests do not qualify a winning starter.</p>
      </section>

      <SectionRow n="03" label="Historical MVP results" note="19–20 Oct 2026" />
      <section className={s.section} aria-labelledby="result-heading">
        <h2 id="result-heading" className={s.h2}>Both models learned boxes; mini led on this test set.</h2>
        <figure className={m.compare}>
          <figcaption>Mean box overlap (IoU) on 222 test images, higher is better</figcaption>
          <dl>{RESULTS.map(row => <div key={row.name} data-best={row.best || undefined}>
            <dt>{row.name}</dt>
            <dd className={m.value}>{row.all.toFixed(3)}</dd>
            <dd aria-hidden="true" className={m.track}><span className={m.fill} style={{ width: `${(row.all / max) * 100}%` }} /></dd>
          </div>)}</dl>
        </figure>
        <div className={s.scroll} tabIndex={0} role="region" aria-label="Results by image set">
          <table className={s.table}>
            <thead><tr><th scope="col">Model</th><th scope="col">All</th><th scope="col">Defects (VisA)</th><th scope="col">Shapes</th><th scope="col">IoU ≥ 0.5</th></tr></thead>
            <tbody>{RESULTS.map(row => <tr key={row.name} data-best={row.best || undefined}>
              <th scope="row">{row.name}</th><td>{row.all.toFixed(3)}</td><td>{row.visa.toFixed(3)}</td><td>{row.synthetic.toFixed(3)}</td><td>{row.hit}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className={s.caveat}><b>Historical research, not the pilot exam.</b> These adapters used stock mini and lite, with the same 12 defect types and shape generator in training and test; Jev was zero-shot. The mini result is not the pilot baseline. Each model had one training run and one seed, without absent-target or confidence qualification. Lite reached IoU ≥ 0.5 on only 3 of 122 real-defect images, versus mini’s 42. This does not establish general localization quality.</p>
        <p className={s.fine}>Four serial model passes per box: lite averaged 0.624 s and mini 3.270 s on the RTX 4090 in separate runs; this was not a fresh paired speed comparison. Training took 18.2 / 32.0 minutes and 1.93 / 9.31 GiB peak CUDA allocation for lite / mini.</p>
      </section>

      <SectionRow n="04" label="Historical mini examples" note="6 of 222 · Jev better on 2" />
      <section className={s.section} aria-labelledby="examples-heading">
        <h2 id="examples-heading" className={s.visuallyHidden}>Example boxes</h2>
        <ul className={s.legend} aria-label="Legend">
          <li data-kind="truth">True box</li><li data-kind="ours">Stock mini + adapter</li><li data-kind="jev">Jev 1.14</li>
        </ul>
        <div className={s.gallery}>{examples.map((example, index) => <Card key={example.id} example={example} index={index} />)}</div>
        <p className={s.fine}>Chosen to include cases where Jev is better (about one in three test images). Defect photos: VisA, Amazon Science, CC BY 4.0, resized. Shape scenes generated by Zils.</p>
      </section>

      <SectionRow n="05" label="Pilot rules" />
      <section className={s.section} aria-labelledby="rules-heading">
        <h2 id="rules-heading" className={s.visuallyHidden}>Rules</h2>
        <ol className={s.rules}>{RULES.map(([title, body], i) => <li key={title}>
          <span className={s.num}>{String(i + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{body}</p>
        </li>)}</ol>
      </section>

      <SectionRow n="06" label="Leaderboard" />
      <section className={s.section} aria-labelledby="board-heading">
        <h2 id="board-heading" className={s.visuallyHidden}>Leaderboard</h2>
        <div className={s.scroll} tabIndex={0} role="region" aria-label="Box track entries">
          <table className={s.table}>
            <thead><tr><th scope="col">Miner</th><th scope="col">Commit</th><th scope="col">IoU</th><th scope="col">Confirmed</th><th scope="col">Date</th></tr></thead>
            <tbody><tr><td colSpan={5} className={s.empty}>No qualified box kings yet. Both tracks are open for synthetic-pilot submissions.</td></tr></tbody>
          </table>
        </div>
        <p className={s.fine}>Mini and lite keep separate king histories. Reviewed crowning unlocks a track’s rewards; it does not release a new base or customer box API.</p>
      </section>

      <SectionRow n="07" label="Train for it" />
      <section className={s.section} aria-labelledby="data-heading">
        <h2 id="data-heading" className={s.h2}>Start with the synthetic pilot guide</h2>
        <p className={s.caveat}>The <a href={GUIDE}>feature-track guide</a> defines the public shape generator, exact parent pins, presence and box format, training limits, packaging and submission commands. Training examples are separate from the configured private pilot draws. Follow the guide for your chosen parent; these are miner submissions.</p>
        <DetailsRow summary="Historical MVP recipe">
          <div className={m.prose}>
            <p>Each box is four multiple-choice questions, one per edge, each choosing among 101 positions (0–100% of the image from the top or left). Training targets are soft: a narrow bell curve around the true edge, so near misses cost less than far ones.</p>
            <p>Rank-16 LoRA on 152 mini or 114 lite language modules, vision tower frozen, learning rate 5e-5 with warm-up and linear decay, batch 4, one epoch over 866 images (3,464 edge questions). This older recipe had no absent-target answer or presence calibration; it is not a qualified pilot submission.</p>
          </div>
        </DetailsRow>
      </section>

      <div className={m.more}>
        <Link href="/miners">All competitions</Link>
        <a href={GUIDE}>Box pilot guide</a>
      </div>
    </SiteFrame>
  );
}

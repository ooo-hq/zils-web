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
  description: 'A proposed feature track: miners compete to teach the shared base model to return bounding boxes.',
  alternates: { canonical: 'https://zils.ai/miners/tracks/box' },
};

type Box = { top: number; bottom: number; left: number; right: number };
type Example = (typeof examples)[number];

// Numbers from output/box-mvp-2026-10-19/report.md (222 test images, 19 Oct 2026).
const RESULTS = [
  { name: 'Stock d3-mini', all: .075, visa: .037, synthetic: .122, hit: '2%' },
  { name: 'Jev 1.14 box', all: .479, visa: .243, synthetic: .767, hit: '52%' },
  { name: 'Starter adapter', all: .582, visa: .355, synthetic: .859, hit: '62%', best: true },
];

const RULES = [
  ['Publish', 'Zils publishes the box question format, public training data and the starter adapter as the score to beat.'],
  ['Train', 'A miner trains an adapter on the current base: rank-16 LoRA, vision tower frozen, the same recipe limits as customer adapters.'],
  ['Commit', 'Upload it to Hugging Face and commit the hash on chain with zils commit-candidate. Validators pull it themselves.'],
  ['Score', 'Validators score it on a sealed box exam of privately labelled images, replaced every round: box overlap (IoU) plus how well its confidence predicts its accuracy.'],
  ['Crown', 'A challenger becomes king when it beats the current king by a margin on one draw and holds on a second, fresh draw. The last five kings share the track’s pay.'],
  ['Graduate', 'At a base release the king is merged into the base after the full regression suite. Its exam then guards every later base, so no future winner can lose boxes.'],
];

const DATA = [
  ['Open Images V7', 'CC BY 4.0 annotations', '14.6M training boxes, 600 classes'],
  ['RefCOCO / RefCOCO+', 'Apache 2.0', 'phrases like “the man on the left in red”, each with its box'],
  ['COCO, LVIS', 'CC BY 4.0 annotations', 'everyday objects; LVIS adds 1,200 rarer classes'],
  ['VisA', 'CC BY 4.0', 'industrial defects; masks convert to boxes'],
  ['DocLayNet, PubLayNet', 'CDLA-Permissive', 'tables, figures and text blocks on pages'],
];

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
        <span data-best={winner === 'ours' || undefined}>Ours {example.ours_iou.toFixed(2)}</span>
        <span data-best={winner === 'jev' || undefined}>Jev {example.jev_iou.toFixed(2)}</span>
      </span>
    </figcaption>
  </figure></Reveal>;
}

export default function BoxTrackPage() {
  const max = Math.max(...RESULTS.map(r => r.all));
  return (
    <SiteFrame current="miners">
      <SectionRow n="01" label="Feature track · boxes" note="Proposed" />
      <header className={m.hero}>
        <p className={s.crumb}><Link href="/miners">Miners</Link> / Feature tracks</p>
        <h1><span className={s.target}>Boxes<span className={s.lock} aria-hidden="true"><i /><i /><i /><i /><b>0.97</b></span></span></h1>
        <p>Teach the shared base to point at things: ask “where is the scratch?” and get a box back. <b>Not open yet.</b> This page shows the proposed rules and the starter result miners would have to beat.</p>
      </header>

      <dl className={m.nums}>
        <div><dt>Status</dt><dd className={m.sm}>Planned</dd></div>
        <div><dt>Score to beat</dt><dd>0.582<small> IoU</small></dd></div>
        <div><dt>King</dt><dd className={m.sm}>None yet</dd></div>
        <div><dt>Pays</dt><dd className={m.sm}>Features pool, 20%</dd></div>
      </dl>

      <SectionRow n="02" label="Starter result" note="19 Oct 2026" />
      <section className={s.section} aria-labelledby="result-heading">
        <h2 id="result-heading" className={s.h2}>A 31-minute adapter already beats Jev’s box mode on our test set.</h2>
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
        <p className={s.caveat}><b>Not a general win.</b> The adapter trained on the same 12 defect types and the same shape generator as the test images; Jev had seen none of them. It shows boxes work on d3-mini through its existing answer codes, and learn fast. One training run, one seed. Our boxes take four model passes, about 3.3 s each on one RTX 4090, against one call to Jev.</p>
      </section>

      <SectionRow n="03" label="Examples" note="6 of 222 · Jev better on 2" />
      <section className={s.section} aria-labelledby="examples-heading">
        <h2 id="examples-heading" className={s.visuallyHidden}>Example boxes</h2>
        <ul className={s.legend} aria-label="Legend">
          <li data-kind="truth">True box</li><li data-kind="ours">Starter adapter</li><li data-kind="jev">Jev 1.14</li>
        </ul>
        <div className={s.gallery}>{examples.map((example, index) => <Card key={example.id} example={example} index={index} />)}</div>
        <p className={s.fine}>Chosen to include cases where Jev is better (about one in three test images). Defect photos: VisA, Amazon Science, CC BY 4.0, resized. Shape scenes generated by Zils.</p>
      </section>

      <SectionRow n="04" label="How the track would run" />
      <section className={s.section} aria-labelledby="rules-heading">
        <h2 id="rules-heading" className={s.visuallyHidden}>Rules</h2>
        <ol className={s.rules}>{RULES.map(([title, body], i) => <li key={title}>
          <span className={s.num}>{String(i + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{body}</p>
        </li>)}</ol>
      </section>

      <SectionRow n="05" label="Leaderboard" />
      <section className={s.section} aria-labelledby="board-heading">
        <h2 id="board-heading" className={s.visuallyHidden}>Leaderboard</h2>
        <div className={s.scroll} tabIndex={0} role="region" aria-label="Box track entries">
          <table className={s.table}>
            <thead><tr><th scope="col">Miner</th><th scope="col">Commit</th><th scope="col">IoU</th><th scope="col">Confirmed</th><th scope="col">Date</th></tr></thead>
            <tbody><tr><td colSpan={5} className={s.empty}>No entries yet. Entries appear here once validators score box adapters.</td></tr></tbody>
          </table>
        </div>
        <p className={s.fine}>King history: none. The starter adapter sets the bar but earns nothing, like the vendor base.</p>
      </section>

      <SectionRow n="06" label="Train for it" />
      <section className={s.section} aria-labelledby="data-heading">
        <h2 id="data-heading" className={s.h2}>Public data you can train on</h2>
        <ul className={s.data}>{DATA.map(([name, licence, what]) => <li key={name}>
          <span className={s.dataName}>{name}</span><span className={s.licence}>{licence}</span><span>{what}</span>
        </li>)}</ul>
        <DetailsRow summary="Starter recipe">
          <div className={m.prose}>
            <p>Each box is four multiple-choice questions, one per edge, each choosing among 101 positions (0–100% of the image from the top or left). Training targets are soft: a narrow bell curve around the true edge, so near misses cost less than far ones.</p>
            <p>Rank-16 LoRA on the 152 language modules, vision tower frozen, learning rate 5e-5 with warm-up and linear decay, batch 4, one epoch over 866 images (3,464 edge questions). 31 minutes and 9.3 GiB peak on an RTX 4090.</p>
            <p>Not usable for the base: Real-IAD, MVTec AD and Objects365 are non-commercial.</p>
          </div>
        </DetailsRow>
      </section>

      <div className={m.more}>
        <Link href="/miners">All competitions</Link>
        <a href="https://docs.zils.ai">Miner guide</a>
      </div>
    </SiteFrame>
  );
}

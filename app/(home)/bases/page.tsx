import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { DetailsRow } from '@/components/site/details-row';
import m from '../miners/miners.module.css';
import box from '../miners/tracks/box/box.module.css';
import s from './bases.module.css';

export const metadata: Metadata = {
  title: 'Zils — bases',
  description: 'How each Zils base model moves from revision to revision, and how new skills like bounding boxes are added to it.',
  alternates: { canonical: 'https://zils.ai/bases' },
};

// Sources: output/base-promotion-rehearsal-2026-10-17, base-round-2-2026-10-18, base-round-3-2026-10-18,
// box-mvp-2026-10-19 and d3-lite-box-2026-10-20 reports. Box scores are research runs, not track results.
const REVISIONS = [
  { name: 'd3-mini 4.5B · v1', tag: 'stable', when: '17 Oct', body: 'The vendor checkpoint, chosen as the first base for its video, multi-image and extra question types.' },
  { name: 'Round 1', tag: 'tied', when: '17–18 Oct', body: 'Tied v1 on the sealed exams (Brier 0.1782 vs 0.1790), so it was not eligible.' },
  { name: 'Round 2', tag: 'vetoed', when: '18 Oct', body: 'Beat v1 on two sealed exams, but customer adapters retrained on it got worse. The regression suite vetoed it.' },
  { name: 'Rounds 3 and 4', tag: 'vetoed', when: '18–19 Oct', body: 'Also stopped by the regression suite.' },
  { name: 'd3-mini 4.5B · r5', tag: 'latest', when: '19 Oct', body: 'A quarter merge of the round 3 change. Passed the exams twice and the suite on the mean across seeds. Its miner was the first king paid, and customer models have started moving onto it.' },
  { name: 'd3-lite 0.8B · v1', tag: 'stock', when: '20 Oct', body: 'A smaller base, about twice as fast as mini at a quarter of the memory. It has its own competition and its own kings; lite and mini never compete against each other.' },
];

const ELECT = [
  ['Train', 'A miner fine-tunes a candidate from the current base in its tier, uploads it to Hugging Face and commits the hash on chain.'],
  ['Exam', 'Validators pull it and score it on sealed questions. It must beat the current base, and the win must hold on a fresh draw.'],
  ['Suite', 'Customer adapters are retrained on the candidate and must not get worse. Every graduated skill’s exam runs here too.'],
  ['Crown', 'Once the release is reviewed, the winner’s miner joins the last five kings, who share the tier’s pay. A tier with no king burns its share.'],
  ['Release', 'The new base ships as latest. Customer models move over when they stay within 0.005 Brier of their old score; stable follows.'],
];

const FEATURE = [
  ['Open', 'A new skill gets its own track, pinned to an exact base revision, with a starter adapter as the score to beat.'],
  ['Compete', 'Miners submit adapters and the best one on a private feature exam is king of that track.'],
  ['Graduate', 'At the next base release the king is merged into the base, so every customer model gets the skill.'],
  ['Guard', 'From then on the skill’s exam is part of the regression suite. A later base that loses it cannot win.'],
];

// `left` puts the label beside the node, for nodes whose feature track drops straight down from them.
function Node({ x, y, kind = 'base', label, sub, above, left }: { x: number; y: number; kind?: 'base' | 'lost' | 'next' | 'feature'; label?: string; sub?: string; above?: boolean; left?: boolean }) {
  const r = kind === 'lost' || kind === 'feature' ? 7 : 10;
  const ty = above ? y - 22 : left ? y + 26 : y + 30;
  const tx = left ? x - 12 : x;
  const anchor = left ? 'end' : 'middle';
  return <g className={s.node} data-kind={kind}>
    <circle cx={x} cy={y} r={r} />
    {kind === 'lost' && <path d={`M${x - 3.5} ${y - 3.5} l7 7 M${x + 3.5} ${y - 3.5} l-7 7`} />}
    {label && <text x={tx} y={ty} textAnchor={anchor} className={s.label}>{label}</text>}
    {sub && <text x={tx} y={above ? ty - 14 : ty + 15} textAnchor={anchor} className={s.sub}>{sub}</text>}
  </g>;
}

function Tag({ x, y, children }: { x: number; y: number; children: string }) {
  const w = children.length * 7 + 16;
  return <g className={s.tag}><rect x={x - w / 2} y={y} width={w} height={18} /><text x={x} y={y + 13} textAnchor="middle">{children}</text></g>;
}

function Lineage() {
  return <svg className={s.map} viewBox="0 0 960 520" role="img" aria-labelledby="map-title map-desc">
    <title id="map-title">Base lineage</title>
    <desc id="map-desc">d3-mini runs from v1 to r5, with rounds 1 to 4 branching off as candidates that lost. d3-lite starts at v1 on 20 October. A bounding-box feature track hangs below each base and graduates into that base’s next revision.</desc>
    {[[80, '17 OCT'], [300, '18 OCT'], [500, '19 OCT'], [700, '20 OCT'], [890, 'NEXT']].map(([x, d]) => <g key={d}>
      <line className={s.grid} x1={x} y1={40} x2={x} y2={505} />
      <text className={s.axis} x={x} y={24} textAnchor="middle">{d}</text>
    </g>)}

    <text className={s.lane} x={16} y={64}>d3-mini 4.5B</text>
    <path className={s.rail} d="M80 160 H560" />
    <path className={s.future} d="M560 160 H890" />
    {[[190, 'tied'], [300, 'vetoed'], [390, 'vetoed'], [470, 'vetoed']].map(([x, sub], i) => <g key={x}>
      <line className={s.stem} x1={x} y1={160} x2={x} y2={106} />
      <Node x={Number(x)} y={98} kind={sub === 'tied' ? 'next' : 'lost'} label={`R${i + 1}`} sub={String(sub)} above />
    </g>)}
    <Tag x={80} y={114}>stable</Tag>
    <Node x={80} y={160} label="v1" sub="stock" />
    <Tag x={560} y={114}>latest</Tag>
    <Node x={560} y={160} label="r5" sub="crowned 19 Oct" left />
    <Node x={890} y={160} kind="next" label="next" above />

    <path className={s.feature} d="M560 170 V262 H800" />
    <text className={s.featureLabel} x={580} y={252}>Bounding boxes</text>
    <text className={s.score} x={580} y={284}>IoU 0.582 · Jev 1.14 0.479</text>
    <Node x={800} y={262} kind="feature" />
    <path className={s.graduate} d="M807 256 C 860 240, 890 210, 890 172" />

    <text className={s.lane} x={16} y={354}>d3-lite 0.8B</text>
    <path className={s.future} d="M700 410 H890" />
    <Node x={700} y={410} label="v1" sub="stock" left />
    <Node x={890} y={410} kind="next" label="next" above />
    <path className={s.feature} d="M700 420 V478 H800" />
    <text className={s.featureLabel} x={716} y={468}>Boxes</text>
    <text className={s.score} x={608} y={500}>IoU 0.032 → 0.251</text>
    <Node x={800} y={478} kind="feature" />
    <path className={s.graduate} d="M807 472 C 860 458, 890 440, 890 422" />
  </svg>;
}

function Steps({ items }: { items: string[][] }) {
  return <ol className={box.rules}>{items.map(([title, body], i) => <li key={title}>
    <span className={box.num}>{String(i + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{body}</p>
  </li>)}</ol>;
}

export default function BasesPage() {
  return (
    <SiteFrame current="model">
      <SectionRow n="01" label="Bases" note="As of 20 Oct 2026" />
      <header className={m.hero}>
        <h1>Bases</h1>
        <p>Every customer model is an adapter on a shared base. A base moves forward only when a miner’s candidate <b>beats it without hurting anything customers already run</b>.</p>
      </header>

      <dl className={m.nums}>
        <div><dt>Base tiers live</dt><dd>2</dd></div>
        <div><dt>Latest mini</dt><dd className={m.sm}>r5</dd></div>
        <div><dt>Candidates stopped</dt><dd>4</dd></div>
        <div><dt>Feature tracks</dt><dd className={m.sm}>Boxes, planned</dd></div>
      </dl>

      <SectionRow n="02" label="Lineage" note="Bases left to right, skills below" />
      <section className={box.section} aria-labelledby="lineage-heading">
        <h2 id="lineage-heading" className={box.h2}>Each tier has its own line. New skills hang off the current base.</h2>
        <div className={s.scroll} tabIndex={0} role="region" aria-label="Base lineage map"><Lineage /></div>
        <ul className={s.legend} aria-label="Legend">
          <li data-kind="base">Base revision</li><li data-kind="lost">Candidate that lost</li>
          <li data-kind="feature">Feature track</li><li data-kind="next">Next revision</li>
        </ul>
        <DetailsRow summary="Every revision">
          <ul className={s.revisions}>{REVISIONS.map(r => <li key={r.name}>
            <span className={s.revName}>{r.name}</span><span className={s.revTag} data-tag={r.tag}>{r.tag}</span><span className={s.revWhen}>{r.when}</span><p>{r.body}</p>
          </li>)}</ul>
        </DetailsRow>
        <DetailsRow summary="About the box scores">
          <div className={m.prose}>
            <p>Both are research runs on the same 222 test images (industrial defects and generated shapes), one seed each, with adapters trained on the same kinds of images. The mini adapter trained on v1, not r5. Neither is a track result yet.</p>
            <p>On lite, training lifts mean overlap from 0.032 to 0.251, at 0.6 s per box against 3.3 s on mini, but only 3 of 122 defect images reach IoU 0.5 against 42 on mini.</p>
          </div>
        </DetailsRow>
      </section>

      <SectionRow n="03" label="How a base is elected" />
      <section className={box.section} aria-labelledby="elect-heading">
        <h2 id="elect-heading" className={box.visuallyHidden}>How a base is elected</h2>
        <Steps items={ELECT} />
      </section>

      <SectionRow n="04" label="How a skill is added" note="Planned" />
      <section className={box.section} aria-labelledby="feature-heading">
        <h2 id="feature-heading" className={box.visuallyHidden}>How a skill is added</h2>
        <Steps items={FEATURE} />
      </section>

      <div className={m.more}>
        <Link href="/miners/tracks/box">Box track</Link>
        <Link href="/miners">Compete for a base</Link>
        <Link href="/model">Research</Link>
      </div>
    </SiteFrame>
  );
}

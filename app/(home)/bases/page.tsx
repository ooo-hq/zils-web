import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { DetailsRow } from '@/components/site/details-row';
import m from '../miners/miners.module.css';
import box from '../miners/tracks/box/box.module.css';
import { Lineage } from './lineage';
import s from './bases.module.css';

export const metadata: Metadata = {
  title: 'Zils — z3 base history',
  description: 'Zils base revisions, synthetic box competitions, and the separate qualification required before a feature can graduate into a base.',
  alternates: { canonical: 'https://zils.ai/bases' },
};

const ELECT = [
  ['Train', 'A miner fine-tunes a candidate from the current base in its tier, uploads it to Hugging Face and commits the hash on chain.'],
  ['Exam', 'Validators pull it and score it on sealed questions. It must beat the current base, and the win must hold on a fresh draw.'],
  ['Suite', 'Customer adapters are retrained on the candidate and must not get worse. A graduated skill would also need a retained exam in this suite; no box skill has graduated yet.'],
  ['Crown', 'Once the release is reviewed, the winner’s miner joins the last five kings, who share the tier’s pay. A tier with no king burns its share.'],
  ['Release', 'The new base ships as latest. Customer models move over when they stay within 0.005 Brier of their old score; stable follows.'],
];

const FEATURE = [
  ['Open', 'The synthetic box pilot has separate mini v1 and lite v1 tracks, each pinned to its exact parent. An operator reference sets the initial score to beat; no box king has qualified yet.'],
  ['Compete', 'Miners submit adapters. A winner must pass every IoU, absence and presence-confidence gate on two disjoint private draws at least 12 hours apart, then receive a reviewed crown.'],
  ['Graduate', 'A box crown is separate from a base release. Graduation would require real-image qualification, the full base regression suite and a separate release review. It is not automatic at the next revision.'],
  ['Guard', 'Before graduation, the skill’s qualifying exam must become part of the base regression suite, so later candidates are checked for losing it. No box skill has graduated yet.'],
];

function Steps({ items }: { items: string[][] }) {
  return <ol className={box.rules}>{items.map(([title, body], i) => <li key={title}>
    <span className={box.num}>{String(i + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{body}</p>
  </li>)}</ol>;
}

export default function BasesPage() {
  return (
    <SiteFrame current="model">
      <SectionRow n="01" label="Bases" note="As of 21 Oct 2026" />
      <header className={m.hero}>
        <h1>z3 base history</h1>
        <p>Every customer model is an adapter on a shared base. A base moves forward only when a miner’s candidate <b>beats it without hurting anything customers already run</b>.</p>
      </header>

      <dl className={m.nums}>
        <div><dt>Base tiers live</dt><dd>2</dd></div>
        <div><dt>Latest mini</dt><dd className={m.sm}>v1</dd></div>
        <div><dt>Candidates stopped</dt><dd>5</dd></div>
        <div><dt>Feature tracks</dt><dd className={m.sm}>Boxes · testnet</dd></div>
      </dl>

      <SectionRow n="02" label="Lineage" note="Bases left to right, skills below" />
      <section className={box.section} aria-labelledby="lineage-heading">
        <h2 id="lineage-heading" className={box.h2}>Each tier has its own line. New skills hang off the current base.</h2>
        <p className="mb-6 text-sm text-muted">The z3-mini founding baseline retains the original d3 checkpoint. This history also includes upstream lite research and withdrawn candidates; these are not additional z3 releases. <Link href="/z3" className="underline underline-offset-4">See the z3 model line.</Link></p>
        <Lineage />
        <ul className={s.legend} aria-label="Legend">
          <li data-kind="base">Base revision</li><li data-kind="lost">Candidate that lost</li>
          <li data-kind="feature">Feature track</li><li data-kind="next">Next revision</li>
        </ul>
        <DetailsRow summary="About the box scores">
          <div className={m.prose}>
            <p>Both are historical research runs on the same 222 test images (industrial defects and generated shapes), one seed each, with adapters trained on the same kinds of images. The mini adapter trained on v1, the pilot’s parent, but not on the pilot exam. These scores are separate from the synthetic-only testnet competition and do not qualify a king.</p>
            <p>On lite, training lifts mean overlap from 0.032 to 0.251, at 0.6 s per box against 3.3 s on mini, but only 3 of 122 defect images reach IoU 0.5 against 42 on mini.</p>
          </div>
        </DetailsRow>
      </section>

      <SectionRow n="03" label="How a base is elected" />
      <section className={box.section} aria-labelledby="elect-heading">
        <h2 id="elect-heading" className={box.visuallyHidden}>How a base is elected</h2>
        <Steps items={ELECT} />
      </section>

      <SectionRow n="04" label="From feature track to base" note="Separate qualification" />
      <section className={box.section} aria-labelledby="feature-heading">
        <h2 id="feature-heading" className={box.visuallyHidden}>From feature track to base</h2>
        <Steps items={FEATURE} />
      </section>

      <div className={m.more}>
        <Link href="/miners/tracks/box">Box track</Link>
        <Link href="/miners">Compete for a base</Link>
        <Link href="/roadmap">Vote on what comes next</Link>
        <Link href="/model">Research</Link>
      </div>
    </SiteFrame>
  );
}

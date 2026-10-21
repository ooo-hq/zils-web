import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import m from '../miners/miners.module.css';
import box from '../miners/tracks/box/box.module.css';
import { Votes } from './votes';

export const metadata: Metadata = {
  title: 'Zils — roadmap',
  description: 'Vote for what Zils models learn next: counting, text spans, points, video, multi-select and masks.',
  alternates: { canonical: 'https://zils.ai/roadmap' },
};

export default function RoadmapPage() {
  return (
    <SiteFrame current="model">
      <SectionRow n="01" label="Roadmap" note="Proposed features" />
      <header className={m.hero}>
        <h1>What should the models learn next?</h1>
        <p>Each of these is a new kind of answer from the same model, shown in orange. Vote for the ones you would use. Votes guide the order; they don’t decide it.</p>
      </header>

      <section className={box.section} aria-labelledby="features-heading">
        <h2 id="features-heading" className={box.visuallyHidden}>Proposed features</h2>
        <Votes />
        <p className={box.fine}>All six are proposed; work has not started on any of them. Sign in to vote, and tap again to take a vote back. Already in competition: <Link href="/miners/tracks/box">boxes</Link>, a synthetic-only testnet pilot.</p>
      </section>

      <div className={m.more}>
        <Link href="/bases">Bases</Link>
        <Link href="/miners">Compete for a base</Link>
      </div>
    </SiteFrame>
  );
}

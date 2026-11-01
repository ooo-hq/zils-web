import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import m from '../miners/miners.module.css';
import box from '../miners/tracks/box/box.module.css';
import { MergeBuilder } from './merge-builder';
import s from './merge.module.css';

export const metadata: Metadata = {
  title: 'Zils — merge models',
  description: 'Pick up to five decision models that share a base, set their parts, and run one command to merge them on your own machine.',
  alternates: { canonical: 'https://zils.ai/merge' },
};

export default function MergePage() {
  return (
    <SiteFrame current="model">
      <SectionRow n="01" label="Merge" note="Runs on your machine" />
      <header className={s.hero}>
        <div className={s.heroText}>
          <h1 className={s.heroTitle}>Merge models<span className={s.period} aria-hidden="true" /></h1>
          <p>Pick up to five decision models built on the same base from the market below, give each a share, and choose how to blend them. One command downloads them and writes the merged model to a folder.</p>
        </div>
        {/* Five colours, one per place in the mix, slide together into one tile once on load. */}
        <div className={s.heroArt} data-merge-hero="" aria-hidden="true">
          {[1, 2, 3, 4, 5].map(n => <span key={n} className={s.sheet} data-sheet={n} />)}
          <span className={s.merged} data-merged="" />
        </div>
      </header>

      <section className={box.section} aria-labelledby="build-heading">
        <h2 id="build-heading" className={box.visuallyHidden}>Build the merge command</h2>
        <MergeBuilder />
      </section>

      <section className={box.section} aria-labelledby="notes-heading">
        <h2 id="notes-heading" className={box.h2}>Good to know</h2>
        <ul className={s.notes}>
          <li><b>Same family only.</b> Models built on different bases have different shapes, so their weights can’t be averaged. Each family here shares one Qwen3.5 base.</li>
          <li><b>The first model’s files are kept.</b> Its config, tokenizer and answer layer come with the merge. Put d3-lite or d3-mini first to keep the z3 answer layer.</li>
          <li><b>Nothing is uploaded or scored.</b> The merge runs locally and stays on your machine. A merge can beat every model in it or fall behind them; to measure yours, <Link href="/miners">enter it in a pool</Link>. A mix of house models and listed public models earns a reduced rate there.</li>
          <li><b>Check every licence.</b> Every model listed is Apache-2.0. Each model’s licence is copied into the folder, and <code>merge.json</code> records the recipe.</li>
        </ul>
      </section>

      <div className={m.more}>
        <Link href="/bases">Bases</Link>
        <Link href="/miners">Compete for a base</Link>
      </div>
    </SiteFrame>
  );
}

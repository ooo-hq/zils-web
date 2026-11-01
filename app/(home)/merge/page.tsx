import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import m from '../miners/miners.module.css';
import box from '../miners/tracks/box/box.module.css';
import { MergeBuilder } from './merge-builder';
import s from './merge.module.css';

export const metadata: Metadata = {
  title: 'Zils — merge two models',
  description: 'Pick two decision models built on the same base, choose how to blend them, and run one command to merge them on your machine.',
  alternates: { canonical: 'https://zils.ai/merge' },
};

export default function MergePage() {
  return (
    <SiteFrame current="model">
      <SectionRow n="01" label="Merge" note="Runs on your machine" />
      <header className={m.hero}>
        <h1>Merge two models.</h1>
        <p>Pick two decision models built on the same base and choose how to blend them. One command downloads both and writes the merged model to a folder.</p>
      </header>

      <section className={box.section} aria-labelledby="build-heading">
        <h2 id="build-heading" className={box.visuallyHidden}>Build the merge command</h2>
        <MergeBuilder />
      </section>

      <section className={box.section} aria-labelledby="notes-heading">
        <h2 id="notes-heading" className={box.h2}>Good to know</h2>
        <ul className={s.notes}>
          <li><b>Same family only.</b> Models built on different bases have different shapes, so their weights can’t be averaged. Each family here shares one Qwen3.5 base.</li>
          <li><b>The first model’s files are kept.</b> Its config, tokenizer and answer layer come with the merge. Put a z3 model first to keep its answer layer.</li>
          <li><b>Nothing is uploaded or scored.</b> The merge runs locally and stays on your machine. A merge can beat both parents or fall behind both; to measure yours, <Link href="/miners">enter it in a pool</Link>.</li>
          <li><b>Check both licences.</b> Every model listed is Apache-2.0. The second model’s licence is copied into the folder next to the first’s, and <code>merge.json</code> records the recipe.</li>
        </ul>
      </section>

      <div className={m.more}>
        <Link href="/bases">Bases</Link>
        <Link href="/miners">Compete for a base</Link>
      </div>
    </SiteFrame>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { SiteButton } from '@/components/site/site-button';
import { Reveal } from '@/components/site/reveal';
import { Ingredients } from '../soup/ingredients';
import s from './z3.module.css';

export const metadata: Metadata = {
  title: 'z3 — the Zils decision-model line',
  description: 'Meet z3: five decision-model lineages, starting with the z3-mini v1 founding baseline. Miners compete to produce subsequent releases.',
  alternates: { canonical: 'https://zils.ai/z3' },
};

const WEIGHTS = 'https://huggingface.co/zils-ai/z3-mini-v1/tree/c9b7515250c0444192767fc00975402f12421413';

// Each lineage keeps one spectrum stop as its colour.
const LINEUP = [
  { name: 'z3-lite', params: 0.85, status: 'Planned release', color: '#ef8d5a' },
  { name: 'z3-nano', params: 2.21, status: 'Planned release', color: '#d9a08c' },
  { name: 'z3-mini', params: 4.54, status: 'v1 · Founding baseline', color: '#cfa2e4', released: true },
  { name: 'z3-flash', params: 8.39, status: 'Planned release', color: '#a9b5f2' },
  { name: 'z3', params: 26.09, status: 'Planned release', color: '#8ea6ff' },
];

// Tower height on a log scale from a 0.4B floor, so 0.85B stays visible next to 26B.
const height = (p: number) => Math.log(p / 0.4) / Math.log(26.09 / 0.4);

// The release path, from zils docs/mining.md "Soup pool" and docs/base-election.md (main 16b87a6).
const STEPS = [
  ['Submit', 'Miners commit a candidate on chain. For z3-mini, they commit a body for the soup.'],
  ['Every night', 'z3-mini: validators rebuild the soup from the house models and miners’ bodies and pay its seats. Other sizes: candidates sit sealed exams against the current release.'],
  ['Every 14 to 28 days', 'At a release window, the mini soup or the best candidate must beat the current release on two sealed draws, hold its lead 12 hours later and keep customer adapters at least as good.'],
  ['Release', 'A reviewed promotion makes it the next version, with its checkpoint, evidence and, for a soup, its member list: each seat’s hotkey and body hash.'],
];

// One mark per night of a 28-night cycle; the release window opens on night 14.
const NIGHTS = 28;
const WINDOW_OPENS = 14;

export default function Z3Page() {
  return <SiteFrame current="z3">
    <SectionRow n="01" label="The z3 model line" note="Heights show parameters, log scale" />
    <header className={s.hero}>
      <div className={s.intro}>
        <h1 className={s.mark}>z3</h1>
        <div className={s.lede}>
          <p className={s.tagline}>Decision models, improved through competition.</p>
          <p>Start with a published baseline. Miners train candidates, validators evaluate them independently, and approved winners (for mini, the best soup) become new releases in their own model lineage.</p>
          <div className={s.ctas}>
            <SiteButton href="https://docs.zils.ai/getting-started/models" variant="primary">Read the model guide</SiteButton>
            <SiteButton href="/miners" variant="secondary">Start mining</SiteButton>
          </div>
        </div>
      </div>

      <Reveal>
        <div className={s.sky} aria-hidden="true">
          {LINEUP.map((m, i) => <div key={m.name} className={s.col} data-released={m.released ? '' : undefined}
            style={{ '--c': m.color, '--h': height(m.params), '--i': i } as React.CSSProperties}>
            <div className={s.tower}>{m.released && <span className={s.flag}>v1</span>}</div>
            <div className={s.label}>
              <b>{m.name}</b>
              <span>{m.params}B</span>
              <span className={s.status}>{m.released ? 'Founding baseline' : 'Planned'}</span>
            </div>
          </div>)}
        </div>
      </Reveal>
      <table className="sr-only">
        <caption>z3 model line and release status</caption>
        <thead><tr><th scope="col">Model line</th><th scope="col">Parameters</th><th scope="col">Release status</th></tr></thead>
        <tbody>{LINEUP.map(m => <tr key={m.name}><th scope="row">{m.name}</th><td>{m.params}B</td><td>{m.status}</td></tr>)}</tbody>
      </table>
      <p className={s.fine}>A size for each workload. Each lineage needs its own qualification. Hosted availability is separate from weight publication; use the models listed for your account.</p>
    </header>

    <SectionRow n="02" label="z3-mini" note="Current release: v1" />
    <section className={s.split} aria-labelledby="baseline-heading">
      <div>
        <h2 id="baseline-heading" className={s.h2}>v1 today, a soup next.</h2>
        <div className={s.prose}>
          <p>z3-mini v1 is the current release. It uses the unchanged upstream d3-mini weights, which Zils selected as the founding mini baseline; it was not trained by Zils or elected as a miner winner.</p>
          <p>The next version will not be built on v1 alone. It is a soup that starts from five open house models, v1 among them, plus any miner bodies that make it better. Because v1 is one of the five house models in every mini soup, a soup that nothing lifts past v1 is just v1 again and cannot clear the release bar.</p>
          <p>Existing downloads and API profile IDs retain their original names. The model guide explains how public release names map to those artifacts.</p>
        </div>
      </div>
      <dl className={s.card}>
        <div><dt>Current release</dt><dd>z3-mini v1</dd></div>
        <div><dt>Parameters</dt><dd>4.54B</dd></div>
        <div><dt>Input ceiling</dt><dd>4,096 tokens</dd></div>
        <div><dt>Weights</dt><dd>Upstream d3-mini, unchanged</dd></div>
        <div><dt>Next version</dt><dd>A soup of up to five bodies</dd></div>
        <div><dt>Checkpoint</dt><dd><a href={WEIGHTS}>Explore the founding weights on Hugging Face</a></dd></div>
      </dl>
    </section>

    <SectionRow n="03" label="Subsequent releases" />
    <section className={s.releases} aria-labelledby="election-heading">
      <h2 id="election-heading" className={s.h2}>Each new release earns its place.</h2>
      <ol className={s.steps}>
        {STEPS.map(([title, body], i) => <li key={title}>
          <span className={s.num}>{String(i + 1).padStart(2, '0')}</span>
          <h3>{title}</h3>
          <p>{body}</p>
        </li>)}
      </ol>
      <figure className={s.cadence} aria-label="Release cadence">
        <ol className={s.nights} aria-hidden="true">
          {Array.from({ length: NIGHTS }, (_, i) => i + 1 < WINDOW_OPENS
            ? <li key={i} />
            : <li key={i} data-window="" style={{ '--k': i + 1 - WINDOW_OPENS, '--span': NIGHTS - WINDOW_OPENS + 1 } as React.CSSProperties} />)}
        </ol>
        <figcaption className={s.cadenceKey}>
          <span>{NIGHTS} nights, a soup round each</span>
          <span className={s.windowKey}>Release window, from night {WINDOW_OPENS} to {NIGHTS}</span>
        </figcaption>
      </figure>
      <p className={s.fine}>A submitted candidate is not yet an official release, and a win in one size does not qualify another.</p>
      <div className={s.soup}>
        <div className={s.prose}>
          <h3 className={s.h3}>z3-mini: a soup that passed the release gate.</h3>
          <p>The next z3-mini is not one miner’s model. It is an average of up to five fine-tunes of the same Qwen base: the house models and any miner bodies that make it better. It passes the same release window as every other size.</p>
          <p>Lite, nano, flash and z3 stay king of the hill: one winning candidate per release.</p>
        </div>
        <Ingredients />
      </div>
      <div className={s.links}><Link href="/soup">How the soup is made</Link><Link href="/bases">Explore the base history</Link><Link href="/model">Read the research</Link></div>
    </section>
  </SiteFrame>;
}

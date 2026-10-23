import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { SiteButton } from '@/components/site/site-button';
import s from '../miners/miners.module.css';

export const metadata: Metadata = {
  title: 'z3 — the Zils decision-model line',
  description: 'Meet z3: five decision-model lineages, starting with the z3-mini v1 founding baseline. Miners compete to produce subsequent releases.',
  alternates: { canonical: 'https://zils.ai/z3' },
};

const LINEUP = [
  ['z3-lite', '0.85B', 'Planned release'],
  ['z3-nano', '2.21B', 'Planned release'],
  ['z3-mini', '4.54B', 'v1 · Founding baseline'],
  ['z3-flash', '8.39B', 'Planned release'],
  ['z3', '26.09B', 'Planned release'],
] as const;

export default function Z3Page() {
  return <SiteFrame current="z3">
    <SectionRow n="01" label="The z3 model line" />
    <header className={s.hero}>
      <h1>z3</h1>
      <p>Decision models, improved through competition.</p>
      <p>Start with a published baseline. Miners train candidates, validators evaluate them independently, and approved winners become new releases in their own model lineage.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <SiteButton href="https://docs.zils.ai/getting-started/models" variant="primary">Read the model guide</SiteButton>
        <SiteButton href="/miners" variant="secondary">Train a candidate</SiteButton>
      </div>
    </header>
    <SectionRow n="02" label="Five model lineages" note="Approximate parameter counts" />
    <section className="px-6 py-12 sm:px-10" aria-labelledby="lineup-heading">
      <h2 id="lineup-heading" className="text-2xl font-light">A size for each workload.</h2>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">z3 model line and release status</caption>
          <thead><tr>{['Model line', 'Parameters', 'Release status'].map(label => <th key={label} scope="col" className="border-b border-edge px-2 py-4 font-medium">{label}</th>)}</tr></thead>
          <tbody>{LINEUP.map(([name, parameters, status]) => <tr key={name}>
            <th scope="row" className="border-b border-edge px-2 py-4 font-medium">{name}</th>
            <td className="border-b border-edge px-2 py-4 tabular-nums">{parameters}</td>
            <td className="border-b border-edge px-2 py-4">{status}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="mt-5 text-sm text-muted">Each lineage needs its own qualification. Hosted availability is separate from weight publication; use the models listed for your account.</p>
    </section>
    <SectionRow n="03" label="z3-mini v1" note="Founding baseline" />
    <section className="px-6 py-12 sm:px-10" aria-labelledby="baseline-heading">
      <h2 id="baseline-heading" className="mb-5 text-2xl font-light">A documented starting point.</h2>
      <div className={s.prose}>
        <p>z3-mini v1 uses the unchanged upstream d3-mini weights. Zils selected this checkpoint as the founding mini baseline. It was not trained by Zils or elected as a miner winner.</p>
        <p>The Zils profile has a 4,096-token input ceiling. Existing downloads and API profile IDs retain their original names. The model guide explains how public release names map to those artifacts.</p>
        <p><a className="underline underline-offset-4" href="https://huggingface.co/zils-ai/z3-mini-v1/tree/c9b7515250c0444192767fc00975402f12421413">Explore the founding weights on Hugging Face</a></p>
      </div>
    </section>
    <SectionRow n="04" label="Subsequent releases" />
    <section className="px-6 py-12 sm:px-10" aria-labelledby="election-heading">
      <h2 id="election-heading" className="mb-5 text-2xl font-light">Each new release earns its place.</h2>
      <div className={s.prose}>
        <p>Under the z3 release policy, miners submit candidates for an enabled lineage. Validators compare them with its incumbent on protected evaluation data. Required qualification and release review come before an elected model is published.</p>
        <p>Each approved release has its own version, checkpoint and evidence. A submitted candidate is not yet an official release, and a win in one size does not qualify another.</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-6 text-sm underline underline-offset-4"><Link href="/bases">Explore the base history</Link><Link href="/model">Read the research</Link></div>
    </section>
  </SiteFrame>;
}

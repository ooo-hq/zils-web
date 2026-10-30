import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { SiteButton } from '@/components/site/site-button';
import { InstallCommand } from '@/components/site/install-command';
import { Reveal } from '@/components/site/reveal';
import { Bowl, SEATS } from './bowl';
import s from './soup.module.css';

export const metadata: Metadata = {
  title: 'Greedy soup — how z3-mini is made',
  description: 'z3-mini is a soup: up to five miner-trained models averaged into one, chosen greedily every day. How seats, the solo crown and releases work.',
  alternates: { canonical: 'https://zils.ai/soup' },
};

const GUIDE = 'https://docs.zils.ai/operations/soup';

// Rules from the soup design of 30 October 2026 (zils soup_round constants). Change them here, not in the copy.
const STEPS = [
  ['持込', 'Bring a body', 'Fine-tune Qwen/Qwen3.5-4B any way you like. Upload the full body to Hugging Face and commit its hash on chain.'],
  ['味見', 'Taste it alone', 'Each day a validator grades every body in the pool on a fresh, seeded slice of a private exam, through d3-mini’s fixed answer layer.'],
  ['欲張り', 'Ladle greedily', 'Start with the best body. Add the next best only if the soup scores at least 0.3 points higher. Stop at five.'],
  ['抜き', 'Taste without you', 'Each member is lifted out once. What the soup loses without it is that member’s contribution.'],
  ['毎日', 'Serve daily', 'Seats are re-earned every round. A body that drops out of the bowl stops earning at once.'],
] as const;

const BILL = [
  ['Soup seats', '80%', 'Split equally among members whose contribution is at least 0.3 points, each times its rate.'],
  ['Solo crown', '20%', 'The round’s best single body that is not a house ingredient, times its rate.'],
  ['Anything unearned', 'Burned', 'Empty seats and an unclaimed crown pay no one.'],
] as const;

const RATES = [
  ['Trainer', '1×', 'You trained the body.'],
  ['Scout', '0.25×', 'You found an open model released after launch.'],
  ['House ingredient', '0', 'Open models known at launch. They cook; they are not paid.'],
] as const;

const RULES = [
  <>Any fine-tune of <code>Qwen/Qwen3.5-4B</code> with d3-mini’s body layout, trained from plain Qwen, a z3 release or another open model.</>,
  <>You bring the body only. d3-mini’s answer layer, prompt and runtime stay fixed.</>,
  <>Move at most about 15% away from Qwen.</>,
  <>Apache-2.0, MIT or BSD licence.</>,
  <>Your repo names your hotkey in <code>zils-owner.json</code>. The first valid commitment of a body wins it.</>,
  <>No reheats: near-exact copies of another body, the soup or the release, and models that answer like a member, are turned away.</>,
  <>Up to 20 bodies compete for the five seats each round.</>,
];

// Exam v3 qualification draws, 30 Oct 2026; points versus stock z3-mini.
const TASTE = [['First sealed draw', 4.26], ['Second sealed draw', 6.63]] as const;

export default function SoupPage() {
  return <SiteFrame current="miners">
    <SectionRow n="01" label="Greedy soup" note="欲張りスープ · z3-mini" />
    <header className={s.hero}>
      <div className={s.intro}>
        <h1 className={s.title}>Greedy <span>soup.</span></h1>
        <p className={s.tagline}>The best z3-mini isn’t one model. It’s a bowl.</p>
        <p className={s.lede}>Up to five of the best bodies miners can bring, averaged into one model and tasted again every day. A body keeps its seat only while the soup is better with it.</p>
        <div className={s.ctas}>
          <SiteButton href="#start" variant="primary">Start mining</SiteButton>
          <SiteButton href="#menu" variant="secondary">How the soup is made</SiteButton>
        </div>
      </div>
      <Reveal>
        <figure className={s.stage}>
          <Bowl />
          <figcaption className={s.seats}>
            {SEATS.map((c, i) => <span key={c}><i style={{ background: c }} />Seat {i + 1}</span>)}
          </figcaption>
        </figure>
      </Reveal>
    </header>

    <SectionRow n="02" label="How a soup is made" note="お品書き · menu" />
    <section id="menu" className={s.section} aria-labelledby="menu-heading">
      <h2 id="menu-heading" className={s.h2}>Five steps, every day.</h2>
      <ol className={s.steps} aria-label="How a soup is made">
        {STEPS.map(([jp, title, body], i) => <li key={title} style={{ '--c': SEATS[i] } as React.CSSProperties}>
          <div className={s.stepTop}><span className={s.num}>{String(i + 1).padStart(2, '0')}</span><span className={s.jp} lang="ja" aria-hidden="true">{jp}</span></div>
          <h3>{title}</h3>
          <p>{body}</p>
        </li>)}
      </ol>
      <p className={s.fine}>Averages of fine-tunes from the same base often beat every one of their ingredients. Ladling greedily keeps only the bodies that make the bowl better.</p>
    </section>

    <SectionRow n="03" label="The bill" note="お会計 · who gets paid" />
    <section className={`${s.section} ${s.bill}`} aria-label="The bill">
      <table className={s.card}>
        <caption>Who gets paid</caption>
        <tbody>{BILL.map(([who, share, note]) => <tr key={who}>
          <th scope="row">{who}<small>{note}</small></th><td>{share}</td>
        </tr>)}</tbody>
      </table>
      <table className={s.card}>
        <caption>Seat rates</caption>
        <tbody>{RATES.map(([who, rate, note]) => <tr key={who}>
          <th scope="row">{who}<small>{note}</small></th><td>{rate}</td>
        </tr>)}</tbody>
      </table>
    </section>

    <SectionRow n="04" label="Taste test" note="試食 · 30 Oct 2026" />
    <section className={`${s.section} ${s.taste}`} aria-label="Taste test">
      <div className={s.prose}>
        <h2 className={s.h2}>The method, tasted.</h2>
        <p>We averaged three open 4B decision models that other teams had fine-tuned from the same Qwen base, picked greedily on our sealed decision exam. The soup beat stock z3-mini on two separate sealed draws, and beat its own best ingredient.</p>
        <p>More was not always better: stock z3-mini and a fourth fine-tune were left out because they lowered the score. Customer adapters trained on the soup did as well as on z3-mini.</p>
        <p className={s.note}>These were outside open models, not miner submissions, and this bowl is not a release. It shows the method works.</p>
      </div>
      <figure className={s.bars}>
        <figcaption>Points gained over stock z3-mini</figcaption>
        <dl>{TASTE.map(([label, gain]) => <div key={label}>
          <dt>{label}</dt>
          <dd className={s.gain}>+{gain.toFixed(2)}</dd>
          <dd aria-hidden="true" className={s.track}><span style={{ width: `${(gain / 8) * 100}%` }} /></dd>
        </div>)}</dl>
      </figure>
    </section>

    <SectionRow n="05" label="House rules" note="店のルール" />
    <section className={s.section} aria-label="House rules">
      <ul className={s.rules}>{RULES.map((rule, i) => <li key={i}>{rule}</li>)}</ul>
    </section>

    <SectionRow n="06" label="From bowl to release" />
    <section className={s.section} aria-labelledby="release-heading">
      <h2 id="release-heading" className={s.h2}>A good soup becomes the next z3-mini.</h2>
      <div className={s.prose}>
        <p>Every 14 to 28 days the soup can become the next release. It must beat the current release by at least one point on two sealed release exams that rounds never use, hold that lead 12 hours later, and keep customer adapters at least as good. A reviewed promotion then makes it the next z3-mini. Its members are paid through their seats; the release itself has no single winner.</p>
      </div>
      <div className={s.links}><Link href="/z3">The z3 model line</Link><Link href="/miners">Miner leaderboard</Link></div>
    </section>

    <SectionRow n="07" label="Start mining" note="いらっしゃい" />
    <section id="start" className={s.section} aria-labelledby="start-heading">
      <h2 id="start-heading" className={s.h2}>Pull up a stool.</h2>
      <InstallCommand command="curl -fsSL https://zils.ai/install.sh | sh" label="Miner install command" />
      <p className={s.fine}>Upload your body to a public Hugging Face repo, then check and commit it with <code>zils commit-body</code>. Without <code>--yes</code> it is a dry run that prints the commitment and writes nothing. A hotkey has one commitment slot, shared with base candidates.</p>
      <p className={s.fine}>Training needs Linux x86_64 with an NVIDIA GPU. <a href={GUIDE}>Read the miner guide</a> for body rules, committing and pay. Rules as of 30 October 2026.</p>
    </section>
  </SiteFrame>;
}

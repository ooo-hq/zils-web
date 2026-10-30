import type { Metadata } from 'next';
import Link from 'next/link';
import { Dela_Gothic_One } from 'next/font/google';
import { SiteFrame } from '@/components/site/site-frame';
import { InstallCommand } from '@/components/site/install-command';
import { Bowl } from './bowl';
import s from './soup.module.css';

// Dela Gothic One carries both the Latin display type and the kana on the shop signs.
const dela = Dela_Gothic_One({ subsets: ['latin'], weight: '400', variable: '--font-dela' });

export const metadata: Metadata = {
  title: 'Greedy soup — how z3-mini is made',
  description: 'z3-mini is a soup: up to five miner-trained models averaged into one, chosen greedily every day. How seats, the solo crown and releases work.',
  alternates: { canonical: 'https://zils.ai/soup' },
};

const GUIDE = 'https://docs.zils.ai/operations/miner-tuning';

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
  ['Solo crown', '20%', 'The best single body that is not a house ingredient, if it beats every house body and the soup itself by 0.3 points.'],
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
    <div className={`${s.soup} ${dela.variable}`}>
      <ul className={s.noren} aria-hidden="true">
        {['欲', '張', 'り', 'ス', 'ー', 'プ'].map((ch, i) => <li key={i}>{ch}</li>)}
      </ul>

      <header className={s.hero}>
        <div className={s.heroText}>
          <p className={s.kicker}><span>本日のスープ</span> z3-mini · mini pool</p>
          <h1 className={s.title}>Greedy soup.</h1>
          <p className={s.lede}>The best z3-mini isn’t one model. It’s a bowl: up to five of the best bodies miners can bring, averaged into one model and tasted again every day.</p>
          <div className={s.ctas}>
            <a className={s.ticket} href="#menu">How the soup is made</a>
            <a className={s.ticketAlt} href="#start">Start mining</a>
          </div>
        </div>
        <div className={s.stage}>
          <span className={s.vertical} aria-hidden="true">スープ</span>
          <Bowl />
          <p className={s.caption}>Five toppings, five seats.</p>
        </div>
      </header>

      <div className={s.halftone} aria-hidden="true" />

      <section id="menu" className={s.section} aria-labelledby="menu-heading">
        <div className={s.head}><span className={s.jp} aria-hidden="true">お品書き</span><h2 id="menu-heading">How a soup is made</h2></div>
        <ol className={s.menu} aria-label="How a soup is made">
          {STEPS.map(([jp, title, body], i) => <li key={title} className={s.card}>
            <div className={s.cardTop}><span className={s.no}>{String(i + 1).padStart(2, '0')}</span><span className={s.cardJp} aria-hidden="true">{jp}</span></div>
            <h3>{title}</h3>
            <p>{body}</p>
          </li>)}
        </ol>
        <p className={s.fine}>Averages of fine-tunes from the same base often beat every one of their ingredients. Ladling greedily keeps only the bodies that make the bowl better.</p>
      </section>

      <section className={`${s.section} ${s.billWrap}`} aria-labelledby="bill-heading">
        <div className={s.head}><span className={s.jp} aria-hidden="true">お会計</span><h2 id="bill-heading">The bill</h2></div>
        <div className={s.receipts}>
          <table className={s.receipt}>
            <caption>Who gets paid</caption>
            <tbody>{BILL.map(([who, share, note]) => <tr key={who}>
              <th scope="row">{who}<small>{note}</small></th><td>{share}</td>
            </tr>)}</tbody>
            <tfoot><tr><th scope="row">The mini pool’s share</th><td>100%</td></tr></tfoot>
          </table>
          <table className={s.receipt}>
            <caption>Seat rates</caption>
            <tbody>{RATES.map(([who, rate, note]) => <tr key={who}>
              <th scope="row">{who}<small>{note}</small></th><td>{rate}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className={s.section} aria-label="Taste test">
        <div className={s.head}><span className={s.jp} aria-hidden="true">試食</span><h2>Taste test</h2></div>
        <div className={s.taste}>
          <div className={s.prose}>
            <p>On 30 October 2026 we averaged three open 4B decision models that other teams had fine-tuned from the same Qwen base, picked greedily on our sealed decision exam. The soup beat stock z3-mini on two separate sealed draws, and beat its own best ingredient.</p>
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
        </div>
      </section>

      <section className={s.section} aria-labelledby="rules-heading">
        <div className={s.head}><span className={s.jp} aria-hidden="true">店のルール</span><h2 id="rules-heading">House rules</h2></div>
        <ul className={s.rules}>{RULES.map((rule, i) => <li key={i}>{rule}</li>)}</ul>
      </section>

      <section className={s.section} aria-labelledby="release-heading">
        <div className={s.head}><span className={s.jp} aria-hidden="true">新作</span><h2 id="release-heading">From bowl to release</h2></div>
        <div className={s.prose}>
          <p>Every 14 to 28 days the soup can become the next z3-mini. It must beat the current release by at least one point on two sealed release exams that rounds never use, hold that lead 12 hours later, and keep customer adapters at least as good. Its members are paid through their seats; the release itself has no single winner.</p>
        </div>
        <div className={s.links}><Link href="/z3">The z3 model line</Link><Link href="/miners">Miner leaderboard</Link></div>
      </section>

      <section id="start" className={`${s.section} ${s.start}`} aria-labelledby="start-heading">
        <div className={s.head}><span className={s.jp} aria-hidden="true">いらっしゃい</span><h2 id="start-heading">Pull up a stool</h2></div>
        <InstallCommand command="curl -fsSL https://zils.ai/install.sh | sh" label="Miner install command" />
        <p className={s.fine}>Training needs Linux x86_64 with an NVIDIA GPU. <a href={GUIDE}>Read the miner guide</a> for preparing data and checking your body before you commit it. Rules as of 30 October 2026.</p>
      </section>
    </div>
  </SiteFrame>;
}

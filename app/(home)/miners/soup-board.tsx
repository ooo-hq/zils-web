'use client';

import { useState, type ReactNode } from 'react';
import { SEATS } from '../soup/bowl';
import { FoodIcon, type Food } from '../soup/food-icons';
import type { TierView } from '@/lib/soup-board';
import s from './soup-board.module.css';

// Tonight's soup as a bento box: one box per tier, chosen with chips; compartments divided by thin site-line walls.
const CATEGORY_NAMES = { reasoning: 'Reasoning', language: 'Language', retrieval: 'Retrieval', tools: 'Tools', arts: 'Arts' } as const;
const KIND = { house: 'House', trainer: 'Trainer 1×', scout: 'Scout 0.25×' } as const;

const signed = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}`;
const when = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(iso));

/** One compartment: a labelled group with its Japanese mark and, where it helps, a food icon. */
export function Cell({ area, label, jp, icon, children }: { area: string; label: string; jp: string; icon?: Food; children: ReactNode }) {
  return <section role="group" aria-label={label} className={s.cell} style={{ gridArea: area }}>
    <p className={s.kicker}>{icon && <FoodIcon name={icon} />}<span lang="ja" aria-hidden="true" className={s.jp}>{jp}</span>{label}</p>
    {children}
  </section>;
}

/** Soup score by round as a rising line of steam: oldest left, tonight at the right. */
function Steam({ history }: { history: number[] }) {
  const w = 320, h = 64, pad = 5;
  const lo = Math.min(...history), hi = Math.max(...history), span = hi - lo || 1;
  const pts = history.map((v, i) => [pad + (history.length === 1 ? w - 2 * pad : (i * (w - 2 * pad)) / (history.length - 1)), h - pad - ((v - lo) / span) * (h - 2 * pad)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return <svg className={s.steam} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
    aria-label={`Soup score over the last ${history.length} rounds: ${history.map(v => v.toFixed(1)).join(', ')}`}>
    <defs><linearGradient id="steam-line" x1="0" x2="1"><stop offset="0" stopColor="#ef8d5a" /><stop offset=".5" stopColor="#cfa2e4" /><stop offset="1" stopColor="#8ea6ff" /></linearGradient></defs>
    <path d={d} fill="none" stroke="url(#steam-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    <circle cx={lx} cy={ly} r="3.5" fill="#8ea6ff" />
  </svg>;
}

function Box({ view }: { view: TierView }) {
  const { tonight } = view;
  return <article className={s.box} aria-label={view.tier}>
    <Cell area="score" label="Soup score" jp="今夜のスープ">
      <p className={s.score}><span>{tonight.score.toFixed(1)}</span></p>
      <p className={s.change}>{view.change === null ? 'First round' : `${signed(view.change)} since the last round`}</p>
      <p className={s.meta}>Round {tonight.round} · {when(tonight.finished)}</p>
    </Cell>

    <Cell area="seats" label="Seats" jp="具" icon="chopsticks">
      <ul className={s.seats} aria-label="Seats">
        {view.seats.map((seat, i) => <li key={seat.body}>
          <i className={s.topping} style={{ background: SEATS[i % SEATS.length] }} aria-hidden="true" />
          <span className={s.seatName}>{seat.name}</span>
          <span className={s.seatMeta}>{KIND[seat.kind]}{seat.paid ? '' : ' · Unpaid'}</span>
          <span className={s.contribution} title="What the soup loses without this body, to 0.5 point">{signed(seat.contribution)}</span>
        </li>)}
      </ul>
    </Cell>

    <Cell area="crown" label="Crown" jp="会計" icon="ticket">
      <p className={s.small}>{view.crown ? <>Crown: <b>{view.crown.name}</b></> : <>Crown burned<span className={s.why}>No body beat every house model and the soup alone.</span></>}</p>
    </Cell>

    <Cell area="serve" label="Serving" jp="提供" icon="bowl">
      <p className={s.small}>Serving {view.serving.release} · by {view.serving.served_by === 'zils' ? 'Zils' : 'miners'}</p>
    </Cell>

    <Cell area="cats" label="Categories" jp="味" icon="spoon">
      <dl className={s.cats}>
        {(Object.keys(CATEGORY_NAMES) as (keyof typeof CATEGORY_NAMES)[]).map(c => <div key={c}>
          <dt>{CATEGORY_NAMES[c]}</dt>
          <dd><span className={s.track}><i style={{ width: `${tonight.categories[c]}%` }} /></span>{tonight.categories[c].toFixed(1)}</dd>
        </div>)}
      </dl>
    </Cell>

    <Cell area="hist" label="Recent rounds" jp="記録">
      <Steam history={view.history} />
    </Cell>
  </article>;
}

/** The latest soup per tier. Rounds grade a fresh exam slice each night, so small moves are partly noise. */
export function SoupBoardView({ views }: { views: TierView[] }) {
  const [tier, setTier] = useState(views[0].tier);
  const view = views.find(v => v.tier === tier) ?? views[0];
  return <div className={s.board}>
    <div className={s.chips} role="group" aria-label="Tier">
      {views.map(v => <button key={v.tier} type="button" aria-pressed={v.tier === view.tier} onClick={() => setTier(v.tier)}>{v.tier}</button>)}
    </div>
    <Box key={view.tier} view={view} />
    <p className={s.fine}>Each round grades a fresh slice of a private exam, so small moves between rounds are partly noise; release windows are the comparable checkpoints. Contributions are what the soup loses without a body, rounded to 0.5 point.</p>
  </div>;
}

/** Before any round is published: the same box, holding the soup figure and what will appear here. */
export function EmptyBoard({ art }: { art: ReactNode }) {
  return <div className={`${s.box} ${s.empty}`}>
    <Cell area="art" label="Tonight" jp="今夜">{art}</Cell>
    <Cell area="note" label="Seats" jp="具" icon="chopsticks">
      <p>Seats appear here after the first round. Each round’s public record lists the members, their rates and rounded contributions, so anyone can see who holds a seat and why.</p>
      <p>No soup feed is connected to this page yet.</p>
    </Cell>
  </div>;
}

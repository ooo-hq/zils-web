import Link from 'next/link';
import s from './miners.module.css';

// Proposed in skills/.private notes and zils/.private/plans/2026-10-19-feature-tracks.md (19 Oct 2026).
// Not deployed: the live validator pays base tier 0.7 and customer adapters 0.3.
const LANES = [
  {
    name: 'Base tier', share: '50%', status: 'Open on testnet', tone: 'open',
    lead: 'Improve the whole model; the winner becomes the base.',
    facts: [['To beat', 'd3-mini'], ['Pays', 'Last five kings'], ['Entry', 'Full model weights']],
    href: '#base-tier', cta: 'How to enter',
  },
  {
    name: 'Feature tracks', share: '20%', status: 'Planned', tone: 'planned',
    lead: 'Teach the base a new skill. Each skill is its own competition.',
    tracks: [{ name: 'Boxes', status: 'Planned', href: '/miners/tracks/box', note: 'bar 0.582 IoU' }, { name: 'Video', status: 'Later', note: 'not designed yet' }],
    facts: [['Entry', 'An adapter on the current base'], ['Pays', 'Last five kings per track']],
    href: '/miners/tracks/box', cta: 'See the box track',
  },
  {
    name: 'Customer adapters', share: '30%', status: 'Admission off for now', tone: 'closed',
    lead: 'Train the models customers keep.',
    facts: [['Scored on', 'Each job’s held-out test'], ['Opens to all', 'Once miner terms are live']],
    href: '#miners', cta: 'Leaderboard',
  },
] as const;

export function Competitions() {
  return <section aria-labelledby="competitions-heading" className={s.lanes}>
    <div className={s.lanesHead}>
      <h2 id="competitions-heading">Three ways to earn</h2>
      <p><span className={s.proposed}>Proposed split</span> Shares of miner emissions under the feature-tracks proposal. Today the validator pays the base tier 70% and customer adapters 30%. An empty lane’s share is burned, not handed to the others.</p>
    </div>
    <ol className={s.laneGrid}>
      {LANES.map(lane => <li key={lane.name} className={s.lane} data-tone={lane.tone}>
        <div className={s.laneTop}><h3>{lane.name}</h3><span className={s.share}>{lane.share}</span></div>
        <p className={s.laneStatus}>{lane.status}</p>
        <p className={s.laneLead}>{lane.lead}</p>
        {'tracks' in lane && <ul className={s.trackList}>{lane.tracks.map(track => <li key={track.name}>
          {'href' in track ? <Link href={track.href}>{track.name}</Link> : <span>{track.name}</span>}
          <span className={s.trackMeta}>{track.status} · {track.note}</span>
        </li>)}</ul>}
        <dl className={s.laneFacts}>{lane.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <Link className={s.laneLink} href={lane.href}>{lane.cta}</Link>
      </li>)}
    </ol>
    <p className={s.graduated}><span>Graduated into the base</span> None yet. A feature graduates when its king is merged into a base release; its exam then guards every later base.</p>
  </section>;
}

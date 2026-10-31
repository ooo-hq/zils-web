import Link from 'next/link';
import s from './miners.module.css';

// Base pool shares from zils/data/base-pools-launch.json (zils main 0974870). The split between base, features and
// customer adapters is each validator's configuration and is not stated here until the mainnet numbers are set.
const LANES = [
  {
    name: 'Base tier', share: '50%', status: 'Open', tone: 'open',
    lead: 'Improve the whole model. Every tier is a nightly greedy soup of up to five bodies.',
    facts: [['Pays', 'Soup seats and a crown'], ['Entry', 'A full model body']],
    href: '#base-tier', cta: 'How to enter',
  },
  {
    name: 'Feature tracks', share: '20%', status: 'Open', tone: 'open',
    lead: 'Teach the base a new skill. Each skill is its own competition.',
    tracks: [{ name: 'Boxes', status: 'Synthetic-only pilot', href: '/miners/tracks/box', note: 'mini / lite · no kings yet' }, { name: 'Video', status: 'Later', href: '/roadmap', note: 'vote on the roadmap' }],
    facts: [['Entry', 'An adapter on the exact parent'], ['Pays', 'Last five distinct kings per track']],
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
      <p><span className={s.proposed}>Allocation</span> The base tier splits lite 35%, mini 30%, flash 20% and z3 10%; the other 5% burns. Flash and z3 burn their shares until they open, then pay a boosted share for their first weeks. Empty shares burn.</p>
    </div>
    <ol className={s.laneGrid}>
      {LANES.map(lane => <li key={lane.name} className={s.lane} data-tone={lane.tone}>
        <div className={s.laneTop}><h3>{lane.name}</h3><span className={s.share}>{lane.share}</span></div>
        <p className={s.laneStatus}>{lane.status}</p>
        <p className={s.laneLead}>{lane.lead}</p>
        {'tracks' in lane && <ul className={s.trackList}>{lane.tracks.map(track => <li key={track.name}>
          <Link href={track.href}>{track.name}</Link>
          <span className={s.trackMeta}>{track.status} · {track.note}</span>
        </li>)}</ul>}
        <dl className={s.laneFacts}>{lane.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <Link className={s.laneLink} href={lane.href}>{lane.cta}</Link>
      </li>)}
    </ol>
    <p className={s.graduated}><span>Graduated into the base</span> None yet. A synthetic pilot crown is separate from graduation, which requires real-image qualification and the full base regression review.</p>
  </section>;
}

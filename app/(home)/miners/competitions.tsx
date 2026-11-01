import Link from 'next/link';
import s from './miners.module.css';

// Pool shares from zils/data/base-pools-launch.json: four soup pools at 25% each, no boosts. Each pool pays five
// fixed seats of 16% and a 20% crown (zils/soup_round.py), so a seat is 4% of emissions and a crown 5%.
const POOLS = [
  { name: 'z3-lite', size: '0.8B', status: 'Open', tone: 'open' },
  { name: 'z3-mini', size: '4.5B', status: 'Open', tone: 'open' },
  { name: 'z3-flash', size: '8.4B', status: 'Opens later', tone: 'closed' },
  { name: 'z3', size: '27B', status: 'Opens later', tone: 'closed' },
] as const;

export function Competitions() {
  return <section aria-labelledby="competitions-heading" className={s.lanes}>
    <div className={s.lanesHead}>
      <h2 id="competitions-heading">How miners earn</h2>
      <p>Four pools, 24 paid spots. Each pool has five seats worth 4% of emissions each and a crown worth 5%. A seat’s value never changes with how many others are seated. Whatever nobody earns burns, including the whole share of a pool that has not opened.</p>
    </div>
    <ol className={`${s.laneGrid} ${s.poolGrid}`} aria-label="Pools">
      {POOLS.map(pool => <li key={pool.name} className={s.lane} data-tone={pool.tone}>
        <div className={s.laneTop}><h3>{pool.name}</h3><span className={s.share}>25%</span></div>
        <p className={s.laneStatus}>{pool.status}</p>
        <dl className={s.laneFacts}>
          <div><dt>Seats</dt><dd>5 seats × 4%</dd></div>
          <div><dt>Crown</dt><dd>1 × 5%</dd></div>
          <div><dt>Model</dt><dd>{pool.size} body</dd></div>
        </dl>
      </li>)}
    </ol>
    <dl className={s.laneFacts}>
      <div><dt>Seat</dt><dd>Your body lifts the night’s soup by 0.3 points or more. Scout re-uploads of public models earn a quarter; house models are never paid.</dd></div>
      <div><dt>Crown</dt><dd>The best single body, if it beats every house model and the soup alone by 0.3 points.</dd></div>
    </dl>
    <p className={s.graduated}><span>Later</span> Feature tracks and customer adapters do not pay yet. The <Link href="/miners/tracks/box">box track</Link> runs as a synthetic-only pilot, and customer jobs stay with Zils workers until miner terms are live.</p>
  </section>;
}

import { SEATS } from '../soup/bowl';
import s from './soup-merge.module.css';

// The greedy soup as motion, after the homepage training figure: seat-coloured bodies reach the core and
// become one soup; grey bodies, which did not lift the score, stop short and fade. Up to 20 in the pool, 5 seats.
const POOL = 12;
const seatAt = new Map([0, 2, 5, 7, 10].map((slot, seat) => [slot, SEATS[seat]]));

export function SoupMerge() {
  return <div className={s.merge} role="img" aria-label="Many bodies become one soup: five that lift the score join, the rest are left out">
    {Array.from({ length: POOL }, (_, i) => {
      const seat = seatAt.get(i);
      return <i key={i} className={seat ? s.member : s.left} style={{ '--c': seat, '--a': `${(i / POOL) * 360}deg`, '--i': i } as React.CSSProperties} />;
    })}
    <div className={s.core} aria-hidden="true"><span>soup</span></div>
  </div>;
}

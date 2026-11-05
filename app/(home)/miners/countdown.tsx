'use client';

import { useEffect, useState } from 'react';
import { clockTime, roundProgress } from '@/lib/network-bodies';
import s from './board.module.css';

const R = 19, C = 2 * Math.PI * R;
const at = (iso: string) => `${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(iso))} (${iso.slice(11, 16)} UTC)`;

/** The current second, ticking; null on the server and before hydration, where any time would be stale. */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  return now;
}

/** A tier's round clock: the ring fills from the deadline that opened this round (`froze`) to the one that closes
 *  it (`freezes`), with the time left in the middle; `grading` adds that the round which just closed is being scored. */
export function RoundClock({ froze, freezes, grading }: { froze: string; freezes: string; grading: boolean }) {
  const now = useNow();
  const progress = now === null ? 0 : roundProgress(froze, freezes, now);
  return <div className={s.round}>
    <svg className={s.ring} viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r={R} />
      <circle cx="22" cy="22" r={R} data-fill strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
    </svg>
    <div>
      <p className={s.roundTime} role="timer" aria-label="Time until this round's commits close">{now === null ? '–:––:––' : clockTime(Date.parse(freezes) - now)}</p>
      <p className={s.roundLabel}>Round open · commits close at {at(freezes)}</p>
      {grading && <p className={s.grading}>Grading the round that closed at {at(froze)}</p>}
    </div>
  </div>;
}

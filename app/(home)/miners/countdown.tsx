'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { clockTime, roundProgress } from '@/lib/network-bodies';
import s from './board.module.css';

const local = (iso: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(iso));

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
 *  it (`freezes`), sweeping up on load, with the time left beside it; `grading` adds that the round which just
 *  closed is being scored. */
export function RoundClock({ froze, freezes, grading }: { froze: string; freezes: string; grading: boolean }) {
  const now = useNow();
  const round = now === null ? 0 : roundProgress(froze, freezes, now);
  return <div className={s.round}>
    <div className={s.dial} aria-hidden="true"><span className={s.ringTrack} /><span className={s.ring} style={{ '--round': round } as CSSProperties} /></div>
    <div>
      <p className={s.roundTime} role="timer" aria-label="Time until this round's commits close">{now === null ? '–:––:––' : clockTime(Date.parse(freezes) - now)}</p>
      <p className={s.roundLabel}>Commits close {local(freezes)} <span className={s.nowrap}>({freezes.slice(11, 16)} UTC)</span></p>
      {grading && <p className={s.grading}>Grading the {local(froze)} round</p>}
    </div>
  </div>;
}

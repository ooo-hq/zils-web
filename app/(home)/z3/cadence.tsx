'use client';

import { useState } from 'react';
import s from './z3.module.css';

// Every night is a soup round. A release window is one night every interval_days, which each validator sets
// between 14 and 28 (zils docs/base-election.md), so the next window falls on one of nights 14 to 28.
const NIGHTS = 28;
const EARLIEST = 14;

function describe(night: number) {
  return night < EARLIEST
    ? `Night ${night}: soup round. Validators grade the bodies committed before the deadline, rebuild the soup and pay its seats. The served model does not change.`
    : `Night ${night}: soup round, and the release window can fall on this night, depending on the interval the validator sets. At the window the soup must beat the current release on two sealed draws, hold its lead 12 hours later and keep customer adapters at least as good.`;
}

export function Cadence() {
  const [night, setNight] = useState<number | null>(null);

  return <figure className={s.cadence} aria-label="Release cadence">
    <div className={s.nights} onMouseLeave={() => setNight(null)}>
      {Array.from({ length: NIGHTS }, (_, i) => {
        const n = i + 1;
        const band = n >= EARLIEST;
        return <button key={n} type="button" className={s.night} data-window={band ? '' : undefined}
          style={band ? { '--k': n - EARLIEST, '--span': NIGHTS - EARLIEST + 1 } as React.CSSProperties : undefined}
          onMouseEnter={() => setNight(n)} onFocus={() => setNight(n)} onClick={() => setNight(n)}
          aria-label={`Night ${n}, ${band ? 'soup round; the release window can fall here' : 'soup round'}`} />;
      })}
    </div>
    <figcaption className={s.cadenceKey}>
      <span>{NIGHTS} nights, a soup round each</span>
      <span className={s.windowKey}>Next release window falls on one of nights {EARLIEST} to {NIGHTS}</span>
    </figcaption>
    <p className={s.readout} role="status" aria-live="polite" data-idle={night === null ? '' : undefined}>
      {night === null ? 'Point at a night to see what happens on it.' : describe(night)}
    </p>
  </figure>;
}

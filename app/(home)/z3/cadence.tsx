'use client';

import { useRef, useState } from 'react';
import s from './z3.module.css';

// Each validator sets interval_days between 14 and 28 (zils docs/base-election.md); a release window is one
// event every interval, after that night's soup round. Every night is a soup round.
const NIGHTS = 28;
const MIN_INTERVAL = 14;
const MAX_INTERVAL = 28;

function describe(night: number, window: boolean) {
  return window
    ? `Night ${night}: soup round, then a release window. The current soup must beat the current release on two sealed draws, hold its lead on a confirmation draw 12 hours later and keep customer adapters at least as good. A reviewed promotion then makes it the next z3-mini.`
    : `Night ${night}: soup round. Validators grade the bodies committed before the deadline, rebuild the soup and pay its seats. The served model does not change.`;
}

export function Cadence() {
  const [interval, setGap] = useState(MIN_INTERVAL);
  const [night, setNight] = useState(1);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const isWindow = (n: number) => n % interval === 0;

  function move(to: number) {
    const next = Math.min(NIGHTS, Math.max(1, to));
    setNight(next);
    buttons.current[next - 1]?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); move(night + step); }
    else if (e.key === 'Home') { e.preventDefault(); move(1); }
    else if (e.key === 'End') { e.preventDefault(); move(NIGHTS); }
  }

  const windows = Array.from({ length: NIGHTS }, (_, i) => i + 1).filter(isWindow);

  return <figure className={s.cadence} aria-label="Release cadence">
    <div className={s.nights} role="group" aria-label="Nights" onKeyDown={onKey}>
      {Array.from({ length: NIGHTS }, (_, i) => {
        const n = i + 1;
        const win = isWindow(n);
        return <button key={n} type="button" ref={el => { buttons.current[i] = el; }}
          className={s.night} data-window={win ? '' : undefined} aria-pressed={n === night}
          tabIndex={n === night ? 0 : -1} onClick={() => setNight(n)}
          aria-label={`Night ${n}, ${win ? 'soup round and release window' : 'soup round'}`} />;
      })}
    </div>
    <p className={s.readout} role="status" aria-live="polite">{describe(night, isWindow(night))}</p>
    <figcaption className={s.cadenceKey}>
      <label className={s.interval}>
        <span>Days between release windows</span>
        <input type="range" min={MIN_INTERVAL} max={MAX_INTERVAL} value={interval}
          onChange={e => setGap(Number(e.target.value))} aria-valuetext={`Every ${interval} days`} />
        <span className={s.intervalValue} aria-hidden="true">{interval}</span>
      </label>
      <span>{NIGHTS} nights, a soup round each · {windows.length === 1 ? 'one release window' : `${windows.length} release windows`}</span>
    </figcaption>
  </figure>;
}

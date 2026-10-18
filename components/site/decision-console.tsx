'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LANES, type Lane } from '@/lib/sorting-field';
import css from './decision-console.module.css';

export type Decision = { text: string; laneId: Lane['id']; confidence: number; unsureOf?: Lane['id'] };

const LINE_MS = 650;
const HOLD_MS = 1800;
const lane = (id: Lane['id']) => LANES.find((l) => l.id === id)!;
const label = (id: Lane['id']) => lane(id).label;

function lines(d: Decision): { text: string; node: ReactNode }[] {
  const conf = d.confidence.toFixed(2);
  const k = (s: string) => <span className={css.k}>{s}</span>;
  const ans = <span className={css.ans} style={{ '--lane': `var(${lane(d.laneId).cssVar})` } as React.CSSProperties}>{label(d.laneId)}</span>;
  return [
    { text: `> in ${d.text}`, node: <>{k('> in ')}<span>{d.text}</span></> },
    d.unsureOf
      ? { text: `> answer unsure: ${label(d.unsureOf)}?`, node: <>{k('> answer ')}<span className={css.warn}>unsure: {label(d.unsureOf)}?</span></> }
      : { text: `> answer ${label(d.laneId)}`, node: <>{k('> answer ')}{ans}</> },
    d.unsureOf
      ? { text: `> confidence ${conf} → ${label(d.laneId)}`, node: <>{k('> confidence ')}<span className={css.conf}>{conf}</span>{k(' → ')}{ans}</> }
      : { text: `> confidence ${conf}`, node: <>{k('> confidence ')}<span className={css.conf}>{conf}</span></> },
  ];
}

/** Types each decision over three lines, then holds; a newer decision replaces any queued one. */
export function DecisionConsole({ decision }: { decision: Decision | null }) {
  // n: lines shown (1..3 typing, 4 = done). seq remounts lines so each new one flashes.
  const [shown, setShown] = useState<{ d: Decision; n: number; seq: number } | null>(null);
  const pending = useRef<Decision | null>(null);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!decision) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown({ d: decision, n: 4, seq: ++seq.current });
      return;
    }
    pending.current = decision;
    if (busy.current) return;
    const next = () => {
      const d = pending.current;
      pending.current = null;
      busy.current = !!d;
      if (!d) return;
      const s = ++seq.current;
      setShown({ d, n: 1, seq: s });
      timers.current = [2, 3, 4].map((n) => window.setTimeout(() => setShown({ d, n, seq: s }), (n - 1) * LINE_MS));
      timers.current.push(window.setTimeout(next, 3 * LINE_MS + HOLD_MS));
    };
    next();
  }, [decision]);

  const all = shown ? lines(shown.d) : [];
  const visible = shown ? all.slice(0, Math.min(shown.n, 3)) : [];
  const done = !shown || shown.n === 4;
  const cursor = <span className={css.cursor} />;

  return (
    <div className={css.con} data-console>
      <div className={css.bar}>
        <span className={css.title}>ZILS · SYSTEM 01 · SUPPORT-ROUTER</span>
        <span className={css.pill}>LIVE DEMO</span>
      </div>
      <div className={css.body} role="log" aria-live="polite">
        <div aria-hidden="true">
          {visible.map((l, i) => (
            <div key={`${shown!.seq}-${i}`} className={css.line} data-console-line>
              {l.node}{!done && i === visible.length - 1 && cursor}
            </div>
          ))}
          {done && <div className={css.prompt}><span className={css.k}>&gt; </span>{cursor}</div>}
        </div>
        {/* Screen readers get only the finished decision, never the typing. */}
        <p className={css.sr}>{shown && shown.n === 4 ? all.map((l) => l.text).join('\n') : ''}</p>
      </div>
    </div>
  );
}

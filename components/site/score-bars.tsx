'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CountUp } from './count-up';
import css from './score-bars.module.css';

type Row = { label: ReactNode; value: number; max: number; display: string; kind: 'zils' | 'jev' | 'base'; note?: string };

/** `countUp` swaps the display for a CountUp of value (1 decimal, %) that starts when the bars come into view. */
export function ScoreBars({ rows, animate = true, countUp = false }: { rows: Row[]; animate?: boolean; countUp?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !animate) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [animate]);
  return (
    <div ref={ref} className={`${css.bars} ${animate ? css.anim : ''} ${seen ? css.in : ''}`}>
      {rows.map((r, i) => (
        <div key={i}>
          <div className={css.top}>
            <span className={css.name}>{r.label}{r.note && <small>{r.note}</small>}</span>
            <span className={css.v}>{countUp ? <CountUp value={r.value} decimals={1} suffix="%" start={seen} /> : r.display}</span>
          </div>
          <div className={css.track}>
            <span data-fill className={`${css.fill} ${css[r.kind]}`}
              style={{ width: `${Math.max(0, Math.min(100, (r.value / r.max) * 100))}%`, '--bar-delay': `${i * 0.15}s` } as React.CSSProperties} />
          </div>
        </div>
      ))}
    </div>
  );
}

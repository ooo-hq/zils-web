'use client';
import { useEffect, useRef } from 'react';
import css from './outcome-grid.module.css';

type Group = { label: string; count: number; color: string };

/** One cell per case, grouped in order. 50 columns on desktop, 25 on phones unless `columns` is given. Paints in on reveal; final state without JS or with reduced motion. */
export function OutcomeGrid({ groups, columns }: { groups: Group[]; columns?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      el.setAttribute('data-in', '');
      return;
    }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.setAttribute('data-in', ''); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  let i = 0;
  return (
    <div ref={ref} data-outcome-grid className={css.g} data-fixed={columns ? '' : undefined} style={{ '--og-cols': columns ?? 50 } as React.CSSProperties}>
      {groups.flatMap(g => Array.from({ length: g.count }, () => {
        const n = i++;
        return <span key={n} data-outcome={g.label} className={css.c} style={{ background: g.color, '--og-i': n } as React.CSSProperties} />;
      }))}
    </div>
  );
}

'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import css from './reveal.module.css';

/** Sets data-in once 25% visible. Reduced motion has no hidden state (see CSS) and gets data-in at once. */
export function Reveal({ children, delay = 0, as: Tag = 'div' }: { children: ReactNode; delay?: number; as?: 'div' | 'section' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      el.setAttribute('data-in', '');
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.setAttribute('data-in', ''); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} data-reveal className={css.r} style={{ '--reveal-delay': `${delay}s` } as React.CSSProperties}>
      {children}
    </Tag>
  );
}

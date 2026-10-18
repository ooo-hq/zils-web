'use client';
import { useEffect, useState } from 'react';

/** Renders the final value on the server and without JS. After mount, and only when motion is allowed, it shows 0 until `start`, then counts up. */
export function CountUp({ value, decimals = 0, suffix = '', start, durationMs = 1200 }: {
  value: number; decimals?: number; suffix?: string; start: boolean; durationMs?: number;
}) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    if (!start) {
      raf = requestAnimationFrame(() => setShown(0));
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      setShown(value * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, value, durationMs]);
  const fmt = (n: number) => `${n.toFixed(decimals)}${suffix}`;
  return <span aria-label={fmt(value)} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(shown)}</span>;
}

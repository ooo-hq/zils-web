'use client';
import { useEffect, useState } from 'react';

export function CountUp({ value, decimals = 0, suffix = '', start, durationMs = 1200 }: {
  value: number; decimals?: number; suffix?: string; start: boolean; durationMs?: number;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!start) return;
    // Reduced motion: a zero-length run lands on the final value in the first frame.
    const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : durationMs;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = ms === 0 ? 1 : Math.min(1, (now - t0) / ms);
      setShown(value * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, value, durationMs]);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{shown.toFixed(decimals)}{suffix}</span>;
}

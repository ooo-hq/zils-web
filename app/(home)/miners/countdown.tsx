'use client';

import { useEffect, useState } from 'react';
import { countdown } from '@/lib/network-bodies';

/** ` in 5h 12m 03s`, ticking each second. Renders nothing on the server, where the time would be stale by hydration. */
export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  if (now === null) return null;
  return <> in <b style={{ fontVariantNumeric: 'tabular-nums' }}>{countdown(Date.parse(to) - now)}</b></>;
}

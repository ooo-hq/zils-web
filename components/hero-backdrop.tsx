'use client';

import { useEffect, useRef } from 'react';
import s from './hero-backdrop.module.css';
import texture from './light.module.css';

type HeroVariant = 'home' | 'research' | 'bittensor' | 'pricing';

/** Decorative instrument-inspired artwork; no data or model results are depicted. */
export function HeroBackdrop({ variant }: { variant: HeroVariant }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !(variant === 'home' || variant === 'pricing') || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer: fine)').matches) return;
    let frame = 0;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    let tick: (now: number) => void;
    let move: (event: PointerEvent) => void;
    let leave = () => {};
    if (variant === 'home') {
      // The horizon follows the pointer with the lag of a phosphor trace; with no
      // pointer it drifts on its own. Only CSS variables change here; the CSS
      // decides how the light, rings and halo answer them.
      let target = { x: .5, y: .4 }, idle = true, since = performance.now();
      const pos = { ...target };
      tick = now => {
        if (idle) { const t = (now - since) / 1000; target = { x: .5 + Math.sin(t / 9) * .16, y: .4 + Math.sin(t / 13) * .08 }; }
        pos.x += (target.x - pos.x) * .055; pos.y += (target.y - pos.y) * .055;
        el.style.setProperty('--px', (pos.x * 2 - 1).toFixed(4)); el.style.setProperty('--py', (pos.y * 2 - 1).toFixed(4));
        el.style.setProperty('--hx', `${(pos.x * 100).toFixed(2)}%`); el.style.setProperty('--hy', `${(pos.y * 100).toFixed(2)}%`);
        frame = requestAnimationFrame(tick);
      };
      move = event => { const r = el.getBoundingClientRect(); idle = false; target = { x: clamp((event.clientX - r.left) / r.width), y: clamp((event.clientY - r.top) / r.height) }; };
      leave = () => { idle = true; since = performance.now(); };
    } else {
      // A meter that answers effort with a shrug: fast pointer movement flicks the
      // needle, which then settles back near zero. Usage is cheap; that is the joke.
      let energy = 0, last: { x: number; y: number; t: number } | null = null, angle = 0;
      tick = now => {
        energy *= .9;
        const rest = 1.5 + Math.sin(now / 900) * .6;
        angle += (Math.min(26, rest + energy) - angle) * .18;
        el.style.setProperty('--needle', `${angle.toFixed(2)}deg`);
        frame = requestAnimationFrame(tick);
      };
      move = event => {
        const point = { x: event.clientX, y: event.clientY, t: event.timeStamp };
        if (last) { const dt = Math.max(8, point.t - last.t); energy += Math.hypot(point.x - last.x, point.y - last.y) / dt * 1.6; }
        last = point;
      };
    }
    // ponytail: the loop runs while the page is visible; pause via IntersectionObserver if the hero's CPU cost ever matters.
    const visibility = () => { cancelAnimationFrame(frame); if (!document.hidden) frame = requestAnimationFrame(tick); };
    addEventListener('pointermove', move); document.documentElement.addEventListener('pointerleave', leave); document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave); document.removeEventListener('visibilitychange', visibility); };
  }, [variant]);
  return (
    <div ref={ref} aria-hidden="true" className={`${s.backdrop} ${s[variant]}`}>
      <div className={s.light} />
      {variant === 'home' && <div className={s.halo} />}
      <svg className={s.drawing} viewBox="0 0 1440 800" fill="none" focusable="false">
        {variant === 'home' && (
          <g>
            {Array.from({ length: 11 }, (_, i) => (
              <ellipse key={i} cx="720" cy="750" rx={520 + i * 49} ry={178 + i * 26} style={{ '--d': i } as React.CSSProperties} />
            ))}
          </g>
        )}
        {variant === 'research' && (
          <g>
            {Array.from({ length: 18 }, (_, i) => (
              <path key={i} d={`M 540 ${590 + i * 12} C 710 ${590 + i * 12}, 685 ${180 + i * 14}, 890 ${180 + i * 14} S 1090 ${550 + i * 6}, 1260 ${340 + i * 12} S 1450 ${170 + i * 13}, 1540 ${245 + i * 13}`} />
            ))}
          </g>
        )}
        {variant === 'pricing' && (
          <g className={s.meter}>
            {Array.from({ length: 6 }, (_, i) => { const r = 150 + i * 36; return <path key={i} d={`M ${1150 - r} 430 A ${r} ${r} 0 0 1 ${1150 + r} 430`} />; })}
            {Array.from({ length: 25 }, (_, i) => {
              const a = Math.PI + (i / 24) * Math.PI, long = i % 6 === 0, r0 = 330, r1 = long ? 356 : 344;
              return <path key={i} d={`M ${(1150 + Math.cos(a) * r0).toFixed(1)} ${(430 + Math.sin(a) * r0).toFixed(1)} L ${(1150 + Math.cos(a) * r1).toFixed(1)} ${(430 + Math.sin(a) * r1).toFixed(1)}`} />;
            })}
            <path d="M 1150 430 L 836 430" className={s.needle} />
            <circle cx="1150" cy="430" r="9" className={s.signal} />
          </g>
        )}
        {variant === 'bittensor' && (
          <g>
            {[[985, 215], [1260, 415], [925, 635]].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                {Array.from({ length: 8 }, (_, i) => (
                  <circle key={i} cx={x} cy={y} r={28 + i * 30} />
                ))}
                <path d={`M ${x - 7} ${y} h 14 M ${x} ${y - 7} v 14`} className={s.signal} />
              </g>
            ))}
          </g>
        )}
      </svg>
      <div className={`${s.grain} ${texture.grain}`} />
      <div className={s.scanlines} />
    </div>
  );
}

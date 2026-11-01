import type { MergeMethod } from '@/lib/model-merge';
import s from './merge.module.css';

// A bowl of ramen seen from above, in a 400 × 400 box around (200, 200). Each model in the mix is one topping,
// ringed in its colour and sized by its share; the broth, noodles and garnish are the same for every mix.
const C = 200;

/** Where each place's topping sits, and what it is. */
const SLOTS = [
  { x: 128, y: 158, kind: 'egg' },
  { x: 236, y: 104, kind: 'chashu' },
  { x: 300, y: 172, kind: 'nori' },
  { x: 122, y: 284, kind: 'naruto' },
  { x: 266, y: 298, kind: 'greens' },
] as const;

const SCALLIONS = [[180, 150], [205, 196], [160, 214], [290, 196], [248, 152], [214, 262], [168, 104], [312, 240], [190, 300], [92, 214], [262, 222], [226, 184]];
const DROPS = [[118, 300, 9], [292, 316, 7], [332, 160, 6], [84, 270, 5], [170, 330, 6], [238, 330, 4], [326, 296, 4], [104, 158, 5], [178, 80, 4], [300, 98, 5]];

/** A noodle: a wavy strand from (x1, y1) to (x2, y2). */
function strand(x1: number, y1: number, x2: number, y2: number, waves: number, depth: number, phase: number) {
  const steps = 40, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  return Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps, w = depth * Math.sin(t * waves * 2 * Math.PI + phase);
    return `${k ? 'L' : 'M'}${(x1 + dx * t + nx * w).toFixed(1)} ${(y1 + dy * t + ny * w + 14 * Math.sin(t * Math.PI)).toFixed(1)}`;
  }).join(' ');
}
// The noodles lie in a bundle running up across the bowl, as if just lifted and dropped back.
const NOODLES = Array.from({ length: 14 }, (_, i) => strand(
  112 + i * 4 + (i % 3) * 5, 246 + i * 6.5, 334 - (i % 4) * 6, 168 + i * 7, 4 + (i % 3), 4 + (i % 2) * 2, i * 1.3,
));

function Topping({ kind }: { kind: (typeof SLOTS)[number]['kind'] }) {
  switch (kind) {
    case 'egg': return <g>
      <ellipse rx="30" ry="24" fill="#f7f0e1" stroke="#c98a4a" strokeWidth="3" />
      <ellipse cx="2" cy="1" rx="15" ry="13" fill="#ef9221" />
      <ellipse cx="0" cy="-1" rx="8" ry="7" fill="#f8b847" />
    </g>;
    case 'chashu': return <g>
      <circle cx="-6" cy="4" r="26" fill="#8f4b2a" />
      <circle cx="-6" cy="4" r="21" fill="#d9a07a" />
      <circle cx="6" cy="-4" r="26" fill="#9a522e" />
      <circle cx="6" cy="-4" r="21" fill="#e4b089" />
      <path d="M-6 -4 c6 -8 18 -4 16 5 c-2 8 -14 9 -18 2 c-3 -5 3 -10 8 -7" fill="none" stroke="#f6dcc4" strokeWidth="3" strokeLinecap="round" />
    </g>;
    case 'nori': return <g transform="rotate(-14)">
      <rect x="-18" y="-30" width="36" height="60" rx="2" fill="#1c2a21" stroke="#34503d" strokeWidth="1.5" />
      <path d="M-18 -10 H18 M-18 10 H18" stroke="#2c4234" strokeWidth="1" />
    </g>;
    case 'naruto': return <g>
      <path d="M0 -24 l5 3 5 -1 2 5 5 3 -1 5 3 5 -3 4 1 5 -5 3 -2 5 -5 -1 -5 3 -5 -3 -5 1 -2 -5 -5 -3 1 -5 -3 -4 3 -5 -1 -5 5 -3 2 -5 5 1 z" fill="#fbf6ef" />
      <path d="M0 0 c0 -4 6 -4 6 0 c0 7 -12 7 -12 0 c0 -10 17 -10 17 0 c0 12 -22 13 -22 0" fill="none" stroke="#e5508a" strokeWidth="3" strokeLinecap="round" />
    </g>;
    case 'greens': return <g>
      <path d="M-26 6 C-24 -18 4 -28 22 -14 C30 -6 22 10 4 14 C-10 17 -22 14 -26 6 Z" fill="#4f8f3f" />
      <path d="M-24 6 C-8 2 8 -4 22 -12" fill="none" stroke="#d6eab0" strokeWidth="4" strokeLinecap="round" />
    </g>;
  }
}

export function SoupBowl({ shares, method }: { shares: number[]; method: MergeMethod }) {
  return <svg className={s.bowl} viewBox="0 -60 400 460" aria-hidden="true">
    <defs>
      <radialGradient id="soup-broth" cx=".46" cy=".42" r=".62">
        <stop offset="0" stopColor="#f3c983" /><stop offset=".55" stopColor="#dc9a50" /><stop offset="1" stopColor="#a65a27" />
      </radialGradient>
      <radialGradient id="soup-shade">
        <stop offset=".78" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".38" />
      </radialGradient>
      <clipPath id="soup-clip"><circle cx={C} cy={C} r="146" /></clipPath>
    </defs>

    {[0, 1, 2].map(n => <path key={n} data-steam="" className={s.steam} style={{ '--n': n } as React.CSSProperties}
      d={`M${158 + n * 42} 18 C${140 + n * 42} -2 ${178 + n * 42} -16 ${160 + n * 42} -36 S${172 + n * 42} -54 ${162 + n * 42} -60`} />)}

    {/* The bowl: a dark glazed rim with a patterned band, lit along its edge. */}
    <circle cx={C} cy={C} r="178" className={s.rim} />
    <circle cx={C} cy={C} r="164" className={s.band} />
    <circle cx={C} cy={C} r="150" className={s.lip} />

    <g clipPath="url(#soup-clip)">
      <circle cx={C} cy={C} r="146" fill="url(#soup-broth)" />
      <g className={s.oil} data-method={method}>
        {DROPS.map(([x, y, r]) => <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={r} ry={r * .8} />)}
      </g>
      <g className={s.noodles} data-method={method}>
        {NOODLES.map(d => <path key={d} d={d} className={s.noodleShade} />)}
        {NOODLES.map(d => <path key={`${d}-top`} d={d} className={s.noodle} />)}
      </g>
      {shares.map((share, i) => {
        const slot = SLOTS[i], scale = .8 + share * .8;
        return <g key={i} data-topping="" className={s.topping} style={{ '--c': `var(--m${i + 1})` } as React.CSSProperties}
          transform={`translate(${slot.x} ${slot.y}) scale(${scale.toFixed(3)})`}>
          <circle r="38" className={s.toppingRing} />
          <Topping kind={slot.kind} />
        </g>;
      })}
      <g className={s.scallions}>{SCALLIONS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" />)}</g>
      <circle cx={C} cy={C} r="146" fill="url(#soup-shade)" />
    </g>
  </svg>;
}

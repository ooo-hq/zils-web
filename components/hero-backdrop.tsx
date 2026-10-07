import s from './hero-backdrop.module.css';
import texture from './light.module.css';

type HeroVariant = 'home' | 'research' | 'bittensor';

/** Decorative instrument-inspired artwork; no data or model results are depicted. */
export function HeroBackdrop({ variant }: { variant: HeroVariant }) {
  return (
    <div aria-hidden="true" className={`${s.backdrop} ${s[variant]}`}>
      <div className={s.light} />
      <svg className={s.drawing} viewBox="0 0 1440 800" fill="none" focusable="false">
        {variant === 'home' && (
          <g>
            {Array.from({ length: 11 }, (_, i) => (
              <ellipse key={i} cx="720" cy="750" rx={520 + i * 49} ry={178 + i * 26} />
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

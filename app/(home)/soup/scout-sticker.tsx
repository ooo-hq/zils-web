import s from './soup.module.css';

/** A round seal at the top-left of the house rules: scouts are welcome. Decorative, but named for readers who cannot see it. */
export function ScoutSticker() {
  return (
    <svg className={s.sticker} viewBox="0 0 120 120" role="img" aria-label="New: scouts welcome" focusable="false">
      <defs>
        <path id="scout-rim" d="M60 60m-42 0a42 42 0 1 1 84 0a42 42 0 1 1-84 0" />
      </defs>
      <circle cx="60" cy="60" r="56" className={s.stickerFace} />
      <circle cx="60" cy="60" r="56" className={s.stickerEdge} />
      <circle cx="60" cy="60" r="31" className={s.stickerInner} />
      <text className={s.stickerText}>
        <textPath href="#scout-rim" startOffset="0">SCOUTS WELCOME · 新規歓迎 · FIRST WINS ·</textPath>
      </text>
      {/* nigiri: a rice bed, a slice of fish leaning over it, a nori band */}
      <g className={s.stickerIcon} transform="translate(60 62)">
        <path className={s.stickerRice} d="M-18 1c0 7 8 11 18 11s18-4 18-11c0-4-3-6-7-6h-22c-4 0-7 2-7 6Z" />
        <path className={s.stickerFish} d="M-22-5c3-7 12-11 22-11s19 4 22 11c-6 3-13 5-22 5s-16-2-22-5Z" />
        <path d="M-7-12c1.5 2 1.5 4 0 7M1-13c1.5 2 1.5 4 0 7M9-12c1.5 2 1.5 4 0 6" />
        <path d="M-5-15v26M5-15v26" />
      </g>
    </svg>
  );
}

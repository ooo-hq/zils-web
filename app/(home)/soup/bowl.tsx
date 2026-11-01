import s from './soup.module.css';

// One spectrum stop per seat, warm to cool, as on the z3 lineup.
export const SEATS = ['#ef8d5a', '#d9a08c', '#cfa2e4', '#a9b5f2', '#8ea6ff'] as const;

/**
 * A line-drawn ramen bowl. Its five toppings are the five seats a soup can hold, one spectrum colour each.
 * With `seats`, only that many toppings are filled (seat 1 = SEATS[0], as in the seat list); the rest are ghosts.
 */
export function Bowl({ seats, className }: { seats?: number; className?: string } = {}) {
  const on = (seat: number) => (seats === undefined || seat < seats ? 1 : 0.14);
  const title = seats === undefined
    ? 'A bowl of soup with five toppings, one for each seat, and chopsticks lifting noodles'
    : `A bowl of soup with ${seats} of 5 seats filled, one topping per seat`;
  return <svg className={className ?? s.bowl} viewBox="0 0 480 400" role="img" aria-labelledby="bowl-title">
    <title id="bowl-title">{title}</title>
    <defs>
      <linearGradient id="bowl-spectrum" x1="0" x2="1">
        <stop offset="0" stopColor="#ef8d5a" /><stop offset=".18" stopColor="#d9a08c" /><stop offset=".42" stopColor="#cfa2e4" />
        <stop offset=".64" stopColor="#c3b4f6" /><stop offset=".82" stopColor="#a9b5f2" /><stop offset="1" stopColor="#8ea6ff" />
      </linearGradient>
      <clipPath id="bowl-clip"><path d="M60 196 C64 292 150 340 240 340 C330 340 416 292 420 196 Z" /></clipPath>
    </defs>

    <g className={s.steam}>
      <path d="M176 128 C162 110 190 98 176 78 C166 64 180 52 174 40" />
      <path d="M232 112 C218 94 246 82 232 62 C222 48 236 36 230 24" />
    </g>

    {/* body, spectrum band, foot */}
    <path className={s.body} d="M60 196 C64 292 150 340 240 340 C330 340 416 292 420 196 Z" />
    <rect x="40" y="258" width="400" height="8" fill="url(#bowl-spectrum)" clipPath="url(#bowl-clip)" />
    <path className={s.stroke} fill="none" d="M196 338 L202 358 L278 358 L284 338" />
    <path className={s.stroke} fill="none" d="M150 372 L330 372" opacity=".35" />

    {/* rim and broth */}
    <ellipse cx="240" cy="196" rx="180" ry="42" className={s.rim} />
    <ellipse cx="240" cy="199" rx="160" ry="31" className={s.broth} />
    <path className={s.noodle} d="M118 200 C138 190 158 210 178 200 S218 190 238 202 S278 214 298 200 S338 192 358 202" />
    <path className={s.noodle} d="M132 212 C152 202 172 220 192 210 S232 202 252 214 S292 222 312 212" />

    {/* five seats */}
    <path fill={SEATS[4]} opacity={on(4)} d="M134 196 L120 116 L174 110 L184 192 Z" />
    <g opacity={on(2)}>
      <ellipse cx="216" cy="190" rx="25" ry="14" fill={SEATS[2]} />
      <path className={s.swirl} d="M216 190 c0-4 6-4 6 0 c0 7-14 7-14 0 c0-10 22-10 22 0" />
    </g>
    <g opacity={on(1)}>
      <ellipse cx="270" cy="200" rx="27" ry="13" fill={SEATS[1]} />
      <ellipse cx="270" cy="200" rx="15" ry="6" className={s.ring} />
    </g>
    <g opacity={on(0)}>
      <ellipse cx="322" cy="186" rx="28" ry="18" className={s.egg} />
      <ellipse cx="324" cy="186" rx="15" ry="10" fill={SEATS[0]} />
    </g>
    <g fill={SEATS[3]} opacity={on(3)}>
      <circle cx="160" cy="212" r="5" /><circle cx="178" cy="218" r="5" /><circle cx="244" cy="216" r="5" /><circle cx="300" cy="216" r="5" /><circle cx="350" cy="208" r="5" />
    </g>

    {/* chopsticks lifting noodles */}
    <path className={s.chop} d="M452 84 L300 132" />
    <path className={s.chop} d="M456 100 L304 144" />
    <path className={s.lift} d="M306 138 C300 160 314 180 304 204 M314 140 C310 164 322 184 314 206 M322 142 C320 166 330 184 324 204" />
  </svg>;
}

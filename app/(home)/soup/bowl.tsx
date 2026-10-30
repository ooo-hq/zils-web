import s from './soup.module.css';

/** The soup mascot: a rubber-hose ramen bowl. Its five toppings are the five seats a soup can hold. Colours come from soup.module.css tokens. */
export function Bowl() {
  return <svg className={s.bowl} viewBox="0 0 480 440" role="img" aria-labelledby="bowl-title">
    <title id="bowl-title">A cartoon bowl of soup with five toppings, lifting noodles with chopsticks and giving a thumbs up</title>
    <defs>
      <clipPath id="bowl-body"><path d="M68 214 C70 312 150 360 240 360 C330 360 410 312 412 214 Z" /></clipPath>
      <pattern id="bowl-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.4" className={s.inkFill} /></pattern>
    </defs>

    <ellipse cx="240" cy="418" rx="160" ry="11" className={s.inkFill} />

    {/* legs and shoes */}
    <g className={s.limb}>
      <path d="M206 352 C200 372 190 386 176 398" />
      <path d="M274 352 C284 370 296 384 314 394" />
    </g>
    <g className={s.line}>
      <path className={s.creamFill} d="M146 402 C142 386 160 380 178 386 C196 392 204 404 196 412 L150 412 C146 410 146 406 146 402 Z" />
      <path className={s.inkFill} d="M150 402 L198 404 L196 412 L150 412 Z" />
      <path className={s.creamFill} d="M300 392 C306 378 326 378 340 388 C352 396 352 408 342 410 L300 408 C296 404 297 398 300 392 Z" />
      <path className={s.inkFill} d="M298 400 L346 404 L342 410 L300 408 Z" />
    </g>

    {/* steam */}
    <g className={s.steam}>
      <path d="M180 120 C164 100 196 88 180 66 C168 50 184 38 178 26" />
      <path d="M244 104 C228 84 260 72 244 50 C232 34 248 22 242 10" />
      <path d="M306 120 C290 100 322 88 306 66" />
    </g>

    {/* left arm, thumbs up */}
    <path className={s.limb} d="M76 246 C52 250 40 230 46 196" />
    <g className={s.line}>
      <path className={s.creamFill} d="M28 196 C24 178 34 170 44 172 L46 150 C46 138 62 138 62 152 L62 172 C76 172 80 182 76 192 C80 200 76 210 68 212 L40 214 C30 212 28 204 28 196 Z" />
      <path fill="none" d="M44 186 L72 186 M44 199 L72 199" />
    </g>

    {/* bowl body with a raimon band */}
    <path className={`${s.line} ${s.creamFill}`} d="M68 214 C70 312 150 360 240 360 C330 360 410 312 412 214 Z" />
    <g clipPath="url(#bowl-body)">
      <rect x="60" y="256" width="360" height="22" className={s.redFill} />
      <path className={s.bandMark} transform="translate(0 33)" d="M70 234 h12 v-6 h-6 v12 h18 v-12 h-6 v6 M110 234 h12 v-6 h-6 v12 h18 v-12 h-6 v6 M150 234 h12 v-6 h-6 v12 h18 v-12 h-6 v6 M190 234 h12 v-6 h-6 v12 h18 v-12 h-6 v6 M230 234 h12 v-6 h-6 v12 h18 v-12 h-6 v6 M270 234 h12 v-6 h-6 v12 h18 v-12 h-6 v6 M310 234 h12 v-6 h-6 v12 h18 v-12 h-6 v6 M350 234 h12 v-6 h-6 v12 h18 v-12 h-6 v6 M390 234 h12 v-6 h-6 v12 h18 v-12 h-6 v6" />
      <path d="M330 250 C350 290 340 330 300 356 L420 356 L420 250 Z" fill="url(#bowl-dots)" opacity=".55" />
    </g>
    <path className={s.line} fill="none" d="M68 214 C70 312 150 360 240 360 C330 360 410 312 412 214" />
    <path className={`${s.line} ${s.creamFill}`} d="M196 356 L200 372 L280 372 L284 356" />

    {/* face */}
    <g transform="translate(0 20)">
      <ellipse cx="204" cy="282" rx="15" ry="21" className={s.inkFill} />
      <ellipse cx="276" cy="282" rx="15" ry="21" className={s.inkFill} />
      <path className={s.creamFill} d="M198 270 a6 8 0 1 1 0.1 0 Z M270 270 a6 8 0 1 1 0.1 0 Z" />
      <ellipse cx="172" cy="306" rx="13" ry="7" className={s.salmonFill} />
      <ellipse cx="308" cy="306" rx="13" ry="7" className={s.salmonFill} />
      <path className={`${s.line} ${s.inkFill}`} d="M214 308 C226 330 254 330 266 308 Z" />
      <path className={s.redFill} d="M228 320 C234 312 246 312 252 320 C246 326 234 326 228 320 Z" />
      <path className={s.thin} d="M186 254 C192 248 200 248 206 252 M274 252 C280 248 288 248 294 254" />
    </g>

    {/* rim and broth */}
    <ellipse cx="240" cy="214" rx="172" ry="40" className={`${s.line} ${s.creamFill}`} />
    <ellipse cx="240" cy="217" rx="152" ry="29" className={s.brothFill} />
    <path className={s.noodle} d="M120 214 C140 204 160 224 180 214 S220 204 240 216 S280 228 300 214 S340 206 360 216" />
    <path className={s.noodle} d="M134 226 C154 216 174 234 194 224 S234 216 254 228 S294 236 314 226 S344 220 352 226" />

    {/* the five seats */}
    <g className={s.line}>
      {/* nori */}
      <path className={s.noriFill} d="M136 210 L120 128 L178 120 L190 206 Z" />
      {/* naruto */}
      <ellipse cx="214" cy="206" rx="26" ry="15" className={s.creamFill} />
      {/* egg */}
      <ellipse cx="318" cy="200" rx="30" ry="20" className={s.creamFill} />
      <ellipse cx="320" cy="200" rx="16" ry="11" className={s.yolkFill} stroke="none" />
      {/* chashu */}
      <ellipse cx="268" cy="214" rx="28" ry="14" className={s.porkFill} />
      <ellipse cx="268" cy="214" rx="16" ry="7" fill="none" className={s.thin} />
    </g>
    <path className={s.swirl} d="M214 206 c0-4 6-4 6 0 c0 7-14 7-14 0 c0-10 22-10 22 0" />
    {/* scallion rings */}
    <g className={s.scallion}>
      <ellipse cx="160" cy="226" rx="6" ry="4" /><ellipse cx="176" cy="232" rx="6" ry="4" /><ellipse cx="300" cy="230" rx="6" ry="4" />
      <ellipse cx="348" cy="222" rx="6" ry="4" /><ellipse cx="240" cy="232" rx="6" ry="4" />
    </g>

    {/* right arm with chopsticks lifting noodles */}
    <path className={s.limb} d="M406 244 C436 240 446 214 432 176" />
    <g className={s.line}>
      <path className={s.chopstick} d="M452 150 L300 94" />
      <path className={s.chopstick} d="M456 164 L304 110" />
    </g>
    <path className={s.lift} d="M308 100 C302 130 316 160 306 196 M316 104 C312 134 326 164 318 194 M324 108 C322 136 334 162 328 192" />
    <path className={`${s.line} ${s.creamFill}`} d="M420 176 C412 160 422 146 438 146 L456 148 C468 150 470 164 460 170 C470 176 466 188 454 188 L432 190 C424 188 420 184 420 176 Z" />

    {/* wiggle marks */}
    <g className={s.thin}>
      <path d="M48 252 C40 262 40 274 46 284" /><path d="M432 258 C442 268 442 280 436 290" />
      <path d="M120 386 C112 380 104 380 98 384" /><path d="M370 384 C378 378 386 378 392 382" />
    </g>
  </svg>;
}

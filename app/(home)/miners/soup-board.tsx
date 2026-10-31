import { SEATS } from '../soup/bowl';
import { FoodIcon } from '../soup/food-icons';
import { CATEGORY_WEIGHTS, tierView, type SoupBoard, type TierView } from '@/lib/soup-board';
import s from './soup-board.module.css';

// One bowl per tier, after /soup: seats are toppings in the seat colours, Japanese labels mark each part.
const CATEGORY_NAMES = { reasoning: 'Reasoning', language: 'Language', retrieval: 'Retrieval', tools: 'Tools', arts: 'Arts' } as const;
const KIND = { house: 'House', trainer: 'Trainer 1×', scout: 'Scout 0.25×' } as const;

const signed = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}`;
const when = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(iso));

function Jp({ children }: { children: string }) {
  return <span lang="ja" aria-hidden="true" className={s.jp}>{children}</span>;
}

/** Soup score by round as a rising line of steam: oldest left, tonight's bowl at the right. */
function Steam({ history }: { history: number[] }) {
  const w = 220, h = 48, pad = 4;
  const lo = Math.min(...history), hi = Math.max(...history), span = hi - lo || 1;
  const pts = history.map((v, i) => [pad + (history.length === 1 ? (w - 2 * pad) : (i * (w - 2 * pad)) / (history.length - 1)), h - pad - ((v - lo) / span) * (h - 2 * pad)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return <svg className={s.steam} viewBox={`0 0 ${w} ${h}`} role="img"
    aria-label={`Soup score over the last ${history.length} rounds: ${history.map(v => v.toFixed(1)).join(', ')}`}>
    <defs><linearGradient id="steam-line" x1="0" x2="1"><stop offset="0" stopColor="#ef8d5a" /><stop offset=".5" stopColor="#cfa2e4" /><stop offset="1" stopColor="#8ea6ff" /></linearGradient></defs>
    <path d={d} fill="none" stroke="url(#steam-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={lx} cy={ly} r="3.5" fill="#8ea6ff" />
  </svg>;
}

function Bowl({ view }: { view: TierView }) {
  const { tonight } = view;
  return <article className={s.bowl} aria-label={view.tier}>
    <header className={s.head}>
      <span className={s.tier}>{view.tier}</span>
      <span className={s.when}>Round {tonight.round} · {when(tonight.finished)}</span>
    </header>

    <div className={s.body}>
      <div className={s.left}>
        <p className={s.kicker}><Jp>今夜のスープ</Jp> Soup score</p>
        <p className={s.score}><span>{tonight.score.toFixed(1)}</span></p>
        <p className={s.change}>{view.change === null ? 'First round' : `${signed(view.change)} since the last round`}</p>
        <dl className={s.cats}>
          {(Object.keys(CATEGORY_WEIGHTS) as (keyof typeof CATEGORY_WEIGHTS)[]).map(c => <div key={c}>
            <dt>{CATEGORY_NAMES[c]}</dt>
            <dd><span className={s.track}><i style={{ width: `${tonight.categories[c]}%` }} /></span>{tonight.categories[c].toFixed(1)}</dd>
          </div>)}
        </dl>
        <div className={s.history}>
          <p className={s.kicker}><Jp>記録</Jp> Recent rounds</p>
          <Steam history={view.history} />
        </div>
      </div>

      <div className={s.right}>
        <p className={s.kicker}><Jp>具</Jp> Seats</p>
        <ul className={s.seats} aria-label="Seats">
          {view.seats.map((seat, i) => <li key={seat.body}>
            <i className={s.topping} style={{ background: SEATS[i % SEATS.length] }} aria-hidden="true" />
            <span className={s.seatName}>{seat.name}</span>
            <span className={s.seatMeta}>{KIND[seat.kind]}{seat.paid ? '' : ' · Unpaid'}</span>
            <span className={s.contribution} title="What the soup loses without this body, to 0.5 point">{signed(seat.contribution)}</span>
          </li>)}
        </ul>
        <p className={s.line}><FoodIcon name="ticket" /><Jp>会計</Jp>{view.crown ? `Crown: ${view.crown.name}` : 'Crown burned: no body beat every house model and the soup alone'}</p>
        <p className={s.line}><FoodIcon name="bowl" /><Jp>提供</Jp>Serving {view.serving.release} · by {view.serving.served_by === 'zils' ? 'Zils' : 'miners'}</p>
      </div>
    </div>
  </article>;
}

/** The latest soup per tier. Rounds grade a fresh exam slice each night, so small moves are partly noise. */
export function SoupBoardView({ board }: { board: SoupBoard }) {
  return <div className={s.board}>
    {board.tiers.map(t => <Bowl key={t.pool} view={tierView(t)} />)}
    <p className={s.fine}>Each round grades a fresh slice of a private exam, so small moves between rounds are partly noise; release windows are the comparable checkpoints. Contributions are what the soup loses without a body, rounded to 0.5 point.</p>
  </div>;
}

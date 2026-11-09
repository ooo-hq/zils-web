import type { CSSProperties } from 'react';
import { TIERS, hfTree, type Tier } from '@/lib/soup-tiers';
import { liveSummary, type LiveRound, type TierView } from '@/lib/soup-board';
import s from './board.module.css';
import { RoundClock } from './countdown';

// One tier's soup as a recipe bar. The soup is a uniform average, so every body is an equal part. Miner bodies
// carry the spectrum, each showing its own slice of it; house bodies are hatched, so a soup of house models alone
// stays grey.
type Seat = TierView['seats'][number];

const signed = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}`;
const when = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(iso));
const slice = (i: number, n: number) => ({ '--n': n, '--pos': `${n === 1 ? 50 : (i / (n - 1)) * 100}%` }) as CSSProperties;

const isHouse = (seat: Seat) => seat.kind === 'house';
function role(seat: Seat) {
  if (isHouse(seat)) return 'House · never paid';
  const pay = !seat.paid ? 'Unpaid' : seat.kind === 'scout' ? 'Scout seat, a quarter share' : 'Seat';
  return seat.crowned ? `${pay} · Crown` : pay;
}
const spoken = (seat: Seat) => `${seat.name} (${isHouse(seat) ? 'house' : `miner, ${seat.paid ? 'paid seat' : 'unpaid'}`}${seat.crowned ? ', crown' : ''})`;

function Recipe({ view }: { view: TierView }) {
  const n = view.seats.length;
  // The spectrum spreads across the miner parts only, so the first miner body always starts at its warm end.
  const miners = view.seats.filter(seat => !isHouse(seat)).map(seat => seat.body);
  const tint = (seat: Seat) => slice(Math.max(0, miners.indexOf(seat.body)), Math.max(1, miners.length));
  return <>
    <div className={s.bar} role="img" aria-label={`${view.tier} soup tonight, ${n} equal parts: ${view.seats.map(spoken).join(', ')}`}>
      {view.seats.map(seat => <span key={seat.body} className={s.part} data-part={isHouse(seat) ? 'house' : 'miner'} data-crown={seat.crowned || undefined} style={tint(seat)} />)}
    </div>
    <ol className={s.parts} aria-label="Parts" style={{ '--n': n } as CSSProperties} data-contrast>
      {view.seats.map(seat => <li key={seat.body} data-part={isHouse(seat) ? 'house' : 'miner'} style={tint(seat)}>
        {seat.repo ? <a className={s.partName} href={`https://huggingface.co/${seat.repo}`}>{seat.name}</a> : <span className={s.partName}>{seat.name}</span>}
        <span className={s.partBy}>by {seat.maker.length > 24 ? `${seat.maker.slice(0, 6)}…${seat.maker.slice(-4)}` : seat.maker}</span>
        <span className={s.partRole}>{role(seat)}</span>
        <span className={s.lift} title="What the soup loses without this body, to 0.5 point">{signed(seat.contribution)}</span>
      </li>)}
    </ol>
  </>;
}

function Pot({ tier, note, closed }: { tier: Tier; note: string | null; closed: boolean }) {
  const house = TIERS[tier].house;
  return <>
    <div className={s.potBar}>
      <div className={s.bar} role="img" aria-label={`${tier} has not cooked tonight. In the pot: ${house.map(h => h.name).join(', ')}`}>
        {house.map(h => <span key={h.name} className={s.part} data-part="pot" />)}
      </div>
      {closed && <span className={s.sticker}><b>No soup for you!</b><small lang="ja">売り切れ</small></span>}
    </div>
    {note && <p className={s.note}>{note}</p>}
    <ul className={s.pot} aria-label="In the pot" data-contrast>
      {house.map(h => <li key={h.name}><a href={hfTree(h.repo, h.revision)}>{h.name}</a> <span>by {h.repo.split('/')[0]}</span></li>)}
    </ul>
  </>;
}

/** A tier: what serves it, tonight's soup score and parts, or its pot of house models before it cooks.
 *  `view` is null when the soup feed is down (`feed` false) or does not list the tier. */
type Queued = { waiting: number; froze: string | null; grading: boolean; freezes: string | null };

/** How many bodies the tier still has to grade. */
function Queue({ queue }: { queue: Queued }) {
  return <p className={s.queue}>
    {queue.waiting === 0 ? 'No bodies waiting.' : <><b>{queue.waiting}</b> {queue.waiting === 1 ? 'body' : 'bodies'} waiting.</>}
    {' '}A round grades the bodies committed before its deadline, in the hours after it.
  </p>;
}

/** Tonight's round while it runs: one cell per new body, filling as each is checked, and what the round is doing. */
function Live({ live }: { live: LiveRound }) {
  const sum = liveSummary(live);
  // Done first, then the one being checked, so the rail fills from the left.
  const rank = { admitted: 0, refused: 0, checking: 1, waiting: 2, deferred: 3 } as Record<string, number>;
  const fresh = live.claims.filter(c => c.state !== 'in_pool').sort((a, b) => (rank[a.state] ?? 2) - (rank[b.state] ?? 2));
  const bodies = (n: number) => `${n} new ${n === 1 ? 'body' : 'bodies'}`;
  const later = sum.deferred ? ` ${sum.deferred} over tonight’s limit, graded in the next round.` : '';
  const doing = !sum.running
    ? `The round stopped on attempt ${sum.attempt ?? 1} of 3. The validator restarts it on its next pass, about once an hour.`
    : sum.stage === 'starting' ? `Starting tonight’s round: ${bodies(sum.total)} to check.`
    : sum.stage === 'intake' ? `Checking bodies: ${sum.checked} of ${sum.total} checked${sum.checking !== null ? `, now uid ${sum.checking}` : ''}.${later}`
    : `Scoring the soup with ${sum.admitted} of ${bodies(sum.total)} admitted.${later}`;
  return <div className={s.live} data-running={sum.running || undefined}>
    {fresh.length > 0 && <ol className={s.rail} aria-hidden="true">
      {fresh.map(c => <li key={c.uid} data-state={c.state} title={`uid ${c.uid}`} />)}
    </ol>}
    <p className={s.liveText} role="status">{doing}</p>
    <p className={s.roundLabel}>Started {when(sum.started)}. It has until {when(sum.deadline)} to finish.</p>
  </div>;
}

export function TierSoup({ tier, view, feed, queue, live }: { tier: Tier; view: TierView | null; feed: boolean; queue?: Queued; live?: LiveRound }) {
  const later = 'later' in TIERS[tier];
  const base = TIERS[tier].base;
  const tonight = view?.tonight ?? null;
  const serving = view?.serving;
  const served = later ? 'Opens later' : !view ? null : serving ? `Served by ${serving.served_by === 'zils' ? 'Zils' : 'miners'} as ${serving.release}` : 'Not served yet';
  const note = later ? 'Its 15% share burns until it opens.' : feed ? 'Waiting for its first round.' : null;
  return <article className={s.tier} aria-label={tier} data-state={later ? 'later' : tonight ? 'cooked' : 'waiting'}>
    <header className={s.head}>
      <div>
        <h3 className={s.name}>{tier} <span className={s.size}>{TIERS[tier].size}</span></h3>
        <p className={s.base}>Fine-tunes of <a href={hfTree(base.repo, base.revision)}>{base.repo}</a></p>
      </div>
      {served && <p className={s.served}>{served}</p>}
      {tonight && view && <p className={s.score}>
        <span className={s.scoreValue}>{tonight.score.toFixed(1)}</span>
        <span className={s.change}>{view.change === null ? (view.rescored ? 'First round on the new scoring' : 'First round') : `${signed(view.change)} since the last round`}</span>
      </p>}
    </header>
    {queue && !later && queue.froze && queue.freezes && <RoundClock froze={queue.froze} freezes={queue.freezes} grading={queue.grading && !live} />}
    {live && !later && <Live live={live} />}
    {tonight && view ? <>
      <Recipe view={view} />
      <p className={s.note}>
        {view.crown ? <>Crown: <b>{view.crown.name}</b>. </> : 'No crown tonight: no body beat every house model and the soup alone by 1.2. '}
        Round {tonight.round}, finished {when(tonight.finished)}.
        {view.decision && ` Seats decided on ${view.decision.rounds} ${view.decision.rounds === 1 ? 'round' : 'rounds'}, ${view.decision.items.toLocaleString('en-US')} items.`}
      </p>
    </> : <Pot tier={tier} note={note} closed={later} />}
    {queue && !later && queue.freezes && !live && <Queue queue={queue} />}
  </article>;
}

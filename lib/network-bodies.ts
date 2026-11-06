import { z } from 'zod';
import { serviceUrl } from './training';
import { poolTier, TIER_NAMES, type Tier } from './soup-tiers';
import type { SoupBoard } from './soup-board';

// Contract for GET /v1/network/bodies (zils-platform, Linear ZIL-109): every uid that has committed a soup body
// (zilsb2 / zilsb3 commitments) or announced a serving endpoint on chain. Strict objects: anything extra is refused,
// so endpoint addresses never reach the page.
const repo = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/).refine(value => !value.includes('..'));
const body = z.object({
  pool: z.enum(['d3-lite', 'd3-mini', 'd3-flash', 'd3']),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  repo,
  block: z.number().int().nonnegative(),
}).strict();
const miner = z.object({ uid: z.number().int().min(0).max(65535), hotkey: z.string().min(1).max(100), body: body.nullable(), serving: z.boolean() }).strict();
export const networkBodiesSchema = z.object({
  network: z.string().min(1).max(32), netuid: z.number().int().nonnegative(), block: z.number().int().nonnegative(),
  as_of: z.iso.datetime({ offset: true }),
  miners: z.array(miner).max(256),
}).strict();
export type NetworkBodies = z.infer<typeof networkBodiesSchema>;

/** Where a miner's body stands in tonight's soup of its tier.
 *  crown/seat: in the soup and paid; unpaid: in the soup, not paid (a scout or a body that did not lift it enough);
 *  out: the tier cooked without it; pending: committed after tonight's deadline, so the next round grades it;
 *  waiting: the tier has not cooked yet; unknown: no soup feed; none: no body. */
export type Standing = 'crown' | 'seat' | 'unpaid' | 'out' | 'pending' | 'waiting' | 'unknown' | 'none'
  | 'checking' | 'checked' | 'queued' | 'deferred' | 'refused' | 'in_line';
// While a tier's round runs (zils#205 `live`), a new claim's state replaces last night's standing.
const LIVE: Partial<Record<string, Standing>> = { checking: 'checking', admitted: 'checked', waiting: 'queued', deferred: 'deferred', refused: 'refused' };
type Live = { claims: { uid: number; state: string }[] };
// Between rounds, a tier's `intake` (zils soup_publish.intake): a body the validator has not graded is in line
// (`in_line`), refused when its hash or its claim was refused. The line is commitment order, as intake reads it.
type Intake = { max_new_per_round: number; graded: string[]; rejected: string[]; claims: { uid: number; sha256: string; state: string; reason: string | null }[] };
type Tiers = { pool: string; rounds: Round[]; live?: Live; intake?: Intake }[];
/** A body's place in its pool's line: 1-based, against the next round's new-body limit, with last round's
 *  deferral reason (its "retried next round" tail dropped) when that round passed over this same body. */
export type Line = { position: number; limit: number; next: boolean; reason: string | null };

type Rounds = Pick<SoupBoard['tiers'][number], 'pool' | 'rounds'>[];
type Round = Pick<SoupBoard['tiers'][number]['rounds'][number], 'round_id' | 'pool_id' | 'members' | 'crown'>;

// A round freezes its bodies at the first block after its day's commit deadline (zils/soup_pool.py `due`,
// `seed_block`); its id ends in that day. Each pool's deadline hour is `schedule.deadline_utc` in
// zils/data/base-pools-launch.json (pools are staggered so one card grades them in turn). The feed gives a
// commitment's block, not its time, so the time is estimated from the chain head at 12 s a block. Only a
// commit clearly after the deadline counts: within this margin the estimate cannot tell.
const DEADLINE_UTC: Record<string, string> = { 'd3-lite': '06:00', 'd3-mini': '00:00', 'd3-flash': '12:00', 'd3': '18:00' };
const BLOCK_SECONDS = 12;
const DEADLINE_MARGIN_MS = 30 * 60_000;

function deadline(round: Round) {
  const day = /(\d{4}-\d{2}-\d{2})$/.exec(round.round_id)?.[1];
  const hour = DEADLINE_UTC[round.pool_id];
  return day && hour ? Date.parse(`${day}T${hour}:00Z`) : NaN;
}

function committedAfter(round: Round, chain: Pick<NetworkBodies, 'block' | 'as_of'>, block: number) {
  const committed = Date.parse(chain.as_of) - (chain.block - block) * BLOCK_SECONDS * 1000;
  return committed > deadline(round) + DEADLINE_MARGIN_MS;
}

function standing(uid: number, body: NonNullable<NetworkBodies['miners'][number]['body']>, chain: Pick<NetworkBodies, 'block' | 'as_of'>, tiers: Tiers | null): Standing {
  if (!tiers) return 'unknown';
  const tier = tiers.find(t => t.pool === body.pool);
  const now = LIVE[tier?.live?.claims.find(c => c.uid === uid)?.state ?? ''];
  if (now) return now;
  const intake = tier?.intake;
  if (intake && !intake.graded.includes(body.sha256)) {
    const claim = intake.claims.find(c => c.uid === uid && c.sha256 === body.sha256);
    return intake.rejected.includes(body.sha256) || claim?.state === 'refused' ? 'refused' : 'in_line';
  }
  const tonight = tier?.rounds[0];
  if (!tonight) return 'waiting';
  if (tonight.crown?.body_sha256 === body.sha256) return 'crown';
  const seat = tonight.members.find(m => m.body_sha256 === body.sha256);
  if (seat) return seat.seat_weight > 0 ? 'seat' : 'unpaid';
  return committedAfter(tonight, chain, body.block) ? 'pending' : 'out';
}

/** One row per uid: its chain facts, its tier, and where its body stands in tonight's soup. */
export function minerRows(chain: NetworkBodies, soup: { tiers: Tiers } | null) {
  const rows = chain.miners.map(m => ({
    uid: m.uid, hotkey: m.hotkey, serving: m.serving, body: m.body,
    tier: m.body ? poolTier(m.body.pool) : null as Tier | null,
    standing: m.body ? standing(m.uid, m.body, chain, soup?.tiers ?? null) : 'none' as Standing,
    line: null as Line | null,
  }));
  for (const tier of soup?.tiers ?? []) {
    if (!tier.intake) continue;
    const { max_new_per_round: limit, claims } = tier.intake;
    const queued = rows.filter(r => r.body?.pool === tier.pool && r.standing === 'in_line')
      .sort((a, b) => a.body!.block - b.body!.block || (a.hotkey < b.hotkey ? -1 : a.hotkey > b.hotkey ? 1 : 0) || a.uid - b.uid);
    queued.forEach((r, i) => {
      const deferred = claims.find(c => c.uid === r.uid && c.sha256 === r.body!.sha256 && c.state === 'deferred');
      r.line = { position: i + 1, limit, next: i < limit, reason: deferred?.reason?.replace(/; retried next round$/, '') ?? null };
    });
  }
  return rows;
}
export type MinerRow = ReturnType<typeof minerRows>[number];

// The validator's deferral reasons (zils soup_round._intake_claims), keyed by a phrase each contains.
const REASONS: [string, string][] = [
  ['new-body cap', 'Over the new-body cap'], ['claims cap', 'Over the claims cap'],
  ['download budget', 'Download budget spent'], ['free disk', 'Validator disk full'],
];
/** A deferral reason as a short label; one not known here is shown as sent, capitalized. */
export function reasonLabel(reason: string | null) {
  if (reason === null) return null;
  return REASONS.find(([phrase]) => reason.includes(phrase))?.[1] ?? reason.charAt(0).toUpperCase() + reason.slice(1);
}

/** The "Next round" tables: per tier with a line, its bodies in line order, and `cut`, how many of them the next
 *  round's new-body limit reaches (the table marks the cut after that row). Tiers in display order. */
export function nextRound<R extends { tier: Tier | null; line: Line | null }>(rows: R[]) {
  return TIER_NAMES.flatMap(tier => {
    const line = rows.filter(r => r.tier === tier && r.line).sort((a, b) => a.line!.position - b.line!.position);
    if (!line.length) return [];
    const limit = line[0].line!.limit;
    return [{ tier, limit, rows: line, cut: Math.min(limit, line.length) }];
  });
}

export const MINERS_PER_PAGE = 25;
const SOUP_ORDER: Partial<Record<Standing, number>> = { crown: 0, seat: 1, unpaid: 2, in_line: 3 };

export type SortKey = 'tonight' | 'uid' | 'tier';
export type MinerSort = { key: SortKey; dir: 'asc' | 'desc' };
const SORT_KEYS: SortKey[] = ['tonight', 'uid', 'tier'];
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

/** The chain table's sort from the raw `?sort=` and `?dir=` values; anything unknown is the default. */
export function minerSort(sort: string | string[] | undefined, dir: string | string[] | undefined): MinerSort {
  const key = SORT_KEYS.find(k => k === first(sort)) ?? 'tonight';
  return { key, dir: first(dir) === 'desc' ? 'desc' : 'asc' };
}

/** A link back to the table: with `column`, its header link (the active column flips, others start ascending);
 *  without, the same sort on `page`. The default sort and page 1 stay out of the URL. */
export function sortHref(now: MinerSort, column: SortKey | null, page = 1) {
  const next = column === null ? now : { key: column, dir: column === now.key && now.dir === 'asc' ? 'desc' : 'asc' };
  const params = new URLSearchParams();
  if (next.key !== 'tonight' || next.dir !== 'asc') { params.set('sort', next.key); params.set('dir', next.dir); }
  if (column === null && page > 1) params.set('page', String(page));
  const query = params.toString();
  return `/miners${query ? `?${query}` : ''}#miners`;
}

/** One page of the chain table, sorted across every page. Tonight (the default): tonight's soup first (crown, paid
 *  seats, unpaid seats), then bodies in line by tier and place, then everyone else by uid. Tier keeps tonight's
 *  order inside each tier and puts rows with no tier last either way. `asked` is the raw `?page=` value; anything
 *  out of range or not a number shows the nearest real page. */
export function minerPage<R extends { uid: number; standing: Standing; tier?: Tier | null; line?: Line | null }>(rows: R[], asked: string | string[] | undefined, sort: MinerSort = { key: 'tonight', dir: 'asc' }) {
  const group = (r: R) => SOUP_ORDER[r.standing] ?? 4;
  const inLine = (a: R, b: R) => TIER_NAMES.indexOf(a.tier!) - TIER_NAMES.indexOf(b.tier!) || a.line!.position - b.line!.position;
  const tonight = (a: R, b: R) => group(a) - group(b) || (a.line && b.line ? inLine(a, b) : 0) || a.uid - b.uid;
  const tierRank = (r: R) => r.tier ? TIER_NAMES.indexOf(r.tier) : null;
  const sign = sort.dir === 'desc' ? -1 : 1;
  const compare = sort.key === 'uid' ? (a: R, b: R) => sign * (a.uid - b.uid)
    : sort.key === 'tier' ? (a: R, b: R) => {
      const [x, y] = [tierRank(a), tierRank(b)];
      return (x === null) !== (y === null) ? (x === null ? 1 : -1) : sign * ((x ?? 0) - (y ?? 0)) || tonight(a, b);
    }
    : (a: R, b: R) => sign * tonight(a, b);
  const ordered = [...rows].sort(compare);
  const pages = Math.max(1, Math.ceil(ordered.length / MINERS_PER_PAGE));
  const wanted = Number.parseInt(first(asked) ?? '1', 10);
  const page = Math.min(pages, Math.max(1, Number.isFinite(wanted) ? wanted : 1));
  const start = (page - 1) * MINERS_PER_PAGE;
  const slice = ordered.slice(start, start + MINERS_PER_PAGE);
  return { rows: slice, page, pages, total: ordered.length, from: slice.length ? start + 1 : 0, to: start + slice.length };
}

/** What a tier's card says about the bodies still to be graded: how many wait (`pending`, or every body while the
 *  tier has no round yet), when the last round froze its bodies (`froze`) and the next one will (`freezes`), both
 *  ISO and null for a pool with no deadline, such as one not yet open. `grading` is true between a deadline and
 *  that day's round reaching the feed: `latest` is the newest published round id, which ends in its day. */
export function tierQueue(pool: string, rows: Pick<MinerRow, 'body' | 'standing'>[], now = Date.now(), latest: string | null = null) {
  const waiting = rows.filter(r => r.body?.pool === pool && (r.standing === 'pending' || r.standing === 'waiting' || r.standing === 'in_line')).length;
  const hour = DEADLINE_UTC[pool];
  if (!hour) return { waiting, froze: null as string | null, grading: false, freezes: null as string | null };
  const today = new Date(now).toISOString().slice(0, 10);
  let froze = Date.parse(`${today}T${hour}:00Z`);
  if (froze > now) froze -= 86_400_000;
  const frozeDay = new Date(froze).toISOString().slice(0, 10);
  const latestDay = latest ? /(\d{4}-\d{2}-\d{2})$/.exec(latest)?.[1] : undefined;
  return {
    waiting,
    froze: new Date(froze).toISOString(),
    grading: latestDay !== undefined && latestDay < frozeDay,
    freezes: new Date(froze + 86_400_000).toISOString(),
  };
}

/** A time left on the round clock as `22:54:08`; never below `0:00:00`. */
export function clockTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** How far a round's commit window has run, 0 at the deadline that opened it (`froze`) and 1 at the next. */
export function roundProgress(froze: string, freezes: string, now: number) {
  const start = Date.parse(froze), end = Date.parse(freezes);
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

export type { Rounds };

/** The chain view, or null when the feed is unconfigured, down, malformed or more than an hour old. */
export async function networkBodies(): Promise<NetworkBodies | null> {
  const raw = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL;
  if (!raw) return null;
  try {
    const response = await fetch(`${serviceUrl(raw)}/v1/network/bodies`, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const parsed = networkBodiesSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    const age = Date.now() - Date.parse(parsed.data.as_of);
    return age >= 0 && age <= 3_600_000 ? parsed.data : null;
  } catch { return null; }
}

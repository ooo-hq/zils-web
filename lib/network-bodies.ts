import { z } from 'zod';
import { serviceUrl } from './training';
import { poolTier, type Tier } from './soup-tiers';
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
export type Standing = 'crown' | 'seat' | 'unpaid' | 'out' | 'pending' | 'waiting' | 'unknown' | 'none';

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

function standing(body: NonNullable<NetworkBodies['miners'][number]['body']>, chain: Pick<NetworkBodies, 'block' | 'as_of'>, tiers: { pool: string; rounds: Round[] }[] | null): Standing {
  if (!tiers) return 'unknown';
  const tonight = tiers.find(t => t.pool === body.pool)?.rounds[0];
  if (!tonight) return 'waiting';
  if (tonight.crown?.body_sha256 === body.sha256) return 'crown';
  const seat = tonight.members.find(m => m.body_sha256 === body.sha256);
  if (seat) return seat.seat_weight > 0 ? 'seat' : 'unpaid';
  return committedAfter(tonight, chain, body.block) ? 'pending' : 'out';
}

/** One row per uid: its chain facts, its tier, and where its body stands in tonight's soup. */
export function minerRows(chain: NetworkBodies, soup: { tiers: { pool: string; rounds: Round[] }[] } | null) {
  return chain.miners.map(m => ({
    uid: m.uid, hotkey: m.hotkey, serving: m.serving, body: m.body,
    tier: m.body ? poolTier(m.body.pool) : null as Tier | null,
    standing: m.body ? standing(m.body, chain, soup?.tiers ?? null) : 'none' as Standing,
  }));
}
export type MinerRow = ReturnType<typeof minerRows>[number];
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

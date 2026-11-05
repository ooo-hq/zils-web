import { z } from 'zod';
import { serviceUrl } from './training';

// Contract for GET /v1/network/soup (zils-platform, Linear ZIL-109). Each round is the record
// zils/soup_publish.public_record writes, plus finished_at; validators publish them to a public Hugging Face
// dataset and the platform serves the latest per pool. Strict objects: anything extra is refused, so exam
// items or labels can never reach the page through this feed.
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const rate = z.union([z.literal(0), z.literal(0.25), z.literal(1)]);
const point = z.number().finite().min(0).max(100);
const repo = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/).refine(value => !value.includes('..'));

// zils/base_metrics.CATEGORY_WEIGHTS; they sum to 1.
export const CATEGORY_WEIGHTS = { reasoning: 0.2585, language: 0.2585, retrieval: 0.2002, tools: 0.1828, arts: 0.1 } as const;
type Category = keyof typeof CATEGORY_WEIGHTS;
const categories = z.object({ reasoning: point, language: point, retrieval: point, tools: point, arts: point }).strict();

// House bodies hold seats with no miner behind them: the validator publishes their hotkey as null.
const hotkey = z.string().min(1).max(100).nullable();
const member = z.object({ hotkey, body_sha256: sha, rate, seat_weight: z.number().finite().min(0).max(1), contribution: z.number().finite() }).strict();
const round = z.object({
  round_id: z.string().min(1).max(64), pool_id: z.string().min(1).max(32), seed: z.string().max(128),
  finished_at: z.iso.datetime({ offset: true }),
  members: z.array(member).max(5),
  crown: z.object({ hotkey, body_sha256: sha, rate, weight: z.number().finite().min(0).max(1) }).strict().nullable(),
  category_scores: categories,
  soup_sha256: sha, subset_sha256: sha, predictions_sha256: sha,
  // zils#150: seats and the crown are scored on this round's items plus the validator's previous rounds' (decision_rounds);
  // the record names those rounds by id.
  decision: z.object({ rounds: z.array(z.string().min(1).max(64)).min(1).max(7), items: z.number().int().min(0) }).strict().optional(),
  // zils#162: the pool's scoring and the soup's fitted temperature (grid 0.1 to 10), published together.
  scoring: z.enum(['calibrated_brier', 'calibrated_argmax', 'argmax']).optional(),
  temperature: z.number().finite().min(0.1).max(10).optional(),
}).strict();
// zils#205 / zils-platform#81: the round in progress, only while it runs. One public state per committed claim;
// refusal reasons stay in the validator's private records and are never part of this contract.
const claimState = z.enum(['waiting', 'checking', 'admitted', 'in_pool', 'deferred', 'refused']);
const live = z.object({
  round_id: z.string().min(1).max(64), attempt: z.number().int().min(1).max(10).nullable(),
  running: z.boolean(), stage: z.enum(['starting', 'intake', 'scoring']),
  started_at: z.iso.datetime({ offset: true }), deadline_at: z.iso.datetime({ offset: true }),
  claims: z.array(z.object({ uid: z.number().int().min(0).max(65535), state: claimState }).strict()).max(256),
}).strict();
export type LiveRound = z.infer<typeof live>;

const tier = z.object({
  pool: z.string().min(1).max(32),
  tier: z.string().regex(/^z3(-[a-z]+)?$/),
  // null while Zils serves nothing for the tier (flash and z3 before they open).
  serving: z.object({ release: z.string().min(1).max(60), served_by: z.enum(['zils', 'miners']) }).strict().nullable(),
  bodies: z.record(sha, z.object({ house: z.string().max(80).nullable(), repo: repo.nullable() }).strict()),
  rounds: z.array(round).max(60), // newest first
  live: live.optional(),
}).strict();
export const soupBoardSchema = z.object({ as_of: z.iso.datetime({ offset: true }), tiers: z.array(tier).max(8) }).strict();

export type SoupBoard = z.infer<typeof soupBoardSchema>;
export type SoupTier = z.infer<typeof tier>;
type Bodies = SoupTier['bodies'];

const tenth = (value: number) => Math.round(value * 10) / 10;

/** A running round in numbers: of the new bodies (every claim not already in the pool), how many are checked
 *  (admitted or refused), admitted and over the round's limits, and the uid being checked now (null once scoring). */
export function liveSummary(round: LiveRound) {
  const fresh = round.claims.filter(c => c.state !== 'in_pool');
  const count = (...states: LiveRound['claims'][number]['state'][]) => fresh.filter(c => states.includes(c.state)).length;
  return {
    stage: round.stage, running: round.running, attempt: round.attempt,
    started: round.started_at, deadline: round.deadline_at,
    total: fresh.length, checked: count('admitted', 'refused'), admitted: count('admitted'), deferred: count('deferred'),
    checking: round.stage === 'scoring' ? null : fresh.find(c => c.state === 'checking')?.uid ?? null,
  };
}

/** The 0–100 soup score: category scores weighted as the validator weights them, to 0.1 point. */
export function soupScore(scores: Record<Category, number>) {
  return tenth((Object.keys(CATEGORY_WEIGHTS) as Category[]).reduce((sum, c) => sum + scores[c] * CATEGORY_WEIGHTS[c], 0));
}

/** A body's public name: the house model's name, else its repo, else hotkey (or "house") and hash prefixes. Never invented. */
export function bodyLabel(entry: { hotkey: string | null; body_sha256: string }, bodies: Bodies) {
  const known = bodies[entry.body_sha256];
  const who = entry.hotkey === null ? 'house' : `${entry.hotkey.slice(0, 4)}…`;
  return known?.house ?? known?.repo ?? `${who} · ${entry.body_sha256.slice(0, 8)}`;
}

type SeatKind = 'house' | 'trainer' | 'scout';
const kind = (rateValue: number, house: boolean): SeatKind => house ? 'house' : rateValue === 1 ? 'trainer' : rateValue === 0.25 ? 'scout' : 'house';

/** Who made a body: the house model's Hugging Face owner, else the miner's hotkey, else "house". */
const maker = (hotkey: string | null, sha: string, bodies: Bodies) => {
  const known = bodies[sha];
  return known?.house && known.repo ? known.repo.split('/')[0] : hotkey ?? 'house';
};

/** What the page shows for one tier: tonight's soup, the change since the previous round, seats, crown, history.
 *  A tier before its first round has no tonight, no seats and no history. */
export function tierView(t: SoupTier) {
  // Scores from different scoring methods are not comparable (zils#162 moved pools from argmax to
  // calibrated_brier on 2 Nov 2026); records from before #162 carry no scoring field and were argmax.
  const method = (r: SoupTier['rounds'][number]) => r.scoring ?? 'argmax';
  const [tonight, last] = t.rounds;
  const previous = last && method(last) === method(tonight) ? last : undefined;
  const base = { tier: t.tier, pool: t.pool, serving: t.serving };
  if (!tonight) return { ...base, tonight: null, decision: null, change: null, rescored: false, seats: [], crown: null, history: [] as number[] };
  const score = soupScore(tonight.category_scores);
  return {
    ...base,
    tonight: { round: tonight.round_id, finished: tonight.finished_at, score, categories: tonight.category_scores },
    decision: tonight.decision ? { rounds: tonight.decision.rounds.length, items: tonight.decision.items } : null,
    change: previous ? tenth(score - soupScore(previous.category_scores)) : null,
    rescored: Boolean(last) && !previous, // earlier rounds exist, scored another way
    seats: tonight.members.map(m => ({
      name: bodyLabel(m, t.bodies), hotkey: m.hotkey, body: m.body_sha256, rate: m.rate,
      kind: kind(m.rate, Boolean(t.bodies[m.body_sha256]?.house)), contribution: m.contribution, paid: m.seat_weight > 0,
      maker: maker(m.hotkey, m.body_sha256, t.bodies), crowned: tonight.crown?.body_sha256 === m.body_sha256,
      repo: t.bodies[m.body_sha256]?.repo ?? null,
    })),
    crown: tonight.crown ? { name: bodyLabel(tonight.crown, t.bodies), rate: tonight.crown.rate } : null,
    history: t.rounds.filter(r => method(r) === method(tonight)).reverse().map(r => soupScore(r.category_scores)),
  };
}
export type TierView = ReturnType<typeof tierView>;

/** The latest soup rounds per tier (tiers that have not cooked yet included), or null when the feed is
 *  unconfigured, down, malformed or older than two days. */
export async function soupBoard(): Promise<SoupBoard | null> {
  const raw = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL;
  if (!raw) return null;
  try {
    const response = await fetch(`${serviceUrl(raw)}/v1/network/soup`, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const parsed = soupBoardSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    const age = Date.now() - Date.parse(parsed.data.as_of);
    if (!(age >= 0 && age <= 2 * 86_400_000)) return null;
    return parsed.data;
  } catch { return null; }
}

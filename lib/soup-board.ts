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

const member = z.object({ hotkey: z.string().min(1).max(100), body_sha256: sha, rate, seat_weight: z.number().finite().min(0).max(1), contribution: z.number().finite() }).strict();
const round = z.object({
  round_id: z.string().min(1).max(64), pool_id: z.string().min(1).max(32), seed: z.string().max(128),
  finished_at: z.iso.datetime({ offset: true }),
  members: z.array(member).max(5),
  crown: z.object({ hotkey: z.string().min(1).max(100), body_sha256: sha, rate, weight: z.number().finite().min(0).max(1) }).strict().nullable(),
  category_scores: categories,
  soup_sha256: sha, subset_sha256: sha, predictions_sha256: sha,
}).strict();
const tier = z.object({
  pool: z.string().min(1).max(32),
  tier: z.string().regex(/^z3(-[a-z]+)?$/),
  serving: z.object({ release: z.string().min(1).max(60), served_by: z.enum(['zils', 'miners']) }).strict(),
  bodies: z.record(sha, z.object({ house: z.string().max(80).nullable(), repo: repo.nullable() }).strict()),
  rounds: z.array(round).max(60), // newest first
}).strict();
export const soupBoardSchema = z.object({ as_of: z.iso.datetime({ offset: true }), tiers: z.array(tier).max(8) }).strict();

export type SoupBoard = z.infer<typeof soupBoardSchema>;
export type SoupTier = z.infer<typeof tier>;
type Bodies = SoupTier['bodies'];

const tenth = (value: number) => Math.round(value * 10) / 10;

/** The 0–100 soup score: category scores weighted as the validator weights them, to 0.1 point. */
export function soupScore(scores: Record<Category, number>) {
  return tenth((Object.keys(CATEGORY_WEIGHTS) as Category[]).reduce((sum, c) => sum + scores[c] * CATEGORY_WEIGHTS[c], 0));
}

/** A body's public name: the house model's name, else its repo, else hotkey and hash prefixes. Never invented. */
export function bodyLabel(entry: { hotkey: string; body_sha256: string }, bodies: Bodies) {
  const known = bodies[entry.body_sha256];
  return known?.house ?? known?.repo ?? `${entry.hotkey.slice(0, 4)}… · ${entry.body_sha256.slice(0, 8)}`;
}

type SeatKind = 'house' | 'trainer' | 'scout';
const kind = (rateValue: number, house: boolean): SeatKind => house ? 'house' : rateValue === 1 ? 'trainer' : rateValue === 0.25 ? 'scout' : 'house';

/** What the board shows for one tier: tonight's soup, the change since the previous round, seats, crown, history. */
export function tierView(t: SoupTier) {
  const [tonight, previous] = t.rounds;
  const score = soupScore(tonight.category_scores);
  return {
    tier: t.tier,
    serving: t.serving,
    tonight: { round: tonight.round_id, finished: tonight.finished_at, score, categories: tonight.category_scores },
    change: previous ? tenth(score - soupScore(previous.category_scores)) : null,
    seats: tonight.members.map(m => ({
      name: bodyLabel(m, t.bodies), hotkey: m.hotkey, body: m.body_sha256, rate: m.rate,
      kind: kind(m.rate, Boolean(t.bodies[m.body_sha256]?.house)), contribution: m.contribution, paid: m.seat_weight > 0,
    })),
    crown: tonight.crown ? { name: bodyLabel(tonight.crown, t.bodies), rate: tonight.crown.rate } : null,
    history: t.rounds.slice().reverse().map(r => soupScore(r.category_scores)),
  };
}
export type TierView = ReturnType<typeof tierView>;

/** The latest soup rounds per tier, or null when the feed is unconfigured, down, malformed or older than two days. */
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
    return { ...parsed.data, tiers: parsed.data.tiers.filter(t => t.rounds.length > 0) };
  } catch { return null; }
}

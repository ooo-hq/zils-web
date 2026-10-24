import { z } from 'zod';
import { serviceUrl } from './training';

const count = z.number().int().nonnegative();
const stats = z.object({ assigned: count, submitted: count, evaluated: count, selected: count, median_skill: z.number().nullable() });
const trackSummary = z.object({ completed_jobs: count, miners: count });
const miner = z.object({
  uid: count,
  hotkey: z.string().min(1).max(100),
  status: z.enum(['online', 'stale', 'offline', 'unseen', 'disabled']),
  last_seen: z.string().nullable(),
  models: z.array(z.string()),
  training: stats.extend({ tracks: z.object({ text: stats, image: stats }).optional() }),
});
const network = z.object({
  as_of: z.string(),
  summary: z.object({ miners: count, online: count, stale: count, offline: count, unseen: count, disabled: count }),
  tracks: z.object({ text: trackSummary, image: trackSummary }).optional(),
  miners: z.array(miner),
});
export type NetworkMiners = z.infer<typeof network>;
export type Miner = z.infer<typeof miner>;

/** Read current miner check-ins without a second cache delaying status/model changes. */
export async function networkMiners(): Promise<NetworkMiners | null> {
  const raw = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL;
  if (!raw) return null;
  try {
    const response = await fetch(`${serviceUrl(raw)}/v1/network/miners`, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const parsed = network.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

const repo = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/).refine(value => !value.includes('..') && !value.includes('--'));
export const baseSubmissionsSchema = z.object({
  network: z.literal('test'), netuid: z.literal(579), block: count,
  as_of: z.iso.datetime({ offset: true }),
  submissions: z.array(z.object({
    uid: count, hotkey: z.string().min(1).max(100), commitment_block: count,
    sha256: z.string().regex(/^[a-f0-9]{64}$/), revision: z.string().regex(/^[a-f0-9]{40}$/), repo,
    model: z.string().max(100).nullable(),
  })).max(4096),
});

/** Chain submissions have no worker heartbeat or customer-job score. */
export async function baseSubmissions() {
  const raw = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL;
  if (!raw) return null;
  try {
    const response = await fetch(`${serviceUrl(raw)}/v1/network/base-submissions`, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const parsed = baseSubmissionsSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    const age = Date.now() - Date.parse(parsed.data.as_of);
    return age >= 0 && age <= 15 * 60_000 ? parsed.data : null;
  } catch { return null; }
}

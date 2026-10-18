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
export type Track = 'text' | 'image';

/** Per-hotkey miner aggregates from the public training API (refreshed every minute). */
export async function networkMiners(): Promise<NetworkMiners | null> {
  const raw = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL;
  if (!raw) return null;
  try {
    // `next.revalidate` is Next's fetch cache option; typed here so the plain-TypeScript test build accepts it.
    const init: RequestInit & { next: { revalidate: number } } = { next: { revalidate: 60 }, signal: AbortSignal.timeout(5_000) };
    const response = await fetch(`${serviceUrl(raw)}/v1/network/miners`, init);
    if (!response.ok) return null;
    const parsed = network.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

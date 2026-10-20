import { z } from 'zod';
import { serviceUrl, submissionSchema, type Submission } from './training';

const profile = z.object({ id: z.string(), name: z.string() });
const availability = z.object({ training_enabled: z.boolean(), serving_enabled: z.boolean(), max_input_tokens: z.number().int().positive(), inputs: z.object({ text: z.boolean(), images: z.boolean(), video: z.boolean() }) });
export const baseConfigSchema = z.object({
  model: profile.extend({ max_input_tokens: z.number().int().positive(), inputs: z.object({ images: z.number().int().nonnegative(), video: z.boolean() }).partial().optional() }),
  channels: z.object({ stable: profile, latest: profile.nullable().optional() }),
  pools: z.record(z.string(), z.object({ id: z.string(), name: z.string(), enabled: z.boolean(), parameters_billions: z.number().positive().optional(), channels: z.object({ stable: profile, latest: profile }), availability: z.object({ stable: availability, latest: availability }) })).optional(),
});
export type BaseConfig = z.infer<typeof baseConfigSchema>;
export type PoolSelection = Pick<Submission, 'pool' | 'base_channel' | 'model'>;

export function poolSelection(config: BaseConfig, pool: string, channel: 'stable' | 'latest', modality: 'text' | 'images'): PoolSelection | null {
  if (!config.pools) return {};
  const entry = config.pools[pool], state = entry?.availability[channel];
  const validPool = submissionSchema.shape.pool.safeParse(pool);
  return validPool.success && entry?.id === pool && entry.enabled && state?.training_enabled && state.inputs[modality]
    ? { pool: validPool.data, base_channel: channel, model: entry.channels[channel].id } : null;
}

export async function trainingBase(baseUrl: string, signal?: AbortSignal): Promise<BaseConfig> {
  const response = await fetch(`${serviceUrl(baseUrl)}/v1/config`, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5_000)]) : AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error('Model availability could not be loaded. Reopen training to retry.');
  return baseConfigSchema.parse(await response.json());
}

/** The base every new customer model trains on, read from the public training API (cached five minutes). */
export async function currentBase(): Promise<BaseConfig | null> {
  const raw = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL;
  if (!raw) return null;
  try {
    // `next.revalidate` is Next's fetch cache option; typed here so the plain-TypeScript test build accepts it.
    const init: RequestInit & { next: { revalidate: number } } = { next: { revalidate: 300 }, signal: AbortSignal.timeout(5_000) };
    const response = await fetch(`${serviceUrl(raw)}/v1/config`, init);
    if (!response.ok) return null;
    const parsed = baseConfigSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

import { z } from 'zod';
import { canDownload, isImageJob, serviceUrl, submissionSchema, type Job, type Submission } from './training';

const profile = z.object({ id: z.string(), name: z.string() });
const availability = z.object({ training_enabled: z.boolean(), serving_enabled: z.boolean(), max_input_tokens: z.number().int().positive(), inputs: z.object({ text: z.boolean(), images: z.boolean(), video: z.boolean() }) });
export const baseConfigSchema = z.object({
  model: profile.extend({ max_input_tokens: z.number().int().positive(), inputs: z.object({ images: z.number().int().nonnegative(), video: z.boolean() }).partial().optional() }),
  channels: z.object({ stable: profile, latest: profile.nullable().optional() }),
  pools: z.record(z.string(), z.object({ id: z.string(), name: z.string(), enabled: z.boolean(), parameters_billions: z.number().positive().optional(), channels: z.object({ stable: profile, latest: profile }), availability: z.object({ stable: availability, latest: availability }) })).optional(),
});
export type BaseConfig = z.infer<typeof baseConfigSchema>;
export type PoolSelection = Pick<Submission, 'pool' | 'base_channel' | 'model'>;
export type BaseMigration = { target: string; job?: Job };

function baseVersion(id: string) {
  // shortcut: order the released d3 stock/round naming scheme; use catalog lineage if other schemes launch.
  const match = /^(d3-(?:mini-4\.5b|lite-0\.8b|nano-2\.2b|flash-8\.4b|26b))-(?:v1|zils-r([1-9]\d{0,8}))$/.exec(id);
  return match ? { family: match[1], pool: match[1].replace(/-[\d.]+b$/, ''), round: Number(match[2] ?? 0) } : null;
}

/** Offer only a newer qualified base from this model's own pool. A chosen target stays pinned. */
export function newerBase(config: BaseConfig, job: Job, target?: string) {
  const current = job.model && baseVersion(job.model.id);
  if (!current || !canDownload(job) || isImageJob(job) || job.workflow?.state !== 'ready' || !job.workflow.model_id) return null;
  const channels = config.pools ? config.pools[current.pool]?.channels : current.pool === 'd3-mini' ? config.channels : undefined;
  let newer: { name: string; selection: PoolSelection; round: number } | null = null;
  for (const channel of ['stable', 'latest'] as const) {
    const profile = channels?.[channel], version = profile && baseVersion(profile.id);
    if (!profile || !version || version.family !== current.family || version.round <= current.round || (target && profile.id !== target)) continue;
    const selection = config.pools ? poolSelection(config, current.pool, channel, 'text') : { base_channel: channel, model: profile.id };
    if (selection && (!newer || version.round > newer.round)) newer = { name: profile.name, selection, round: version.round };
  }
  return newer;
}

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

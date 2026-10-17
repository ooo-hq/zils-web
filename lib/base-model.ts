import { z } from 'zod';
import { serviceUrl } from './training';

const profile = z.object({ id: z.string(), name: z.string() });
const config = z.object({
  model: profile.extend({ max_input_tokens: z.number().int().positive(), inputs: z.object({ images: z.number().int().nonnegative(), video: z.boolean() }).partial().optional() }),
  channels: z.object({ stable: profile, latest: profile.nullable().optional() }),
});
export type BaseConfig = z.infer<typeof config>;

/** The base every new customer model trains on, read from the public training API (cached five minutes). */
export async function currentBase(): Promise<BaseConfig | null> {
  const raw = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL;
  if (!raw) return null;
  try {
    // `next.revalidate` is Next's fetch cache option; typed here so the plain-TypeScript test build accepts it.
    const init: RequestInit & { next: { revalidate: number } } = { next: { revalidate: 300 }, signal: AbortSignal.timeout(5_000) };
    const response = await fetch(`${serviceUrl(raw)}/v1/config`, init);
    if (!response.ok) return null;
    const parsed = config.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

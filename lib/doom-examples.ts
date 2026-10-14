import { z } from 'zod';
import recorded from '../data/doom-examples.json';

const count = z.number().int().nonnegative();
const outcomes = z.object({ success: count.optional(), death: count.optional(), timeout: count.optional(), technical_failure: count.optional() });
const clip = z.object({ src: z.string().startsWith('/'), outcome: z.enum(['success', 'death', 'timeout']), gameTics: z.number().int().positive(), health: z.number(), decisions: count });
const path = z.string().startsWith('/');

export const doomExamples = z.object({
  date: z.string(), scenario: z.string(), fps: z.number().positive(), total: z.number().int().positive(), seed: z.number().int(),
  initialFrameSha256: z.string().length(64), initialObservationSha256: z.string().length(64),
  clips: z.object({ zils: clip, jev: clip }), poster: path,
  outcomes: z.object({ zils: outcomes, jev: outcomes, base: outcomes, reference: outcomes }),
  zilsModel: z.string(), jevModel: z.string(), trainingExamples: count,
  audit: z.object({ replaysVerified: count, matchedStarts: count, eligibleHighlights: count, reverseHighlights: count }),
  zilsSuccessWilson95: z.tuple([z.number(), z.number()]), pairedDifference: z.object({ points: z.number(), bootstrap95: z.tuple([z.number(), z.number()]) }), interruptedSeed: z.number().int(),
  evidence: z.object({ report: path, seeds: path, results: path }),
}).refine(data => Object.values(data.outcomes).every(row => Object.values(row).reduce((sum, n) => sum + (n ?? 0), 0) === data.total), 'every contender has one outcome per test seed')
  .refine(data => data.clips.zils.outcome === 'success' && data.clips.jev.outcome === 'death', 'the highlight is a Zils success and a JEV death').parse(recorded);

export const successes = (row: z.infer<typeof outcomes>) => row.success ?? 0;
export const gameSeconds = (tics: number) => tics / doomExamples.fps;

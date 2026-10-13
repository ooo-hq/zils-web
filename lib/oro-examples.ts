import { z } from 'zod';
import recorded from '../data/oro-examples.json';

const probabilities = z.object({
  'facet:need': z.number().min(0).max(1),
  all: z.number().min(0).max(1),
  asks: z.number().min(0).max(1),
});
const count = z.number().int().nonnegative();
export const oroExamples = z.object({
  date: z.string(), source: z.url(), training: count, calibration: count,
  total: z.number().int().positive(), pairs: z.number().int().positive(),
  scores: z.object({ zils: count, jev: count }),
  actions: z.object({ zils: count, jev: count }),
  questions: z.object({ 'facet:need': z.string(), all: z.string(), asks: z.string() }),
  cases: z.array(z.object({
    id: z.string(), title: z.string(), message: z.string().min(1), explanation: z.string(),
    expected: z.object({ 'facet:need': z.boolean(), all: z.boolean(), asks: z.boolean() }),
    zils: probabilities, jev: probabilities,
  })).min(1),
}).refine(data => Object.values(data.scores).every(n => n <= data.total)
  && Object.values(data.actions).every(n => n <= data.pairs)).parse(recorded);

// ORO's generic first-turn rule: multiple needs take precedence over disclosure.
export function disclosureAction(p: z.infer<typeof probabilities>) {
  return p.all >= .7 ? 'one_at_a_time' : p['facet:need'] >= .7 ? 'reveal' : 'no_disclosure';
}

export function oroJudgment(p: number) {
  return p >= .7 ? 'Yes' : p <= .3 ? 'No' : 'Unsure';
}

import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { BitcastExamples } from '@/components/bitcast-examples';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  title: 'Examples · Zils',
  description: 'Try recorded Zils decisions: review creator posts, sort sales replies, and find winning chess moves.',
  robots: { index: false, follow: false },
};

const verdict = z.enum(['pass', 'fail']);
const replyIntent = z.enum(['meeting_acceptance', 'pricing_question', 'referral', 'not_now', 'opt_out', 'wrong_person', 'negative']);
const board = z.string().regex(/^[KQRBNPkqrbnp.]{64}$/);
const square = z.string().regex(/^[a-h][1-8]$/);
const move = z.object({
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8]$/), label: z.string().min(1),
  fromSquare: square, toSquare: square, board, mate: z.boolean(),
}).refine(row => row.uci === row.fromSquare + row.toSquare);
const position = z.object({
  id: z.string(), title: z.string(), side: z.enum(['white', 'black']), board,
  moves: z.array(move).min(2), zils: z.string(), jev: z.string(), before: z.string(),
}).refine(row => row.moves.some(move => move.uci === row.zils && move.mate)
  && row.moves.some(move => move.uci === row.jev && !move.mate)
  && row.moves.some(move => move.uci === row.before)
  && new Set(row.moves.map(move => move.uci)).size === row.moves.length);
const localData = z.object({
  examples: z.array(z.object({
    id: z.string(), title: z.string(), brand: z.string(), tag: z.string(),
    summary: z.string(), analysis: z.string(), brief: z.string(), content: z.string(),
    productionReasoning: z.string(),
    decisions: z.object({ production: verdict, base: verdict, zils: verdict, jev: verdict }),
  })).min(1),
  scores: z.array(z.object({
    name: z.string(), note: z.string(), matches: z.number().int().nonnegative(), total: z.number().int().positive(),
  }).refine(row => row.matches <= row.total)).min(1),
  replies: z.array(z.object({
    id: z.string(), content: z.string(), previous: z.string().nullable(),
    intent: replyIntent, expected: replyIntent, jev: replyIntent, before: z.string(),
  }).refine(row => row.intent === row.expected)).min(1),
  chess: z.object({
    examples: z.array(position).min(1),
    scores: z.object({
      trained: z.number().int().nonnegative(), shared: z.number().int().nonnegative(), jev: z.number().int().nonnegative(),
    }),
    total: z.number().int().positive(),
  }).refine(row => Object.values(row.scores).every(score => score <= row.total)),
});

export default async function ExamplesPage() {
  // Customer examples are authorized for this local preview only.
  if (process.env.NODE_ENV !== 'development') notFound();
  const raw = await readFile(join(process.cwd(), '.private', 'bitcast-examples.json'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (raw === null) notFound();
  const data = localData.parse(JSON.parse(raw));

  return (
    <div className="min-h-screen bg-page font-sans text-ink antialiased">
      <div className="mx-auto max-w-6xl px-6 sm:px-8"><SiteHeader current="examples" tone="light" /></div>
      <BitcastExamples data={data} />
      <SiteFooter />
    </div>
  );
}

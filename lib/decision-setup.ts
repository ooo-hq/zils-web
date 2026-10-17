import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1, 'Enter a value.').max(max);
const safeName = text(100).refine(v => !['__proto__', 'constructor', 'prototype'].includes(v.toLowerCase()), 'Choose a different name.');
const option = z.object({ label: safeName, description: z.string().trim().max(500) }).strict();
const question = z.object({
  id: safeName.regex(/^[a-z][a-z0-9_]*$/, 'Use a short lowercase identifier.'),
  kind: z.enum(['choice', 'yes_no', 'score']),
  prompt: text(1000),
  options: z.array(option).max(16),
}).strict().superRefine((value, ctx) => {
  if (value.kind === 'yes_no' ? value.options.length !== 0 : value.options.length < 2) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: value.kind === 'yes_no' ? 'Yes/no questions do not need options.' : 'Add at least two possible answers.' });
  }
  const names = value.options.map(o => o.label.toLowerCase());
  if (new Set(names).size !== names.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Give each answer a different name.' });
});
export const setupSchema = z.object({ title: text(100), questions: z.array(question).min(1, 'Add at least one question.').max(8) }).strict()
  .refine(v => new Set(v.questions.map(q => q.id)).size === v.questions.length, 'Each question needs a different identifier.');
export type SetupDraft = z.infer<typeof setupSchema>;
export type SetupQuestion = SetupDraft['questions'][number];
export type SetupMessage = { role: 'user' | 'assistant'; content: string };

export const setupInputSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: text(6000) }).strict()).min(1).max(12),
  draft: setupSchema.optional(),
}).strict().refine(v => v.messages.at(-1)?.role === 'user', 'Describe what you need next.');
const replySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('clarify'), message: text(1200), choices: z.array(text(200)).max(4) }).strict(),
  z.object({ kind: z.literal('draft'), message: text(1200), draft: setupSchema }).strict(),
]);
export type SetupReply = z.infer<typeof replySchema>;
export function parseSetup(value: unknown): SetupDraft {
  const result = setupSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const index = typeof issue.path[1] === 'number' ? `Question ${issue.path[1] + 1}: ` : '';
    throw new Error(index + issue.message);
  }
  return result.data;
}
export function parseSetupReply(value: unknown): SetupReply { return replySchema.parse(value); }

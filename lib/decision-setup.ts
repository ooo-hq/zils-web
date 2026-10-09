import { z } from 'zod';
import { parseRequest, type DecisionRequest } from './playground';

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

export function setupRequest(value: unknown, example: string, model: string): DecisionRequest {
  const draft = parseSetup(value);
  if (!example.trim()) throw new Error('Paste an example to try your questions.');
  const questions: DecisionRequest['questions'] = Object.fromEntries(draft.questions.map(q => [q.id,
    q.kind === 'yes_no' ? { type: 'noul', instructions: q.prompt }
      : q.kind === 'choice' ? { type: 'choice', instructions: q.prompt, criteria: Object.fromEntries(q.options.map(o => [o.label, o.description || o.label])) }
      : { type: 'score', instructions: q.prompt, criteria: q.options.map(o => o.description ? `${o.label}: ${o.description}` : o.label) },
  ]));
  const request = parseRequest({ state: example, model, questions });
  if (new TextEncoder().encode(JSON.stringify(request)).length > 32_768) throw new Error('Keep the example and questions under 32 KB. Try a shorter example.');
  return request;
}

export const STARTERS: { id: string; name: string; description: string; goal: string; draft: SetupDraft; example: string }[] = [
  {
    id: 'customer-routing',
    name: 'Route customer messages', description: 'Send each request to the right team.',
    goal: 'I want to sort customer emails and flag anything urgent.',
    draft: { title: 'Customer message routing', questions: [
      { id: 'team', kind: 'choice', prompt: 'Which team should handle this customer message?', options: [
        { label: 'Billing', description: 'Invoices, charges, payments, and refunds.' },
        { label: 'Technical support', description: 'A product that is broken or not working.' },
        { label: 'Account changes', description: 'Account details, subscriptions, and access changes.' },
      ] },
      { id: 'urgent', kind: 'yes_no', prompt: 'Is the customer unable to use the product and in need of urgent attention?', options: [] },
    ] },
    example: 'Our entire team has been locked out since this morning. We have a client presentation in an hour. Can someone help us get back in?',
  },
  {
    id: 'refund-request',
    name: 'Check a condition', description: 'Get a clear yes or no.',
    goal: 'I want to check whether a customer is asking for a refund.',
    draft: { title: 'Refund requests', questions: [{ id: 'refund', kind: 'yes_no', prompt: 'Is the customer explicitly asking for their money back?', options: [] }] },
    example: 'The replacement arrived broken too. Please return my money instead of sending another one.',
  },
  {
    id: 'customer-frustration',
    name: 'Rate a message', description: 'Choose a position on a simple scale.',
    goal: 'I want to understand how frustrated a customer sounds.',
    draft: { title: 'Customer frustration', questions: [{ id: 'frustration', kind: 'score', prompt: 'How frustrated is the customer?', options: [
      { label: 'Calm', description: 'Neutral or friendly request.' },
      { label: 'Frustrated', description: 'Dissatisfied but still constructive.' },
      { label: 'Very frustrated', description: 'Strong anger or repeated unresolved problems.' },
    ] }] },
    example: 'I have contacted support three times about the same problem. It still does not work, and I am running out of patience.',
  },
];

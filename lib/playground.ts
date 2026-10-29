import { z } from 'zod';

// The typed decision contract used by the shared Zils API and the legacy runtime.
const content = z.json();
const question = z.discriminatedUnion('type', [
  z.object({ type: z.literal('noul'), instructions: content.optional(), criteria: z.object({ true: content.optional(), false: content.optional() }).strict().optional() }).strict(),
  z.object({ type: z.literal('choice'), instructions: content.optional(), criteria: z.record(z.string().min(1).max(100), content).refine(v => Object.keys(v).length >= 1 && Object.keys(v).length <= 16, 'Use 1–16 choices.') }).strict(),
  z.object({ type: z.literal('score'), instructions: content.optional(), criteria: z.array(content).min(1).max(16) }).strict(),
]);
const requestSchema = z.object({
  state: content,
  model: z.string().min(1).max(200),
  questions: z.record(z.string().min(1).max(100), question).refine(v => Object.keys(v).length >= 1 && Object.keys(v).length <= 8, 'Use 1–8 questions.'),
}).strict();
const probability = z.number().min(0).max(1);
const distribution = z.record(z.string(), probability).refine(v => Object.keys(v).length > 0 && Math.abs(Object.values(v).reduce((a, b) => a + b, 0) - 1) < 0.02);
const responseSchema = z.object({
  model: z.string().min(1),
  answers: z.record(z.string(), z.discriminatedUnion('type', [
    z.object({ type: z.literal('noul'), noul: probability }),
    z.object({ type: z.literal('choice'), choice: z.string(), confidence: probability, probabilities: distribution }),
    z.object({ type: z.literal('score'), score: z.number().min(0), confidence: probability, probabilities: distribution, legend: z.record(z.string(), content) }),
  ])),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }),
  latency_ms: z.number().nonnegative().optional(),
});

export type DecisionRequest = z.infer<typeof requestSchema>;
export type DecisionResponse = z.infer<typeof responseSchema>;
export type Answer = DecisionResponse['answers'][string];
export type ModelOption = { id: string; label: string; own?: boolean; questions?: DecisionRequest['questions'] };

/** The account's own models before the shared one, so the playground opens on the customer's model. */
export function ownFirst(models: ModelOption[]): ModelOption[] {
  return [...models.filter(m => m.own), ...models.filter(m => !m.own)];
}

/** A trained model's saved questions, keeping only the ones the playground can send. */
export function savedQuestions(value: unknown): DecisionRequest['questions'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const kept = Object.entries(value).flatMap(([id, q]) => {
    const parsed = question.safeParse(q);
    return parsed.success && id.length <= 100 ? [[id, parsed.data] as const] : [];
  }).slice(0, 8);
  return kept.length ? Object.fromEntries(kept) : undefined;
}

export function parseRequest(value: unknown): DecisionRequest {
  const result = requestSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`${issue.path.join('.') || 'Request'}: ${issue.message}`);
  }
  return result.data;
}

export function parseResponse(value: unknown, request: DecisionRequest): DecisionResponse {
  const result = responseSchema.parse(value);
  const sameKeys = (a: string[], b: string[]) => a.length === b.length && a.every(k => b.includes(k));
  if (!sameKeys(Object.keys(result.answers), Object.keys(request.questions))) throw new Error('Incomplete answers.');
  for (const [id, q] of Object.entries(request.questions)) {
    const a = result.answers[id];
    if (a.type !== q.type) throw new Error('Answer type mismatch.');
    if (a.type === 'choice' && q.type === 'choice') {
      if (!sameKeys(Object.keys(a.probabilities), Object.keys(q.criteria)) || !Object.hasOwn(a.probabilities, a.choice)) throw new Error('Choice mismatch.');
    }
    if (a.type === 'score' && q.type === 'score') {
      const keys = q.criteria.map((_, i) => String(i));
      if (!sameKeys(Object.keys(a.probabilities), keys) || !sameKeys(Object.keys(a.legend), keys) || a.score > keys.length - 1) throw new Error('Score mismatch.');
    }
  }
  return result;
}

export function editorRequest(state: string, questions: string, model: string): DecisionRequest {
  let parsedState: unknown = state;
  if (/^\s*[\[{]/.test(state)) {
    try { parsedState = JSON.parse(state); } catch { throw new Error('State starts with { or [ but is not valid JSON. Fix it or use plain text.'); }
  }
  let parsedQuestions: unknown;
  try { parsedQuestions = JSON.parse(questions); } catch { throw new Error('Questions must be valid JSON. Check quotes and commas.'); }
  return parseRequest({ state: parsedState, questions: parsedQuestions, model });
}

type Question = DecisionRequest['questions'][string];

/** Starting points for the playground's "Add a question" buttons. */
export const QUESTION_TYPES: { label: string; hint: string; id: string; template: Question & { instructions: string } }[] = [
  { label: 'Yes / no', hint: 'How true is something?', id: 'yes_no', template: { type: 'noul', instructions: 'Write a yes or no question about the context' } },
  { label: 'Choice', hint: 'Pick one of several options', id: 'choice', template: { type: 'choice', instructions: 'Write a question with one right option', criteria: { first_option: 'When the first option fits', second_option: 'When the second option fits' } } },
  { label: 'Score', hint: 'Grade against a rubric', id: 'score', template: { type: 'score', instructions: 'Write what to grade', criteria: ['Lowest level', 'Middle level', 'Highest level'] } },
];

/** Adds a question to the editor's JSON under an unused id. */
export function addQuestion(text: string, id: string, question: Question): { text: string; id: string } {
  let current: unknown = {};
  if (text.trim()) {
    try { current = JSON.parse(text); } catch { throw new Error('Fix the questions JSON before adding a question. Check quotes and commas.'); }
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error('Questions must be a JSON object.');
  if (Object.keys(current).length >= 8) throw new Error('Use 1–8 questions.');
  let key = id;
  for (let n = 2; Object.hasOwn(current, key); n++) key = `${id}_${n}`;
  return { text: JSON.stringify({ ...current, [key]: question }, null, 2), id: key };
}

export const PRESETS: { name: string; tag: string; description: string; state: DecisionRequest['state']; questions: DecisionRequest['questions'] }[] = [
  {
    name: 'Choose the right model', tag: 'Request → model', description: 'Decide whether a request can stay on a small model or needs a large one.',
    state: 'Customer email: "Hi, could you resend the invoice for order 88213 to accounts@northwind.example? Thanks!"',
    questions: {
      route: { type: 'choice', instructions: 'Which model should handle this request?', criteria: { small: 'A short, well-specified task a small model handles reliably', large: 'Multi-step reasoning, long context, or ambiguous requirements' } },
      needs_account_data: { type: 'noul', instructions: 'Does this require looking up or changing account data?' },
      complexity: { type: 'score', instructions: 'How complex is this request?', criteria: ['Trivial', 'Routine', 'Involved', 'Hard'] },
    },
  },
  {
    name: 'Select the next tool', tag: 'Context → tool', description: 'Pick the tool an agent should call next, without generating a full response.',
    state: { message: 'Where is my order #4412? It said it would arrive Tuesday.', customer_tier: 'standard', previous_tool_calls: [] },
    questions: {
      next_tool: { type: 'choice', instructions: 'Which tool should the support agent call next?', criteria: { order_lookup: 'Fetch shipping status for an order ID', search_docs: 'Search help-center articles', refund: 'Issue a refund', handoff: 'Transfer to a human agent' } },
      has_order_id: { type: 'noul', instructions: 'Does the message include an order ID?' },
    },
  },
  {
    name: 'Know when to escalate', tag: 'Agent state → next action', description: 'Decide whether an agent should continue, retry, or stop and ask for review.',
    state: 'Task: fix the failing test in billing/proration.spec.ts. Attempt 1 changed rounding; the test still fails (expected 12.50, got 12.49). Attempt 2 changed the rounding mode; same failure. The agent now proposes editing the expected value in the test.',
    questions: {
      next_action: { type: 'choice', instructions: 'What should the agent do next?', criteria: { continue: 'Proceed with the proposed change', retry: 'Try a different approach on its own', ask_for_review: 'Stop and ask a human before continuing' } },
      edits_test: { type: 'noul', instructions: 'Does the proposed change alter the test rather than the code under test?' },
      risk: { type: 'score', instructions: 'How risky is the proposed change?', criteria: ['Low', 'Medium', 'High'] },
    },
  },
  {
    name: 'Support triage', tag: 'Ticket → team', description: 'Route a customer request, check urgency, and score its tone.',
    state: 'My replacement headphones arrived yesterday, but the left ear does not work. This is the second broken pair. Please refund me instead of sending another replacement.',
    questions: {
      team: { type: 'choice', instructions: 'Which team should handle this request?', criteria: { returns: 'Faulty products, exchanges and refunds', shipping: 'Delivery tracking and missing parcels', billing: 'Duplicate charges and payment problems' } },
      resolution: { type: 'choice', instructions: 'What outcome does the customer want?', criteria: { refund: 'Return their money', replacement: 'Send another item', advice: 'Explain how to use the product' } },
      repeat_issue: { type: 'noul', instructions: 'Has the customer experienced this problem before?' },
      frustration: { type: 'score', instructions: 'How frustrated is the customer?', criteria: ['Calm', 'Frustrated', 'Very angry'] },
    },
  },
];

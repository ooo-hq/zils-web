import { z } from 'zod';
import { serviceUrl } from './training';
import type { CsvData } from './training-csv';
import type { Columns } from './train-table';

const count = z.number().int().nonnegative();
const shadowSchema = z.object({
  field: z.string().min(1), model: z.string().min(1), since: z.string(), asked: count, agreed: count, failed: count,
  by_confidence: z.array(z.object({ confidence_at_least: z.number().min(0).max(1), asked: count, agreed: count })),
});
// A run trained from a question: ready once its model can be called, failed if it ended without one.
const trainingSchema = z.object({ job_id: z.string().uuid(), field: z.string().min(1), name: z.string().min(1), started_at: z.string(), state: z.enum(['training', 'ready', 'failed']), model: z.string().min(1).nullable(),
  // The share of examples held back from training answered as the provider answered them, for the trained model and the one it started from.
  evaluation: z.object({ accuracy: z.number().min(0).max(1), baseline_accuracy: z.number().min(0).max(1) }).nullable().default(null),
});
const questionSchema = z.object({
  id: z.string().min(1), instructions: z.string(), fields: z.record(z.string(), z.array(z.union([z.string(), z.boolean()]))),
  first_at: z.string(), rows: count, last_at: z.string().nullable(), shadows: z.array(shadowSchema),
  // A service from before runs were noted sends none.
  trainings: z.array(trainingSchema).default([]),
});
const reportSchema = z.object({ relay: z.boolean(),
  // Whether a run's model may be compared with the provider on this account; off for a service from before the switch.
  compare: z.boolean().default(false), saving_since: z.string().nullable(), questions_total: count, questions: z.array(questionSchema) });
export type RelayShadow = z.infer<typeof shadowSchema>;
export type RelayQuestion = z.infer<typeof questionSchema>;
export type RelayTraining = z.infer<typeof trainingSchema>;
export type RelayTrainingNote = { field: string; job_id: string; decision: string; outcomes: string[] };
export type RelayReport = z.infer<typeof reportSchema>;

export class RelayReportError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'RelayReportError'; }
}

export const parseRelayReport = (value: unknown): RelayReport | null => {
  const result = reportSchema.safeParse(value);
  return result.success ? result.data : null;
};

/** How often two counts match, as a whole percentage; a dash when there is nothing to compare. */
export const agreement = (agreed: number, asked: number): string => asked ? `${Math.round(100 * agreed / asked)}%` : '–';

/** One row for every answer the model gave, then one per confidence level: how many it gave at least that sure, and how many matched. */
export function shadowRows(shadow: RelayShadow) {
  const row = (label: string, asked: number, agreed: number) => ({ label, asked, share: agreement(asked, shadow.asked), agreed, agreement: agreement(agreed, asked) });
  return [row('Any', shadow.asked, shadow.agreed), ...shadow.by_confidence.map(level => row(`${Math.round(level.confidence_at_least * 100)}% or more`, level.asked, level.agreed))];
}

// A service from before request counts sends neither count field: that reads as no requests yet.
// One from before providers sends none: that is an OpenAI gateway. One from before outcomes sends none: nothing counted.
const statusSchema = z.object({ relay_id: z.string().min(1).nullable(), collecting_since: z.string().nullable(), terms_version: z.string().min(1), requests: count.default(0), last_request_at: z.string().nullable().default(null), provider: z.enum(['openai', 'anthropic', 'gemini', 'jev']).default('openai'), outcomes: z.record(z.string(), count).default({}), outcomes_since: z.string().nullable().default(null) });
export type RelayStatus = z.infer<typeof statusSchema>;

export const parseRelayStatus = (value: unknown): RelayStatus | null => {
  const result = statusSchema.safeParse(value);
  return result.success ? result.data : null;
};

// What became of a request that asked a model for a reply, as the service names it: saved, or why not, with what to do about it.
const OUTCOMES: [id: string, label: string, hint: string][] = [
  ['saved', 'Saved', ''],
  ['no_answer', 'Your provider gave no clean answer', 'An error, a refusal, or an answer that was not on the list.'],
  ['no_list', 'No fixed list of answers', 'Plain chat, or JSON without a schema. Ask for an answer from a list, as the cards below show, to have a call collected.'],
  ['stream', 'Streamed', 'An answer is read from a complete reply. Turn streaming off for calls that pick from a list.'],
  ['open_field', 'Answer includes free text or a number', 'Every field of the answer has to be a list or yes/no. Ask for fields such as a reason in a separate call.'],
  ['optional_field', 'An answer field is optional', 'Mark every field of the answer as required.'],
  ['chat_function', 'Function call on Chat Completions', 'A fixed-answer question in a form the gateway does not read yet. Use a schema, or the Responses API.'],
  ['tools', 'The model was free to use tools', 'A step where the model chooses what to do is passed on and not collected.'],
  ['conversation', 'Part of a conversation', 'A request with earlier assistant or tool turns is passed on and not collected.'],
  ['media', 'Images, audio or files', 'Only text is collected.'],
  ['unreadable', 'Could not be read', 'The request was not JSON, or was compressed in a way the gateway does not read.'],
  ['other', 'Other', 'Not a single question with a fixed list of answers.'],
];

/** One row per outcome that happened: saved first, even at zero, then the reasons, most frequent first. A reason this page does not know joins Other. */
export function outcomeRows(outcomes: Record<string, number>) {
  const known = new Set(OUTCOMES.map(([id]) => id));
  const counts: Record<string, number> = {};
  for (const [id, n] of Object.entries(outcomes)) { const to = known.has(id) ? id : 'other'; counts[to] = (counts[to] ?? 0) + n; }
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (!total) return [];
  const row = ([id, label, hint]: (typeof OUTCOMES)[number]) => ({ id, label, hint, count: counts[id] ?? 0, share: agreement(counts[id] ?? 0, total) });
  return [row(OUTCOMES[0]), ...OUTCOMES.slice(1).map(row).filter(found => found.count > 0).sort((a, b) => b.count - a.count)];
}

const rowsSchema = z.object({
  question: z.object({ id: z.string().regex(/^[0-9a-f]{64}$/), instructions: z.string(), fields: z.record(z.string(), z.array(z.union([z.string(), z.boolean()]))) }),
  rows: z.array(z.object({ text: z.string(), answers: z.record(z.string(), z.union([z.string(), z.boolean()])) })), truncated: z.boolean(),
});
export type RelayRows = z.infer<typeof rowsSchema>;
export const parseRelayRows = (value: unknown): RelayRows | null => {
  const result = rowsSchema.safeParse(value);
  return result.success ? result.data : null;
};

/** Saved messages a question needs before the console offers to train from it. */
export const TRAIN_FROM_ROWS = 200;

/**
 * One question's saved rows as the table /train/new works on: the message in a column named text, which is how the
 * gateway's comparison sends it to a model, then one column per answer field. The first field is what it decides;
 * the others are left unused, one decision per run. Instructions too long for a training question are left out.
 */
export function gatewayTable(saved: RelayRows): { data: CsvData; columns: Columns; question: string } {
  const fields = Object.keys(saved.question.fields).filter(name => name !== 'text');
  return {
    data: { headers: ['text', ...fields], rows: saved.rows.map(row => [row.text, ...fields.map(name => String(row.answers[name] ?? ''))]) },
    columns: { decide: fields[0] ?? '', group: '', reads: ['text'], unused: fields.slice(1) },
    question: saved.question.instructions.length <= 1000 ? saved.question.instructions : '',
  };
}

/** The base URL a client is pointed at: the account's relay id under the training service. An OpenAI client is given the /v1 root; a Claude, Gemini or Jev client the API root, and adds the version itself. */
export const relayAddress = (trainingUrl: string, relayId: string, provider: RelayStatus['provider'] = 'openai'): string => `${serviceUrl(trainingUrl)}/relay/${relayId}${provider === 'openai' ? '/v1' : ''}`;

export function relayReportApi(rawUrl: string, token: () => Promise<string>, request: typeof fetch = fetch) {
  const base = serviceUrl(rawUrl);
  async function send<T>(path: string, parse: (value: unknown) => T | null, failed: string, body?: object, signal?: AbortSignal): Promise<T> {
    let accessToken: string;
    try { accessToken = await token(); }
    catch { throw new RelayReportError('Your sign-in session could not be checked. Please try again.', 0); }
    if (!accessToken) throw new RelayReportError('Your session has expired. Please sign in again.', 401);
    const timeout = AbortSignal.timeout(30_000);
    let response: Response;
    try {
      response = await request(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        cache: 'no-store', credentials: 'omit', redirect: 'error',
      });
    } catch { throw new RelayReportError('The service could not be reached. Check your connection and try again.', 0); }
    if (!response.ok) {
      const failure = z.object({ error: z.object({ code: z.string() }) }).safeParse(await response.json().catch(() => null));
      const code = failure.success ? failure.data.error.code : '';
      throw new RelayReportError(
        response.status === 401 ? 'Your session has expired. Please sign in again.'
          : code === 'terms_changed' ? 'The collection terms changed. Read them and agree again.'
          : code === 'no_question' ? 'That gateway question has no saved messages for this account.'
          : code === 'not_ready' ? 'That run’s model is not ready to compare yet.'
          : code === 'no_training' ? 'That run was not trained from a gateway question of this account.'
          : code === 'collection_on' ? 'Stop collecting before changing the provider.'
          : code === 'provider_fixed' ? 'This gateway’s provider is set by Zils. Ask us to change it.'
          : code === 'no_relay' ? 'The gateway is not set up for this account yet.'
          : response.status === 404 ? 'The gateway report is not available here yet.'
          : failed, response.status);
    }
    const result = parse(await response.json().catch(() => null));
    if (!result) throw new RelayReportError('The service returned an unexpected response.', 502);
    return result;
  }
  const unchanged = 'Collection could not be changed. Please try again.';
  const done = (value: unknown) => z.object({ status: z.literal('ok') }).safeParse(value).success ? true as const : null;
  return {
    get: (signal?: AbortSignal) => send('/v1/relay/report', parseRelayReport, 'The report could not be loaded. Please try again.', undefined, signal),
    status: (signal?: AbortSignal) => send('/v1/relay', parseRelayStatus, 'The report could not be loaded. Please try again.', undefined, signal),
    rows: async (question: string, signal?: AbortSignal) => {
      if (!/^[0-9a-f]{64}$/.test(question)) throw new RelayReportError('That gateway question has no saved messages for this account.', 404);
      return send(`/v1/relay/questions/${question}/rows`, parseRelayRows, 'The saved messages could not be loaded. Please try again.', undefined, signal);
    },
    /** Give the account a gateway address unless it has one. It starts as pass-through only. */
    setup: () => send('/v1/relay', parseRelayStatus, 'The gateway could not be set up. Please try again.', {}),
    /** Note that a run was trained from a question's field, with the wording and answers it was trained on. */
    note: (question: string, note: RelayTrainingNote) => send(`/v1/relay/questions/${question}/trainings`, done, 'The run could not be linked to its gateway question.', note),
    /** Make a finished run's model the one compared on the question it was trained from. */
    compare: (jobId: string) => send(`/v1/relay/trainings/${z.string().uuid().parse(jobId)}/compare`, done, 'The model could not be compared. Please try again.', {}),
    /** Point the account's address at another provider it may choose itself. Refused while it collects. */
    provider: (provider: 'openai' | 'anthropic' | 'gemini') => send('/v1/relay/provider', parseRelayStatus, 'The provider could not be changed. Please try again.', { provider }),
    collect: (on: boolean, termsVersion?: string) => send('/v1/relay/collection', parseRelayStatus, unchanged, on ? { collect: true, terms_version: termsVersion } : { collect: false }),
  };
}

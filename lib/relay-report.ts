import { z } from 'zod';
import { serviceUrl } from './training';

const count = z.number().int().nonnegative();
const shadowSchema = z.object({
  field: z.string().min(1), model: z.string().min(1), since: z.string(), asked: count, agreed: count, failed: count,
  by_confidence: z.array(z.object({ confidence_at_least: z.number().min(0).max(1), asked: count, agreed: count })),
});
const questionSchema = z.object({
  id: z.string().min(1), instructions: z.string(), fields: z.record(z.string(), z.array(z.union([z.string(), z.boolean()]))),
  first_at: z.string(), rows: count, last_at: z.string().nullable(), shadows: z.array(shadowSchema),
});
const reportSchema = z.object({ relay: z.boolean(), saving_since: z.string().nullable(), questions_total: count, questions: z.array(questionSchema) });
export type RelayShadow = z.infer<typeof shadowSchema>;
export type RelayQuestion = z.infer<typeof questionSchema>;
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
const statusSchema = z.object({ relay_id: z.string().min(1).nullable(), collecting_since: z.string().nullable(), terms_version: z.string().min(1), requests: count.default(0), last_request_at: z.string().nullable().default(null) });
export type RelayStatus = z.infer<typeof statusSchema>;

export const parseRelayStatus = (value: unknown): RelayStatus | null => {
  const result = statusSchema.safeParse(value);
  return result.success ? result.data : null;
};

/** The base URL an OpenAI client is pointed at: the account's relay id under the training service. */
export const relayAddress = (trainingUrl: string, relayId: string): string => `${serviceUrl(trainingUrl)}/relay/${relayId}/v1`;

/** Ready-made ways to point an OpenAI client at the address. The provider key is left to the app, as it is today. */
export const relaySnippets = (address: string) => [
  { label: 'Environment', language: 'bash' as const, code: `OPENAI_BASE_URL=${address}` },
  { label: 'Python', language: 'python' as const, code: `from openai import OpenAI\n\nclient = OpenAI(base_url="${address}")` },
  { label: 'TypeScript', language: 'javascript' as const, code: `import OpenAI from 'openai';\n\nconst client = new OpenAI({ baseURL: '${address}' });` },
];

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
          : code === 'no_relay' ? 'The gateway is not set up for this account yet.'
          : response.status === 404 ? 'The gateway report is not available here yet.'
          : failed, response.status);
    }
    const result = parse(await response.json().catch(() => null));
    if (!result) throw new RelayReportError('The service returned an unexpected response.', 502);
    return result;
  }
  const unchanged = 'Collection could not be changed. Please try again.';
  return {
    get: (signal?: AbortSignal) => send('/v1/relay/report', parseRelayReport, 'The report could not be loaded. Please try again.', undefined, signal),
    status: (signal?: AbortSignal) => send('/v1/relay', parseRelayStatus, 'The report could not be loaded. Please try again.', undefined, signal),
    collect: (on: boolean, termsVersion?: string) => send('/v1/relay/collection', parseRelayStatus, unchanged, on ? { collect: true, terms_version: termsVersion } : { collect: false }),
  };
}

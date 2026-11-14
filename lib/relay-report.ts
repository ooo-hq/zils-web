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

export function relayReportApi(rawUrl: string, token: () => Promise<string>, request: typeof fetch = fetch) {
  const base = serviceUrl(rawUrl);
  return {
    async get(signal?: AbortSignal): Promise<RelayReport> {
      let accessToken: string;
      try { accessToken = await token(); }
      catch { throw new RelayReportError('Your sign-in session could not be checked. Please try again.', 0); }
      if (!accessToken) throw new RelayReportError('Your session has expired. Please sign in again.', 401);
      const timeout = AbortSignal.timeout(30_000);
      let response: Response;
      try {
        response = await request(`${base}/v1/relay/report`, {
          method: 'GET', headers: { Authorization: `Bearer ${accessToken}` },
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          cache: 'no-store', credentials: 'omit', redirect: 'error',
        });
      } catch { throw new RelayReportError('The service could not be reached. Check your connection and try again.', 0); }
      if (!response.ok) throw new RelayReportError(
        response.status === 401 ? 'Your session has expired. Please sign in again.'
          : response.status === 404 ? 'The gateway report is not available here yet.'
          : 'The report could not be loaded. Please try again.', response.status);
      const report = parseRelayReport(await response.json().catch(() => null));
      if (!report) throw new RelayReportError('The service returned an unexpected response.', 502);
      return report;
    },
  };
}

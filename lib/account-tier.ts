import { z } from 'zod';
import { serviceUrl } from './training';

export const TERMS_PATH = '/free-tier-terms';

const stateSchema = z.object({
  tier: z.enum(['free', 'paid']),
  free: z.object({ open: z.boolean(), requests_per_minute: z.number(), tokens_per_day: z.number(), terms_version: z.string().min(1) }),
  consent: z.object({ at: z.string(), terms_version: z.string() }).nullable(),
});
export type TierState = z.infer<typeof stateSchema>;
type TierCode = 'free_tier_closed' | 'consent_required' | 'terms_changed';

export class TierError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: TierCode) { super(message); this.name = 'TierError'; }
}

export const parseTierState = (value: unknown): TierState | null => {
  const result = stateSchema.safeParse(value);
  return result.success ? result.data : null;
};

/** Free needs a loaded, open tier and a ticked consent box. */
export const canChooseFree = (state: TierState | null, consented: boolean): boolean => !!state && state.free.open && consented;

export function tierErrorAction(error: unknown): 'ask_again' | 'closed' | 'consent' | 'other' {
  const code = error instanceof TierError ? error.code : undefined;
  return code === 'terms_changed' ? 'ask_again' : code === 'free_tier_closed' ? 'closed' : code === 'consent_required' ? 'consent' : 'other';
}

const messages: Record<string, string> = {
  terms_changed: 'The free tier terms changed. Read them and agree again.',
  free_tier_closed: 'Free tier is not open yet.',
  consent_required: 'Tick the box to agree to the terms before choosing Free.',
};

export function tierApi(rawUrl: string, token: () => Promise<string>, request: typeof fetch = fetch) {
  const base = serviceUrl(rawUrl);
  async function send(body?: object, signal?: AbortSignal): Promise<TierState> {
    let accessToken: string;
    try { accessToken = await token(); }
    catch { throw new TierError('Your sign-in session could not be checked. Please try again.', 0); }
    if (!accessToken) throw new TierError('Your session has expired. Please sign in again.', 401);
    const timeout = AbortSignal.timeout(30_000);
    let response: Response;
    try {
      response = await request(`${base}/v1/account/tier`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        cache: 'no-store', credentials: 'omit', redirect: 'error',
      });
    } catch { throw new TierError('The service could not be reached. Check your connection and try again.', 0); }
    if (!response.ok) {
      const failure = z.object({ error: z.object({ code: z.string() }) }).safeParse(await response.json().catch(() => null));
      const raw = failure.success ? failure.data.error.code : '';
      const code = (['terms_changed', 'free_tier_closed', 'consent_required'] as const).find(known => known === raw);
      throw new TierError(code ? messages[code]
        : response.status === 401 ? 'Your session has expired. Please sign in again.'
        : 'The plan could not be changed. Please try again.', response.status, code);
    }
    const state = parseTierState(await response.json().catch(() => null));
    if (!state) throw new TierError('The service returned an unexpected response.', 502);
    return state;
  }
  return {
    get: (signal?: AbortSignal) => send(undefined, signal),
    set: (tier: 'free' | 'paid', consent: boolean, termsVersion: string, signal?: AbortSignal) => send({ tier, consent, terms_version: termsVersion }, signal),
  };
}

import { z } from 'zod';
import { serviceUrl } from './training';

const timestamp = z.string().datetime({ offset: true });
const metadata = z.object({
  id: z.string().uuid(), name: z.string(), prefix: z.string(),
  created_at: timestamp, revoked_at: timestamp.nullable(),
});
const created = metadata.extend({ key: z.string().regex(/^zils_sk_[0-9a-f]{32}_[A-Za-z0-9_-]{43}$/) });
export type ApiKey = z.infer<typeof metadata>;
export type CreatedApiKey = z.infer<typeof created>;

export class ApiKeyError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'ApiKeyError'; }
}

export function decisionApiUrl(trainingUrl: string, override?: string): string {
  return override?.trim() ? serviceUrl(override.trim()) : `${serviceUrl(trainingUrl)}/decision`;
}

export function apiKeysApi(rawUrl: string, token: () => Promise<string>, request: typeof fetch = fetch) {
  const base = serviceUrl(rawUrl);
  async function send<T>(path: string, schema: z.ZodType<T>, body?: object, signal?: AbortSignal): Promise<T> {
    let accessToken: string;
    try { accessToken = await token(); }
    catch { throw new ApiKeyError('Your sign-in session could not be checked. Please try again.', 0); }
    if (!accessToken) throw new ApiKeyError('Your session has expired. Please sign in again.', 401);
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
    } catch {
      throw new ApiKeyError('The key service could not be reached. Check your connection and try again.', 0);
    }
    if (!response.ok) {
      const message = response.status === 401 ? 'Your session has expired. Please sign in again.'
        : response.status === 403 ? 'Your account does not have permission to manage these keys.'
        : response.status === 429 ? 'Too many requests. Wait a moment before trying again.'
        : 'The key service could not complete this request. Please try again.';
      throw new ApiKeyError(message, response.status);
    }
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new ApiKeyError('The key service returned an unexpected response.', 502);
    return parsed.data;
  }
  return {
    list: (signal?: AbortSignal) => send('/v1/keys', z.object({ keys: z.array(metadata) }), undefined, signal),
    create: (name: string, signal?: AbortSignal) => {
      const parsed = z.string().trim().min(1).max(80).safeParse(name);
      if (!parsed.success) return Promise.reject(new ApiKeyError('Give your key a name between 1 and 80 characters.', 400));
      return send('/v1/keys', created, { name: parsed.data }, signal);
    },
    revoke: async (id: string, signal?: AbortSignal) => {
      if (!z.string().uuid().safeParse(id).success) throw new ApiKeyError('Choose a valid key to revoke.', 400);
      const result = await send(`/v1/keys/${id}/revoke`, metadata, {}, signal);
      if (result.id !== id || !result.revoked_at) throw new ApiKeyError('Key revocation could not be confirmed. Refresh the list to check its status.', 502);
      return result;
    },
  };
}

import { z } from 'zod';
import { API_KEY_PATTERN, decisionApiUrl } from './api-keys';
import { parseResponse, type DecisionRequest, type ModelOption } from './playground';
import { serviceUrl } from './training';

export const MAX_BODY_BYTES = 32_768;

// The shared model is deployment configuration: no release ID is built into the site.
export function playgroundConfig(): { configured: boolean; models: ModelOption[] } {
  const model = (process.env.ZILS_DECISION_MODEL ?? process.env.FEZ_DECISION_MODEL) || '';
  const defaultLabel = model === 'fez-0.8b-experimental' ? 'Zils 0.8B · experimental' : model || 'Zils shared';
  const endpoint = process.env.ZILS_DECISION_API_URL ?? process.env.FEZ_DECISION_API_URL;
  const key = process.env.ZILS_DECISION_API_KEY ?? process.env.FEZ_DECISION_API_KEY;
  return {
    configured: Boolean(endpoint && key && model),
    models: [{ id: model, label: (process.env.ZILS_DECISION_LABEL ?? process.env.FEZ_DECISION_LABEL) || defaultLabel }],
  };
}

export class InferenceError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

export async function readLimited(response: Response | Request, max: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > max) throw new InferenceError(max === MAX_BODY_BYTES ? 'Request is too large. Keep state and questions under 32 KB.' : 'The model response was too large.', max === MAX_BODY_BYTES ? 413 : 502);
      text += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

const trainingUrl = () => process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL ?? '';

/** The public decision API customers call; the playground's curl view and own-model runs use it. */
export function userApiUrl(): string | null {
  const training = trainingUrl();
  try { return training ? decisionApiUrl(training, process.env.NEXT_PUBLIC_ZILS_API_URL) : null; } catch { return null; }
}

// Only the fields the ownership check needs, so unrelated job-schema changes cannot block the playground.
const ownedJob = z.object({
  name: z.string(), status: z.string(),
  result: z.object({ delivery: z.object({ status: z.string() }) }).nullable().optional(),
  workflow: z.object({ state: z.string(), model_id: z.string().optional(), model_name: z.string().optional() }).nullable().optional(),
});

/** The signed-in account's ready trained models, as the training dashboard lists them. */
export async function ownedModels(sessionToken: string, send: typeof fetch = fetch): Promise<ModelOption[]> {
  const training = trainingUrl();
  if (!training) return [];
  const response = await send(`${serviceUrl(training)}/v1/jobs`, { headers: { Authorization: `Bearer ${sessionToken}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) { await response.body?.cancel(); throw new InferenceError(response.status === 401 ? 'Your session has expired. Sign in again to continue.' : 'Your models could not be loaded. Try again shortly.', response.status === 401 ? 401 : 503); }
  const parsed = z.object({ jobs: z.array(ownedJob), models: z.array(ownedJob).optional() }).safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new InferenceError('Your models could not be loaded. Try again shortly.');
  return (parsed.data.models ?? parsed.data.jobs)
    // Same rule as the dashboard's model library: an accepted, completed run whose model is ready.
    .filter(job => job.status === 'completed' && job.result?.delivery.status === 'accepted' && job.workflow?.state === 'ready' && job.workflow.model_id)
    .map(job => ({ id: job.workflow!.model_id!, label: job.workflow!.model_name || job.name, own: true }));
}

/**
 * Decides how a playground request is sent. The shared model uses the server key; any other model
 * must be one the signed-in account owns and is sent with the caller's own API key, never the server's.
 */
export async function authorizeModel(model: string, sessionToken: string, apiKey: string | null, send: typeof fetch = fetch): Promise<{ apiKey?: string }> {
  if (model === playgroundConfig().models[0].id) return {};
  if (!(await ownedModels(sessionToken, send)).some(m => m.id === model)) throw new InferenceError('Select the shared model or one of your own ready models.', 403);
  if (!apiKey || !API_KEY_PATTERN.test(apiKey)) throw new InferenceError('Paste one of your API keys to run your own model.', 400);
  return { apiKey };
}

async function check(response: Response, own = false): Promise<Response> {
  if (response.ok) return response;
  await response.body?.cancel();
  if (own && response.status === 401) throw new InferenceError('The Zils API rejected this API key. Check it on the API keys page.', 401);
  if (own && response.status === 402) throw new InferenceError('Add credit to your account to run your own model.', 402);
  if (response.status === 429) throw new InferenceError('The model provider is at its request limit. Wait a minute and try again.', 429);
  if (response.status === 422 || response.status === 400) throw new InferenceError('The model could not process this input. Try a shorter state or fewer questions.', 422);
  throw new InferenceError('The model provider is unavailable. Try again shortly.');
}

export async function infer(request: DecisionRequest, signal: AbortSignal, userKey?: string) {
  const api = userApiUrl();
  const endpoint = userKey ? api && `${api}/v1/systemone` : (process.env.ZILS_DECISION_API_URL ?? process.env.FEZ_DECISION_API_URL);
  const key = userKey ?? process.env.ZILS_DECISION_API_KEY ?? process.env.FEZ_DECISION_API_KEY;
  if (!endpoint || !key) throw new InferenceError('The Zils model endpoint is not connected yet.');
  const options = { signal, cache: 'no-store' as const, redirect: 'error' as const };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  const result = await check(await fetch(endpoint, { ...options, method: 'POST', headers, body: JSON.stringify(request) }), Boolean(userKey));
  const raw: unknown = JSON.parse(await readLimited(result, 1_000_000));
  try {
    const parsed = parseResponse(raw, request);
    if (parsed.model !== request.model) throw new Error('Model mismatch.');
    return parsed;
  }
  catch { throw new InferenceError('The model returned an invalid or incomplete answer. Try again.', 502); }
}

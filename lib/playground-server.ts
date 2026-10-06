import { parseResponse, type DecisionRequest, type ModelOption } from './playground';

export const MAX_BODY_BYTES = 32_768;
const SHARED_MODEL = 'zils-jevk5-v0.3-r1';

export function playgroundConfig(): { configured: boolean; models: ModelOption[] } {
  const model = (process.env.ZILS_DECISION_MODEL ?? process.env.FEZ_DECISION_MODEL) || SHARED_MODEL;
  const defaultLabel = model === SHARED_MODEL ? 'Zils shared · JevK5 4B'
    : model === 'fez-0.8b-experimental' ? 'Zils 0.8B · experimental' : model;
  const endpoint = process.env.ZILS_DECISION_API_URL ?? process.env.FEZ_DECISION_API_URL;
  const key = process.env.ZILS_DECISION_API_KEY ?? process.env.FEZ_DECISION_API_KEY;
  return {
    configured: Boolean(endpoint && key),
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

async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  await response.body?.cancel();
  if (response.status === 429) throw new InferenceError('The model provider is at its request limit. Wait a minute and try again.', 429);
  if (response.status === 422 || response.status === 400) throw new InferenceError('The model could not process this input. Try a shorter state or fewer questions.', 422);
  throw new InferenceError('The model provider is unavailable. Try again shortly.');
}

export async function infer(request: DecisionRequest, signal: AbortSignal) {
  const endpoint = (process.env.ZILS_DECISION_API_URL ?? process.env.FEZ_DECISION_API_URL);
  const key = process.env.ZILS_DECISION_API_KEY ?? process.env.FEZ_DECISION_API_KEY;
  if (!endpoint || !key) throw new InferenceError('The Zils model endpoint is not connected yet.');
  const options = { signal, cache: 'no-store' as const, redirect: 'error' as const };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  const result = await check(await fetch(endpoint, { ...options, method: 'POST', headers, body: JSON.stringify(request) }));
  const raw: unknown = JSON.parse(await readLimited(result, 1_000_000));
  try {
    const parsed = parseResponse(raw, request);
    if (parsed.model !== request.model) throw new Error('Model mismatch.');
    return parsed;
  }
  catch { throw new InferenceError('The model returned an invalid or incomplete answer. Try again.', 502); }
}

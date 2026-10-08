import { z } from 'zod';
import { serviceUrl } from './training';

const probability = z.number().finite().min(0).max(1);
const criteria = z.record(z.string().trim().min(1).max(100), z.json()).refine(value => {
  const keys = Object.keys(value);
  return keys.length >= 2 && keys.length <= 16 && !keys.includes('__unknown__');
}, 'Use 2–16 distinct answers.');
export const imageQuestionSchema = z.object({ type: z.literal('choice'), instructions: z.json().optional(), criteria }).strict();
export type ImageQuestion = z.infer<typeof imageQuestionSchema>;
const requestSchema = z.object({
  model: z.string().min(1).max(128), state: z.union([z.string(), z.record(z.string(), z.json()), z.array(z.json())]),
  questions: z.record(z.string().min(1), imageQuestionSchema).refine(value => Object.keys(value).length === 1),
  images: z.array(z.object({ asset_id: z.string().uuid() }).strict()).length(1),
}).strict();
export type ImageRequest = z.infer<typeof requestSchema>;
const answerSchema = z.object({
  type: z.literal('choice'), choice: z.string(), confidence: probability,
  probabilities: z.record(z.string(), probability).refine(value => Math.abs(Object.values(value).reduce((a, b) => a + b, 0) - 1) <= 1e-6),
  unknown_probability: probability, abstained: z.boolean(),
});
const responseSchema = z.object({ model: z.string(), answers: z.record(z.string(), answerSchema), usage: z.object({ input_tokens: z.number().int().min(0).max(4096), output_tokens: z.literal(0) }) });
export type ImageResponse = z.infer<typeof responseSchema>;
export type ImageAnswer = z.infer<typeof answerSchema>;
const assetSchema = z.object({ id: z.string().uuid(), state: z.enum(['uploading', 'verifying', 'ready', 'failed', 'expired', 'deleted']), sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional(), expires_at: z.string().datetime({ offset: true }) });
export type ImageAsset = z.infer<typeof assetSchema>;
const uploadSchema = z.object({ url: z.string().url(), method: z.literal('PUT'), headers: z.object({ 'x-upsert': z.literal('false'), 'Content-Type': z.literal('application/octet-stream') }).strict() });
const modelsSchema = z.object({ models: z.array(z.object({ name: z.string(), stock: z.boolean(), capabilities: z.object({ modalities: z.array(z.string()) }), question: imageQuestionSchema.optional() })), training_enabled: z.boolean(), training_profile: z.object({ model: z.literal('imajev-4b-v1'), max_train: z.number().int().positive(), max_calibration: z.number().int().positive(), max_test: z.number().int().positive(), max_source_bytes: z.number().int().positive(), max_pixels: z.number().int().positive(), max_edge: z.number().int().positive() }).optional() });
export type ImageModels = z.infer<typeof modelsSchema>;
export type ImageAssetInput = { purpose: 'prediction' | 'training'; job_id?: string; filename: string; source_bytes: number; source_sha256: string };
export class ImageApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'ImageApiError'; }
}
export function parseImageResponse(value: unknown, request: ImageRequest): ImageResponse {
  const result = responseSchema.parse(value);
  const ids = Object.keys(request.questions);
  if (Object.keys(result.answers).length !== 1 || !result.answers[ids[0]]) throw new Error('Image answer is incomplete.');
  const answer = result.answers[ids[0]], expected = Object.keys(request.questions[ids[0]].criteria);
  if (Object.keys(answer.probabilities).length !== expected.length || !expected.every(key => Object.hasOwn(answer.probabilities, key)) || !expected.includes(answer.choice)) throw new Error('Image answer does not match the requested choices.');
  return result;
}
export function imageAnswerLabel(answer: ImageAnswer): string { return answer.abstained ? 'Needs review' : answer.choice; }
export function imageQuestion(instructions: string, answers: string): ImageQuestion {
  const values = answers.split('\n').map(value => value.trim()).filter(Boolean);
  if (new Set(values).size !== values.length) throw new Error('Use each possible answer only once.');
  const parsed = imageQuestionSchema.safeParse({ type: 'choice', instructions: instructions.trim(), criteria: Object.fromEntries(values.map(value => [value, null])) });
  if (!parsed.success) throw new Error('Use 2–16 different answers, each 1–100 characters. The answer __unknown__ is reserved.');
  return parsed.data;
}
export async function imageDigest(file: Blob): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(n => n.toString(16).padStart(2, '0')).join('');
}
export function imageApi(baseUrl: string, storageUrl: string, token: () => Promise<string>, request: typeof fetch = fetch) {
  const base = serviceUrl(baseUrl), storageOrigin = new URL(serviceUrl(storageUrl)).origin;
  async function send<T>(path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
    const current = await token();
    if (!current) throw new ImageApiError('Your session has expired. Please sign in again.', 401);
    const response = await request(base + path, { method, body: method === 'DELETE' || body === undefined ? undefined : JSON.stringify(body), headers: { Authorization: `Bearer ${current}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000) });
    if (!response.ok) {
      const message = response.status === 401 ? 'Your session has expired. Please sign in again.' : response.status === 429 ? 'Image upload allowance reached. Remove unused photos or try again later.' : response.status === 422 ? 'This photo or question could not be processed. Choose a complete JPEG or PNG and 2–16 answers.' : response.status === 404 ? 'This image or model is no longer available. Try uploading the photo again.' : 'Image service is unavailable. Please try again.';
      throw new ImageApiError(message, response.status);
    }
    return schema.parse(response.status === 204 ? {} : await response.json());
  }
  const idPath = (id: string) => `/v1/image-assets/${z.string().uuid().parse(id)}`;
  return {
    models: (signal?: AbortSignal) => send('/v1/image-models', modelsSchema, undefined, signal),
    createAsset: (input: ImageAssetInput, signal?: AbortSignal) => send('/v1/image-assets', z.object({ asset: assetSchema, upload: uploadSchema }), input, signal),
    completeAsset: (id: string, signal?: AbortSignal) => send(`${idPath(id)}/complete`, assetSchema, {}, signal),
    resumeAsset: (id: string, signal?: AbortSignal) => send(`${idPath(id)}/resume`, z.object({ asset: assetSchema, uploaded: z.boolean(), upload: uploadSchema.optional() }), {}, signal),
    deleteAsset: (id: string, signal?: AbortSignal) => send(idPath(id), z.object({}), undefined, signal, 'DELETE'),
    upload: async (descriptor: z.infer<typeof uploadSchema>, file: Blob, signal?: AbortSignal) => {
      const slot = uploadSchema.parse(descriptor), url = new URL(slot.url);
      if (url.origin !== storageOrigin || url.username || url.password || url.hash || !url.pathname.startsWith('/storage/v1/object/upload/sign/zils-images/')) throw new ImageApiError('Upload destination could not be verified.', 502);
      const response = await request(slot.url, { method: 'PUT', headers: slot.headers, body: file, credentials: 'omit', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000) });
      if (!response.ok) throw new ImageApiError('Photo upload was interrupted. Retry to create a new private upload.', response.status);
    },
    predict: async (input: ImageRequest, signal?: AbortSignal) => {
      const body = requestSchema.parse(input);
      return parseImageResponse(await send('/v1/image-decisions', z.unknown(), body, signal), body);
    },
  };
}

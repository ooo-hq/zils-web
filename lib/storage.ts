import { z } from 'zod';

export type StorageLocations = { legacyOrigin: string; spacesOrigin?: string };
export type StorageUse = 'image-upload' | 'dataset-upload' | 'model-download';

function origin(raw: string): string {
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.hostname.includes('*') || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Storage requires an exact HTTPS origin.');
  return url.origin;
}

export function storageLocations(legacyUrl: string, spacesUrl?: string): StorageLocations {
  const legacyOrigin = origin(legacyUrl);
  const spacesOrigin = spacesUrl ? origin(spacesUrl) : undefined;
  if (legacyOrigin === spacesOrigin) throw new Error('Storage providers require separate origins.');
  return { legacyOrigin, ...(spacesOrigin ? { spacesOrigin } : {}) };
}

const uuid = '[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const artifact = '(?:adapter_config\\.json|adapter_model\\.safetensors|head\\.pt|model\\.json|release\\.json|decision_readout\\.json|decision_readout\\.safetensors)';
const paths: Record<StorageUse, string> = {
  'image-upload': `zils-images/${uuid}/${uuid}/source`,
  'dataset-upload': `fez-training-data/${uuid}/inputs/(?:train|calibration|test)\\.jsonl`,
  'model-download': `fez-training-models/${uuid}/releases/${uuid}/${artifact}`,
};

export function storageUrl(raw: string, locations: StorageLocations, use: StorageUse): URL {
  const rawPath = /^[a-z][a-z\d+.-]*:\/\/[^/?#]+([^?#]*)/i.exec(raw)?.[1];
  // Check before URL parsing normalizes dot segments or backslashes.
  if (rawPath === undefined || /[%\\\x00-\x20\x7f]/.test(rawPath) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath)) throw new Error('Storage path could not be verified.');
  const url = new URL(raw);
  const legacy = url.origin === locations.legacyOrigin;
  const spaces = Boolean(locations.spacesOrigin && url.origin === locations.spacesOrigin);
  if ((!legacy && !spaces) || url.username || url.password || url.hash) throw new Error('Storage destination could not be verified.');
  const prefix = legacy ? `/storage/v1/object/${use === 'model-download' ? 'sign' : 'upload/sign'}/` : `/objects/${uuid}/`;
  if (!new RegExp(`^${prefix}${paths[use]}$`).test(url.pathname)) throw new Error('Storage path could not be verified.');
  const names = [...url.searchParams.keys()];
  if (new Set(names).size !== names.length) throw new Error('Storage grant could not be verified.');
  if (spaces && use !== 'model-download') {
    if (url.searchParams.get('partNumber') !== '1' || !url.searchParams.get('uploadId')) throw new Error('Storage upload could not be verified.');
  } else if (url.searchParams.has('uploadId') || url.searchParams.has('partNumber')) throw new Error('Storage grant could not be verified.');
  return url;
}

export const uploadSchema = z.union([
  z.object({ url: z.string().url(), method: z.literal('PUT'), provider: z.literal('supabase').optional(), expires_at: z.string().datetime({ offset: true }).optional(), headers: z.object({ 'Content-Type': z.literal('application/octet-stream'), 'x-upsert': z.literal('false') }).strict() }).strict(),
  z.object({ url: z.string().url(), method: z.literal('PUT'), provider: z.literal('spaces'), expires_at: z.string().datetime({ offset: true }), headers: z.object({ 'Content-Type': z.literal('application/octet-stream') }).strict() }).strict(),
]);
export type UploadDescriptor = z.infer<typeof uploadSchema>;

export function uploadDescriptor(raw: unknown, locations: StorageLocations, use: 'image-upload' | 'dataset-upload'): UploadDescriptor {
  const slot = uploadSchema.parse(raw);
  const url = storageUrl(slot.url, locations, use);
  if ((slot.provider === 'spaces') !== (url.origin === locations.spacesOrigin) || (slot.expires_at && Date.parse(slot.expires_at) <= Date.now())) throw new Error('Storage grant is expired or could not be verified.');
  return slot;
}

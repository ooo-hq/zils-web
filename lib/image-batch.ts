import { imageAnswerLabel, imageDigest, ImageApiError, type imageApi, type ImageQuestion, type ImageResponse } from './images';

export const MAX_IMAGE_BATCH = 100;
export type ImageBatchRow = { id: string; filename: string; file: File; response?: ImageResponse; error?: string };
type BatchOptions = {
  api: ReturnType<typeof imageApi>; model: string; question: ImageQuestion; signal: AbortSignal;
  onResult: (row: ImageBatchRow) => void; onProgress?: (filename: string, done: number, total: number) => void;
};

// Each image keeps its own asset and response. Completed rows are never rerun by Resume.
export async function runImageBatch(rows: ImageBatchRow[], options: BatchOptions) {
  if (!rows.length || rows.length > MAX_IMAGE_BATCH) throw new Error(`Choose between 1 and ${MAX_IMAGE_BATCH} images.`);
  const { api, model, question, signal, onResult, onProgress } = options;
  let done = rows.filter(row => row.response).length;
  for (const row of rows) {
    signal.throwIfAborted();
    if (row.response) continue;
    let assetId: string | undefined;
    onProgress?.(row.filename, done, rows.length);
    try {
      const digest = await imageDigest(row.file);
      signal.throwIfAborted();
      const slot = await api.createAsset({ purpose: 'prediction', filename: row.filename, source_bytes: row.file.size, source_sha256: digest }, signal);
      assetId = slot.asset.id;
      signal.throwIfAborted();
      await api.upload(slot.upload, row.file, signal);
      const asset = await api.completeAsset(assetId, signal);
      if (asset.state !== 'ready') throw new Error('Photo is still being checked. Retry this image shortly.');
      signal.throwIfAborted();
      const response = await api.predict({ model, state: {}, questions: { inspection: question }, images: [{ asset_id: assetId }] }, signal);
      signal.throwIfAborted();
      onResult({ ...row, response, error: undefined });
    } catch (error) {
      signal.throwIfAborted();
      onResult({ ...row, error: error instanceof Error ? error.message : 'This image could not be analyzed.' });
      // A shared authentication or quota failure needs attention before more uploads.
      if (error instanceof ImageApiError && [401, 403, 429].includes(error.status)) throw error;
    } finally {
      if (assetId) await api.deleteAsset(assetId).catch(() => {});
    }
    done++;
  }
}

export function imageBatchCsv(rows: ImageBatchRow[]): string {
  const cell = (value: string | number) => {
    const text = String(value), safe = /^\s*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const table: (string | number)[][] = [['filename', 'status', 'answer', 'confidence', 'model', 'error']];
  for (const row of rows) {
    const answer = row.response && Object.values(row.response.answers)[0];
    table.push([row.filename, answer ? answer.abstained ? 'Needs review' : 'Completed' : row.error ? 'Failed' : 'Pending', answer ? imageAnswerLabel(answer) : '', answer?.confidence ?? '', row.response?.model ?? '', row.error || '']);
  }
  return table.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

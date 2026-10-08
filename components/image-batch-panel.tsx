'use client';

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { imageApi, imageAnswerLabel, imageQuestion, type ImageQuestion } from '@/lib/images';
import { imageBatchCsv, MAX_IMAGE_BATCH, runImageBatch, type ImageBatchRow } from '@/lib/image-batch';
import styles from './image-decision-panel.module.css';

type Props = { token: () => Promise<string>; apiUrl: string; storageUrl: string; modelId?: string; question?: ImageQuestion };
export function ImageBatchPanel({ token, apiUrl, storageUrl, modelId, question }: Props) {
  const id = useId();
  const api = useMemo(() => imageApi(apiUrl, storageUrl, token), [apiUrl, storageUrl, token]);
  const [model, setModel] = useState(modelId || '');
  const [rows, setRows] = useState<ImageBatchRow[]>([]);
  const [instructions, setInstructions] = useState(typeof question?.instructions === 'string' ? question.instructions : '');
  const [answers, setAnswers] = useState(question ? Object.keys(question.criteria).join('\n') : 'Normal\nDamaged');
  const [busy, setBusy] = useState(false), [checking, setChecking] = useState(false), [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(''), [error, setError] = useState(''), [page, setPage] = useState(0);
  const operation = useRef<AbortController | null>(null), generation = useRef({ value: 0 });
  const alive = useRef(false);
  const complete = rows.filter(row => row.response).length;
  const failures = rows.filter(row => row.error).length;
  const remaining = rows.length - complete;
  const csvUrl = useMemo(() => `data:text/csv;charset=utf-8,${encodeURIComponent(imageBatchCsv(rows))}`, [rows]);
  useEffect(() => {
    alive.current = true;
    const counter = generation.current;
    const controller = new AbortController();
    if (!modelId) api.models(controller.signal).then(data => {
      if (controller.signal.aborted) return;
      const stock = data.models.find(value => value.stock);
      if (stock) setModel(stock.name); else setError('Image prediction is unavailable. Please try again later.');
    }).catch(() => { if (!controller.signal.aborted) setError('Image prediction is unavailable. Please try again later.'); });
    return () => { alive.current = false; counter.value++; controller.abort(); operation.current?.abort(); };
  }, [api, modelId]);

  async function choose(files: FileList | null) {
    if (!files?.length || busy) return;
    const version = ++generation.current.value;
    setChecking(true); setError(''); setRows([]); setStarted(false); setProgress(''); setPage(0);
    try {
      // A folder may contain labels or OS metadata alongside its images.
      const photos = Array.from(files).filter(file => /\.(jpe?g|png)$/i.test(file.name));
      if (!photos.length || photos.length > MAX_IMAGE_BATCH) throw new Error(`Choose between 1 and ${MAX_IMAGE_BATCH} JPEG or PNG images.`);
      const next: ImageBatchRow[] = [];
      for (const [index, file] of photos.entries()) {
        if (!['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: use a JPEG or PNG up to 10 MB.`);
        const bitmap = await createImageBitmap(file).catch(() => { throw new Error(`${file.name}: this photo could not be read.`); });
        const valid = bitmap.width <= 8192 && bitmap.height <= 8192 && bitmap.width * bitmap.height <= 16_000_000;
        bitmap.close();
        if (!valid) throw new Error(`${file.name}: use at most 16 million pixels and 8,192 pixels per edge.`);
        if (version !== generation.current.value || !alive.current) return;
        next.push({ id: String(index), filename: file.webkitRelativePath || file.name, file });
      }
      setRows(next);
    } catch (error) { if (version === generation.current.value && alive.current) setError(error instanceof Error ? error.message : 'Images could not be read.'); }
    finally { if (version === generation.current.value && alive.current) setChecking(false); }
  }
  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!rows.length || !remaining || !model || busy || checking) return;
    let decision: ImageQuestion;
    try {
      decision = question || imageQuestion(instructions, answers);
      if (!String(decision.instructions || '').trim()) throw new Error('Describe the decision you want to make.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Check the decision and possible answers.'); return; }
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setStarted(true); setError('');
    try {
      await runImageBatch(rows, { api, model, question: decision, signal: controller.signal,
        onProgress: (filename, done, total) => { if (!controller.signal.aborted) setProgress(`Processing ${done + 1} of ${total}: ${filename}`); },
        onResult: updated => { if (!controller.signal.aborted) setRows(old => old.map(row => row.id === updated.id ? updated : row)); },
      });
      if (alive.current && !controller.signal.aborted) setProgress('Batch finished. Review the results below.');
    } catch (error) {
      if (alive.current) {
        setProgress(controller.signal.aborted ? 'Stopped. Completed results are saved here. Resume to process the remaining images.' : 'Batch paused. Completed results are saved here.');
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'The batch could not finish.');
      }
    } finally { if (alive.current) setBusy(false); operation.current = null; }
  }
  return <section className={styles.panel} aria-labelledby={`${id}-title`}>
    <div className={styles.heading}><h2 id={`${id}-title`}>{modelId ? 'Use your image model' : 'Test a batch of images'}</h2><p>{modelId ? 'Process new photos with your trained model and download the answers.' : 'See how the starting model handles your images before training.'}</p></div>
    <form onSubmit={analyze} className={styles.form}>
      <div className={styles.photo}>
        <label htmlFor={`${id}-photos`}>Images to analyze</label><input id={`${id}-photos`} type="file" multiple accept="image/jpeg,image/png" disabled={busy || checking} onChange={event => void choose(event.target.files)} />
        <label htmlFor={`${id}-folder`}>Or choose an image folder</label><input id={`${id}-folder`} type="file" multiple {...{ webkitdirectory: '' }} disabled={busy || checking} onChange={event => void choose(event.target.files)} />
        <p className={styles.hint}>Up to {MAX_IMAGE_BATCH} JPEG or PNG images, 10 MB each. No labels needed. Non-image files in a folder are skipped.</p>
        <p className={styles.hint}>Keep this page open while processing. Download your results before leaving. Uploaded photos are removed after each attempt; any interrupted cleanup expires within 24 hours.</p>
        {checking && <p role="status">Checking selected images…</p>}
        {rows.length > 0 && <p>{rows.length} images selected. {started && `${complete} completed · ${failures} failed · ${rows.length - complete - failures} pending`}</p>}
      </div>
      <div className={styles.fields}>
        <label htmlFor={`${id}-question`}>Batch image decision</label><textarea id={`${id}-question`} rows={3} value={instructions} readOnly={Boolean(question) || started} onChange={event => setInstructions(event.target.value)} placeholder="Is this product damaged?" required disabled={busy} />
        <label htmlFor={`${id}-answers`}>Batch possible answers</label><textarea id={`${id}-answers`} rows={3} value={answers} readOnly={Boolean(question) || started} onChange={event => setAnswers(event.target.value)} required disabled={busy} />
        <p className={styles.hint}>{question ? 'Uses the decision and answers saved with your model.' : started ? 'Choose a new set of images to change the decision. Resuming keeps the same question.' : 'One answer per line. Use 2–16 answers.'}</p>
        <button type="submit" disabled={!rows.length || !model || !remaining || busy || checking}>{busy ? 'Processing images…' : started ? remaining ? `Resume ${remaining} remaining` : 'Batch complete' : `Analyze ${rows.length || ''} images`}</button>
        {busy && <button type="button" className={styles.secondaryButton} onClick={() => operation.current?.abort()}>Stop batch</button>}
        {progress && <p role="status">{progress}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
    </form>
    {rows.length > 0 && <div className={styles.batchResults}>
      <div className={styles.resultHeading}><h3>Image results</h3>{started && <a href={csvUrl} download="image-results.csv">Download results CSV</a>}</div>
      <div className={styles.resultTable} role="region" aria-label="Batch image results" tabIndex={0}><table><thead><tr><th>Image</th><th>Answer</th><th>Status</th></tr></thead><tbody>{rows.slice(page * 20, page * 20 + 20).map(row => {
        const answer = row.response && Object.values(row.response.answers)[0];
        return <tr key={row.id}><th>{row.filename}</th><td>{answer ? imageAnswerLabel(answer) : '—'}</td><td>{answer ? answer.abstained ? 'Needs review' : 'Completed' : row.error || 'Pending'}</td></tr>;
      })}</tbody></table></div>
      {rows.length > 20 && <div className={styles.resultHeading}><button disabled={!page} onClick={() => setPage(page - 1)}>Previous images</button><span>Page {page + 1} of {Math.ceil(rows.length / 20)}</span><button disabled={(page + 1) * 20 >= rows.length} onClick={() => setPage(page + 1)}>Next images</button></div>}
    </div>}
  </section>;
}

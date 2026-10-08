'use client';

import Link from 'next/link';

import Image from 'next/image';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { imageApi, imageAnswerLabel, imageDigest, imageQuestion, ImageApiError, type ImageQuestion, type ImageResponse } from '@/lib/images';
import styles from './image-decision-panel.module.css';
import { ImageBatchPanel } from './image-batch-panel';

type Props = { owner: string; token: () => Promise<string>; apiUrl: string; storageUrl: string; modelId?: string; question?: ImageQuestion };
export function ImageDecisionPanel(props: Props) { return <ImageTools key={`${props.owner}:${props.modelId || 'stock'}`} {...props} />; }
function ImageTools(props: Props) {
  const [mode, setMode] = useState<'batch' | 'single'>('batch');
  const id = useId();
  return <div>
    <div role="group" aria-label="Image testing mode" className={styles.tabs}>
      <button aria-pressed={mode === 'batch'} aria-controls={`${id}-batch`} onClick={() => setMode('batch')}>Batch images</button>
      <button aria-pressed={mode === 'single'} aria-controls={`${id}-single`} onClick={() => setMode('single')}>One image</button>
    </div>
    <div id={`${id}-batch`} hidden={mode !== 'batch'}><ImageBatchPanel {...props} /></div>
    <div id={`${id}-single`} hidden={mode !== 'single'}><ImagePanel {...props} /></div>
  </div>;
}
function ImagePanel({ token, apiUrl, storageUrl, modelId, question }: Props) {
  const panelId = useId();
  const api = useMemo(() => imageApi(apiUrl, storageUrl, token), [apiUrl, storageUrl, token]);
  const [model, setModel] = useState(modelId || '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [instructions, setInstructions] = useState(typeof question?.instructions === 'string' ? question.instructions : '');
  const [answers, setAnswers] = useState(question ? Object.keys(question.criteria).join('\n') : 'Normal\nDamaged');
  const [state, setState] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [needsCredit, setNeedsCredit] = useState(false);
  const [result, setResult] = useState<ImageResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const thumbnail = useRef('');
  const draft = useRef<{ id: string; ready: boolean; uploaded: boolean } | null>(null);
  const generation = useRef({ value: 0 });
  useEffect(() => {
    const controller = new AbortController();
    const counter = generation.current;
    if (!modelId) api.models(controller.signal).then(data => {
      const stock = data.models.find(value => value.stock);
      if (!controller.signal.aborted) { if (stock) setModel(stock.name); else setError('Image prediction is unavailable. Please try again later.'); }
    }).catch(() => { if (!controller.signal.aborted) setError('Image prediction is unavailable. Please try again later.'); });
    return () => { controller.abort(); operation.current?.abort(); counter.value++; URL.revokeObjectURL(thumbnail.current); if (draft.current) void api.deleteAsset(draft.current.id).catch(() => {}); };
  }, [api, modelId]);

  async function choose(next: File | undefined) {
    const revision = ++generation.current.value;
    operation.current?.abort(); setBusy(false); setProgress(''); setError(''); setResult(null); setFile(null);
    URL.revokeObjectURL(thumbnail.current); thumbnail.current = ''; setPreview('');
    if (draft.current) { void api.deleteAsset(draft.current.id).catch(() => {}); draft.current = null; }
    if (!next) return;
    try {
      if (!['image/jpeg', 'image/png'].includes(next.type) || next.size > 10 * 1024 * 1024) throw new Error('Choose a JPEG or PNG up to 10 MB.');
      const bitmap = await createImageBitmap(next).catch(() => { throw new Error('This photo could not be read. Choose a complete JPEG or PNG.'); });
      const valid = bitmap.width <= 8192 && bitmap.height <= 8192 && bitmap.width * bitmap.height <= 16_000_000;
      bitmap.close();
      if (!valid) throw new Error('Choose a JPEG or PNG up to 16 million pixels and 8,192 pixels per edge.');
      if (revision !== generation.current.value) return;
      thumbnail.current = URL.createObjectURL(next); setPreview(thumbnail.current); setFile(next);
    } catch (error) { if (revision === generation.current.value) setError(error instanceof Error ? error.message : 'Photo could not be read.'); }
  }
  async function analyze(event: FormEvent) {
    event.preventDefault(); if (!file || !model || busy) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError(''); setResult(null);
    try {
      const decision = question || imageQuestion(instructions, answers);
      if (!String(decision.instructions || '').trim()) throw new Error('Describe the decision you want to make.');
      let context;
      try { context = state.trim() ? JSON.parse(state) : {}; } catch { throw new Error('Additional information must be valid JSON.'); }
      if (context === null || !['object', 'string'].includes(typeof context)) throw new Error('Additional information must be a JSON object, list or text.');
      if (!draft.current) {
        setProgress('Preparing photo…');
        const hash = await imageDigest(file); controller.signal.throwIfAborted();
        const slot = await api.createAsset({ purpose: 'prediction', filename: file.name, source_bytes: file.size, source_sha256: hash }, controller.signal);
        controller.signal.throwIfAborted(); draft.current = { id: slot.asset.id, uploaded: false, ready: false };
        setProgress('Uploading photo…');
        try { await api.upload(slot.upload, file, controller.signal); }
        catch (error) { void api.deleteAsset(slot.asset.id).catch(() => {}); draft.current = null; throw error; }
        controller.signal.throwIfAborted(); draft.current.uploaded = true;
      }
      if (!draft.current.ready) {
        setProgress('Checking photo…');
        const ready = await api.completeAsset(draft.current.id, controller.signal);
        if (ready.state !== 'ready') throw new Error('Photo is still being checked. Try again shortly.');
        controller.signal.throwIfAborted(); draft.current.ready = true;
      }
      setProgress('Analyzing image…');
      const answer = await api.predict({ model, state: context, questions: { inspection: decision }, images: [{ asset_id: draft.current.id }] }, controller.signal);
      if (!controller.signal.aborted) { setResult(answer); setProgress(''); }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof ImageApiError && [404, 422].includes(error.status) && draft.current) { void api.deleteAsset(draft.current.id).catch(() => {}); draft.current = null; }
        setNeedsCredit(error instanceof ImageApiError && error.status === 402); setError(error instanceof Error ? error.message : 'Image could not be analyzed. Please retry.'); setProgress('');
      }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const answer = result && Object.values(result.answers)[0];
  return <section className={styles.panel} aria-labelledby={`${panelId}-title`}>
    <div className={styles.heading}><span>Images</span><h2 id={`${panelId}-title`}>{modelId ? 'Try your image model.' : 'Try an image.'}</h2><p>{modelId ? 'Your saved decision and answers are fixed for this model.' : 'Choose a photo and describe the decision. Zils picks from your possible answers.'}</p></div>
    <form onSubmit={analyze} className={styles.form}>
      <div className={styles.photo}>
        <label htmlFor={`${panelId}-photo`}>Photo</label><input id={`${panelId}-photo`} disabled={busy} type="file" accept="image/jpeg,image/png" onChange={event => void choose(event.target.files?.[0])} />
        <p className={styles.hint}>One JPEG or PNG, up to 10 MB. Your photo is private and expires after 24 hours.</p>
        {preview && <figure>{/* Local object URL; the full original file goes to private Storage. */}<Image src={preview} alt="Selected photo preview" width={800} height={600} unoptimized /><figcaption>{file?.name}</figcaption></figure>}
      </div>
      <div className={styles.fields}>
        <label htmlFor={`${panelId}-question`}>Image decision</label><textarea id={`${panelId}-question`} rows={3} value={instructions} readOnly={Boolean(question)} onChange={event => setInstructions(event.target.value)} placeholder="Is this product damaged?" required disabled={busy} />
        <label htmlFor={`${panelId}-answers`}>Possible answers</label><textarea id={`${panelId}-answers`} rows={3} value={answers} readOnly={Boolean(question)} onChange={event => setAnswers(event.target.value)} required disabled={busy} /><p className={styles.hint}>One answer per line. Use 2–16 answers.</p>
        <details><summary>Additional information</summary><label htmlFor={`${panelId}-state`}>Structured context (optional JSON)</label><textarea id={`${panelId}-state`} rows={3} value={state} onChange={event => setState(event.target.value)} placeholder={'{"product": "headphones"}'} disabled={busy} /></details>
        <button type="submit" disabled={!file || !model || busy}>{busy ? 'Working…' : 'Analyze image'}</button>
        {progress && <p role="status">{progress}</p>}{error && <p role="alert" className={styles.error}>{error}{needsCredit && <> <Link href="/billing" target="_blank" rel="noopener noreferrer">Add credit</Link>.</>}</p>}
      </div>
    </form>
    {answer && <div role="status" className={styles.result} data-review={answer.abstained}><span>Result</span><strong data-testid="image-answer">{imageAnswerLabel(answer)}</strong><p>{answer.abstained ? 'The model could not choose an answer reliably. Send this image for a person to review.' : 'Check important decisions against your own review process.'}</p></div>}
  </section>;
}

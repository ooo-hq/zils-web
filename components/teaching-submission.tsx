'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/components/auth-session';
import { imageApi, ImageApiError, type ImageQuestion } from '@/lib/images';
import { uploadImageTraining, type ImageDraft, type PreparedImageTraining } from '@/lib/image-training';
import { SPLITS, submissionSchema, trainingApi, TrainingApiError, validateDatasets, type Split, type Submission } from '@/lib/training';
import type { TrainingConfig } from '@/lib/training-config';
import s from './teach-by-example.module.css';

export type TeachingTrainingData = { kind: 'text'; files: Record<Split, File> } | { kind: 'image'; prepared: PreparedImageTraining; question: ImageQuestion };
type Props = {
  config?: TrainingConfig | null;
  prepare: (name: string) => Promise<TeachingTrainingData>;
  onLock: (locked: boolean) => void;
  imageAnswers?: string[];
  initialName?: string;
  initialAccuracy?: string;
  initialImprovement?: string;
};

export function TeachingSubmission({ config, prepare, onLock, imageAnswers, initialName = '', initialAccuracy = '80', initialImprovement = '0.01' }: Props) {
  const { client, session, error: sessionError } = useAuthSession(config ?? undefined);
  const router = useRouter(), id = useId();
  const [name, setName] = useState(initialName), [accuracy, setAccuracy] = useState(initialAccuracy), [improvement, setImprovement] = useState(initialImprovement);
  const [consent, setConsent] = useState(false), [comparison, setComparison] = useState(false);
  const [busy, setBusy] = useState(false), [frozen, setFrozen] = useState(false), [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(''), [progress, setProgress] = useState(''), [needsCredit, setNeedsCredit] = useState(false);
  const [savedId, setSavedId] = useState(''), [savedOwner, setSavedOwner] = useState('');
  const draft = useRef<ImageDraft>({ assets: {} });
  const snapshot = useRef<{ owner: string; input: Submission; data: TeachingTrainingData } | null>(null);
  const operation = useRef<AbortController | null>(null), attemptedCreate = useRef(false);
  const accountChanged = Boolean(savedOwner && session?.user.id !== savedOwner);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => { if (accountChanged) operation.current?.abort(); }, [accountChanged]);
  useEffect(() => {
    if (!busy && !savedId && !uncertain) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy, savedId, uncertain]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (operation.current || uncertain || !config || !client || !session || accountChanged) return;
    setError(''); setNeedsCredit(false);
    if (!consent) { setError('Confirm permission to share the training examples.'); return; }
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); onLock(true);
    try {
      if (!snapshot.current) {
        const input = submissionSchema.parse({ name, acceptance: { min_accuracy: accuracy.trim() ? Number(accuracy) / 100 : NaN, min_brier_improvement: improvement.trim() ? Number(improvement) : NaN }, allow_training_data_export: true, ...(comparison && !imageAnswers ? { allow_jev_comparison: true } : {}) });
        setProgress('Checking your training data locally…');
        const data = await prepare(input.name);
        if (data.kind === 'text') await validateDatasets(data.files, controller.signal);
        controller.signal.throwIfAborted();
        snapshot.current = { owner: session.user.id, input, data };
        setSavedOwner(session.user.id);
      }
      const { owner, input, data } = snapshot.current;
      const token = async () => {
        const current = await client.auth.getSession();
        if (current.error) throw current.error;
        if (current.data.session?.user.id !== owner) throw new TrainingApiError('Sign in to the account that prepared this run before continuing.', 401);
        return current.data.session.access_token;
      };
      const api = trainingApi(config.apiUrl, config.storage, token);
      const update = (text: string) => { if (!controller.signal.aborted) setProgress(text); };
      let job;
      if (data.kind === 'image') {
        if (!config.decisionApiUrl) throw new Error('Image training is not connected in this environment.');
        const images = imageApi(config.decisionApiUrl, config.storage, token);
        const models = await images.models(controller.signal), profile = models.training_profile;
        if (!models.training_enabled || !profile) throw new Error('Image training is unavailable right now. Your photos are still in this tab.');
        for (const split of SPLITS) {
          if (data.prepared.counts[split] > profile[`max_${split}`]) throw new Error(`${split} exceeds the current photo limit.`);
          for (const row of data.prepared.splits[split]) {
            if (row.file.size > profile.max_source_bytes) throw new Error(`${row.filename} exceeds the current photo size limit.`);
            const bitmap = await createImageBitmap(row.file);
            const valid = bitmap.width <= profile.max_edge && bitmap.height <= profile.max_edge && bitmap.width * bitmap.height <= profile.max_pixels;
            bitmap.close();
            if (!valid) throw new Error(`${row.filename} exceeds the current photo dimensions.`);
          }
        }
        job = await uploadImageTraining(data.prepared, data.question, { ...input, model: profile.model }, {
          ...api, createImage: async (...args) => { attemptedCreate.current = true; return api.createImage(...args); },
        }, images, draft.current, controller.signal, update);
      } else {
        if (draft.current.job) {
          const current = (await api.get(draft.current.job.id, controller.signal)).job;
          if (current.id !== draft.current.job.id) throw new Error('The service returned a different run. Open your saved run to check its status.');
          draft.current.job = current;
        }
        if (!draft.current.job || draft.current.job.status === 'uploading') {
          update('Preparing your training run…');
          let uploads;
          if (draft.current.job) ({ uploads } = await api.resume(draft.current.job.id, controller.signal));
          else {
            attemptedCreate.current = true;
            const created = await api.create(input, controller.signal);
            draft.current.job = created.job; uploads = created.uploads;
            setSavedId(created.job.id); setFrozen(true);
          }
          for (const split of SPLITS) {
            update(`Uploading ${split} to private storage…`);
            const slot = uploads[split];
            if (!('uploaded' in slot)) await api.upload(split, slot, data.files[split], controller.signal);
          }
          update('Submitting for validation…');
          draft.current.job = (await api.submit(draft.current.job.id, controller.signal)).job;
        }
        job = draft.current.job;
      }
      controller.signal.throwIfAborted();
      setProgress('Opening your saved run…');
      router.push(`/train?run=${job.id}`);
    } catch (failure) {
      // Only authentication/authorization failures guarantee rejection before the job is saved.
      const rejected = failure instanceof TrainingApiError && [401, 403].includes(failure.status);
      if (rejected && !draft.current.job) attemptedCreate.current = false;
      const unknown = attemptedCreate.current && !draft.current.job;
      setUncertain(unknown);
      setNeedsCredit((failure instanceof TrainingApiError || failure instanceof ImageApiError) && failure.status === 402);
      setError(controller.signal.aborted ? 'Upload stopped. Any saved run and completed uploads remain available.' : failure instanceof Error ? failure.message : 'Submission could not finish.');
      setProgress(unknown ? 'The service may have saved your run. Check your runs before starting another; this page will not create it again.' : draft.current.job ? 'Your run is saved. Resume here with the same data, or open the saved run.' : 'No training run was created. Your examples remain in this tab.');
    } finally {
      const locked = Boolean(draft.current.job || attemptedCreate.current);
      if (!locked) { snapshot.current = null; setSavedOwner(''); }
      setSavedId(draft.current.job?.id || ''); setFrozen(locked); onLock(locked);
      setBusy(false); operation.current = null;
    }
  }

  function downloadSplit(split: Split) {
    const data = snapshot.current?.data;
    if (data?.kind !== 'text') return;
    const url = URL.createObjectURL(data.files[split]);
    const link = document.createElement('a'); link.href = url; link.download = `${split}.jsonl`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!config) return <p className={s.hint}>Live training is not configured in this environment. You can still download your draft.</p>;
  return <section className={s.preparedReview} aria-label="Submit training run" aria-busy={busy}>
    <h2>Start a real training run</h2>
    <p className={s.hint}>Uses one included training run or $2 from your balance. A completed evaluation is charged even if no model meets your targets. <Link href="/billing" target="_blank" rel="noopener noreferrer">View billing</Link>.</p>
    {session === undefined ? <p role="status">Checking your sign-in…</p> : !session || accountChanged ? <p className={s.hint}>{accountChanged ? 'Sign in to the original account to resume this run.' : 'Sign in before submitting.'} <Link className={s.secondary} href="/train" target="_blank" rel="noopener noreferrer">Sign in to train</Link> Your draft stays in this tab; return here after signing in.</p> : <form onSubmit={submit}>
      <fieldset disabled={busy || frozen}>
        <label htmlFor={`${id}-name`}>Training run name</label><input id={`${id}-name`} required maxLength={64} pattern="[a-z0-9][a-z0-9-]{0,63}" placeholder="support-routing-v1" value={name} onChange={event => setName(event.target.value)} />
        <div className={s.pairFields}><div><label htmlFor={`${id}-accuracy`}>Required accuracy (%)</label><input id={`${id}-accuracy`} type="number" required min="0" max="100" step="any" value={accuracy} onChange={event => setAccuracy(event.target.value)} /></div><div><label htmlFor={`${id}-improvement`}>Required Brier improvement</label><input id={`${id}-improvement`} type="number" required min="0" max="2" step="any" value={improvement} onChange={event => setImprovement(event.target.value)} /></div></div>
        <p className={s.hint}>The trained model must meet these targets on held-out data. Lower Brier loss means better probability estimates. Training does not guarantee an approved model.</p>
        <label className={s.checkLabel}><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I am authorized to share these examples. Approved workers can read and retain the training data. Calibration and test labels stay with Zils. This is not confidential compute.</span></label>
        {!imageAnswers && <label className={s.checkLabel}><input type="checkbox" checked={comparison} onChange={event => setComparison(event.target.checked)} /><span>Also compare against TypeSafe JEV. Send final-evaluation inputs and questions to TypeSafe; correct answers stay with Zils. Optional.</span></label>}
      </fieldset>
      <div className={s.actions}><span className={s.hint}>{session.user.email}</span><button className={s.primary} disabled={busy || uncertain || !consent}>{busy ? 'Submitting…' : frozen ? 'Resume training submission' : 'Start training'}</button></div>
    </form>}
    {(error || sessionError) && <p role="alert" className={s.error}>{error || sessionError}{needsCredit && <Link href="/billing" target="_blank" rel="noopener noreferrer">Add credit</Link>}</p>}
    {progress && <p role="status" className={s.hint}>{progress}</p>}
    {busy && <button type="button" className={s.secondary} onClick={() => operation.current?.abort()}>Stop upload</button>}
    {(savedId || uncertain) && <Link className={s.secondary} href={savedId ? `/train?run=${savedId}` : '/train'} target="_blank" rel="noopener noreferrer">{savedId ? 'Open saved run' : 'Check my runs'}</Link>}
    {frozen && !imageAnswers && <div><p className={s.hint}>Before closing this tab, save these exact files to resume uploads from your saved run.</p><div className={s.actions}>{SPLITS.map(split => <button key={split} type="button" className={s.secondary} onClick={() => downloadSplit(split)}>Download {split}.jsonl</button>)}</div></div>}
  </section>;
}

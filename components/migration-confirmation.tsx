'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SheetContent, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { newerBase, trainingBase, type PoolSelection } from '@/lib/base-model';
import { trainingApi, TrainingApiError, type Job, type MigrationPreview } from '@/lib/training';
import styles from './migration-confirmation.module.css';

type Props = {
  api: ReturnType<typeof trainingApi>; apiUrl: string; owner: string; previousId: string; targetId: string;
  onSubmitted: (job: Job) => void; onExpired: () => Promise<void>;
};

export function MigrationConfirmation({ api, apiUrl, owner, previousId, targetId, onSubmitted, onExpired }: Props) {
  const [preview, setPreview] = useState<MigrationPreview>();
  const [target, setTarget] = useState<{ name: string; selection: PoolSelection }>();
  const [error, setError] = useState('');
  const [needsCredit, setNeedsCredit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryRequest, setRetryRequest] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sending = useRef(false);
  const requestId = useRef<string | null>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const key = `zils-migration:${owner}:${previousId}:${targetId}`;
  useEffect(() => {
    const controller = new AbortController();
    requestId.current ??= sessionStorage.getItem(key);
    Promise.all([api.migrationPreview(previousId, controller.signal), trainingBase(apiUrl, controller.signal)])
      .then(([saved, bases]) => {
        if (controller.signal.aborted) return;
        const next = newerBase(bases, saved.job, targetId);
        if (!next) throw new Error('This migration is no longer available. Return to your model to check available bases.');
        setPreview(saved); setTarget(next); setError(''); setRetryRequest(Boolean(requestId.current));
      }).catch(error => {
        if (controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : 'Saved data could not be checked. Try again.');
        setRetryRequest(Boolean(requestId.current));
        if (error instanceof TrainingApiError && error.status === 401) void onExpired();
      });
    return () => controller.abort();
  }, [api, apiUrl, previousId, targetId, onExpired, attempt, key]);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);

  async function confirm() {
    if ((!requestId.current && (!preview || !target)) || sending.current) return;
    sending.current = true; setBusy(true); setError(''); setNeedsCredit(false);
    try {
      // Retain the same request across a timeout or reload; the server deduplicates billing.
      requestId.current ??= sessionStorage.getItem(key);
      let selection = target?.selection ?? {};
      if (!requestId.current) {
        if (!preview || !target) return;
        const bases = await trainingBase(apiUrl);
        const next = newerBase(bases, preview.job, targetId);
        if (!next) throw new Error('This migration is no longer available. Return to your model to check available bases.');
        selection = next.selection;
        requestId.current = crypto.randomUUID();
      }
      sessionStorage.setItem(key, requestId.current);
      const result = await api.migrate(previousId, { ...selection, model: targetId, request_id: requestId.current });
      sessionStorage.removeItem(key);
      onSubmitted(result.job);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Migration could not be confirmed. Try again.');
      setRetryRequest(Boolean(requestId.current));
      setNeedsCredit(error instanceof TrainingApiError && error.status === 402);
      if (error instanceof TrainingApiError && error.status === 401) void onExpired();
    } finally { sending.current = false; setBusy(false); }
  }

  return <SheetContent className={`zs ${styles.confirmation}`} closeLabel="Close migration confirmation" closeDisabled={busy}
    onEscapeKeyDown={event => { if (sending.current) event.preventDefault(); }} onInteractOutside={event => { if (sending.current) event.preventDefault(); }}>
    <header className={styles.header}>
      <SheetTitle className={styles.title}>Migrate your model</SheetTitle>
      <SheetDescription className={styles.description}>Keep your examples and settings. Train on the newer base.</SheetDescription>
    </header>
    <div className={styles.body}>
      {error && <p className={styles.error} role="alert" tabIndex={-1} ref={alert}>{error} {needsCredit && <Link href="/billing">Add credit</Link>}</p>}
      {!preview && !error && <p role="status">Checking saved examples and settings…</p>}
      {preview && target && <>
        <h3 className={styles.modelName}>{preview.job.name}</h3>
        <dl className={styles.bases}><div><dt>Current base</dt><dd>{preview.job.model?.name}</dd></div><div><dt>New base</dt><dd>{target.name}</dd></div></dl>
        <section className={styles.section} aria-label="Saved examples">
          <h3>Your saved examples</h3>
          <dl className={styles.counts}>{(['train', 'calibration', 'test'] as const).map(split => <div key={split}><dt>{{ train: 'Training', calibration: 'Calibration', test: 'Evaluation' }[split]}</dt><dd>{preview.counts[split].toLocaleString()}</dd></div>)}</dl>
          <p>The same examples stay in each set. Nothing to upload.</p>
        </section>
        <section className={styles.section} aria-label="Existing settings">
          <h3>Your success criteria</h3>
          <dl className={styles.settings}><div><dt>Minimum accuracy</dt><dd>{Number((preview.acceptance.min_accuracy * 100).toFixed(6))}%</dd></div><div><dt>{preview.acceptance.migration === 'no_regression' ? 'Brier score' : preview.acceptance.migration ? 'Maximum Brier regression' : 'Minimum Brier improvement'}</dt><dd>{preview.acceptance.migration === 'no_regression' ? 'Match or improve' : preview.acceptance.migration ? '0.005' : preview.acceptance.min_brier_improvement}</dd></div></dl>
          <p>Your current model stays live. The replacement takes over only after it passes your criteria.</p>
        </section>
        <details className={styles.details}><summary>Data and evaluation</summary>
          <p>We verify the saved files before training. Only the training set goes to approved workers; calibration and evaluation labels stay private.</p>
          <p>The original evaluation set is reused to check for regressions. These results are not a fresh independent estimate of performance.</p>
          {preview.allow_jev_comparison && <p>Your existing JEV comparison setting is retained: evaluation inputs and questions are shared with TypeSafe JEV; correct answers are not.</p>}
        </details>
        <p className={styles.cost}>Costs $0.20 per million training tokens, with a $2 minimum; an included run covers the first $2. Your existing data-sharing permissions apply.</p>
      </>}
    </div>
    <footer className={styles.footer}>
      <SheetClose className={styles.secondary} disabled={busy}>Cancel</SheetClose>
      {!preview && error && !retryRequest ? <button className={styles.primary} onClick={() => { setError(''); setAttempt(value => value + 1); }}>Try again</button>
        : <button className={styles.primary} disabled={(!retryRequest && (!preview || !target)) || busy} onClick={confirm}>{busy ? 'Starting migration…' : retryRequest ? 'Retry migration' : 'Confirm migration'}</button>}
    </footer>
  </SheetContent>;
}

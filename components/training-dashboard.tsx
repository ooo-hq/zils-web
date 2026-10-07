'use client';

import { type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { canDownload, downloadFiles, SPLITS, submissionSchema, terminal, trainingApi, TrainingApiError, validateDatasets, type Job, type Split, type Submission } from '@/lib/training';
import Link from 'next/link';
import { TrainingAccessGate } from '@/components/access-session';
import { TrainingGuide } from '@/components/training-guide';
import { TrainingIntake } from '@/components/training-intake';
import { ApiKeysPanel } from '@/components/api-keys-panel';
import { Plus, ChevronDown } from 'lucide-react';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { TrainingRunStatus } from '@/components/training-run-status';
import { useAuthSession } from '@/components/auth-session';
import { currentTrainingJob, trainingProgress } from '@/lib/training-status';
import styles from '@/app/(home)/train/train.module.css';

type Config = { url: string; key: string; apiUrl: string; decisionApiUrl: string | null };
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const metric = (value: number | undefined, percent = false) => value === undefined ? '—' : percent ? `${(value * 100).toFixed(2)}%` : value.toFixed(4);

export function TrainingDashboard({ config }: { config: Config }) {
  const { client, session, error: sessionError } = useAuthSession(config);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    if (!client) { setError('Sign-in is unavailable. Please refresh and try again.'); setBusy(false); return; }
    try {
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/train` } });
      if (error) throw error;
      setNotice('Check your email for a sign-in link. Open it to return to your training workspace.');
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  const signOut = useCallback(async () => {
    if (!client) return;
    setError('');
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) setError(error.message);
  }, [client]);
  if (session === undefined) return <div className={styles.workspaceHeading}><h1>Training</h1><p role="status">Checking your session…</p></div>;
  return <>
    {(error || sessionError) && <p role="alert" className={styles.error}>{error || sessionError}</p>}
    {session && client ? <div id="training-workspace">
      <TrainingAccessGate key={session.user.id} owner={session.user.id} token={session.access_token}><SignedInDashboard key={session.user.id} client={client} config={config} onExpired={signOut} /></TrainingAccessGate>
    </div> : <>
      <div className={styles.workspaceHeading}><h1>Training</h1><p>Teach Zils a decision using examples your team has reviewed.</p></div>
      <section id="training-workspace" className={`${styles.panel} ${styles.signIn}`}><h2>Sign in to Zils</h2><p>Sign in with the email address on your invitation.</p><form onSubmit={signIn}><label htmlFor="training-email">Email address</label><input id="training-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" disabled={busy} /><button className={styles.button} disabled={busy}>{busy ? 'Sending link…' : 'Email me a sign-in link'}</button></form>{notice && <p role="status" className={styles.notice}>{notice}</p>}</section>
      <p className={styles.account}>Need an invitation? <Link href="/early-access">Request early access</Link>.</p><details className={styles.signInGuide}><summary>What examples should I bring?</summary><TrainingGuide /></details>
    </>}
  </>;
}

function SignedInDashboard({ client, config, onExpired }: { client: SupabaseClient; config: Config; onExpired: () => Promise<void> }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [downloadJobId, setDownloadJobId] = useState('');
  const focusSubmitted = useRef(false);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [cancellable, setCancellable] = useState(false);
  const [files, setFiles] = useState<Partial<Record<Split, File>>>({});
  const [downloads, setDownloads] = useState<{ name: string; url: string }[]>([]);
  const [formVersion, setFormVersion] = useState(0);
  const [pendingUpload, setPendingUpload] = useState('');
  const statusMessage = useRef<HTMLHeadingElement>(null);
  const life = useRef<AbortController | null>(null);
  const operation = useRef<AbortController | null>(null);
  const selected = currentTrainingJob(jobs);
  const api = useMemo(() => trainingApi(config.apiUrl, config.url, async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session?.access_token || '';
  }), [config.apiUrl, config.url, client]);
  const handleError = useCallback((error: unknown) => {
    if (error instanceof TrainingApiError && error.status === 401) { void onExpired(); return; }
    setError(message(error));
  }, [onExpired]);
  // A ref avoids restarting polling whenever the auth wrapper rerenders.
  const errorHandler = useRef(handleError);
  useEffect(() => { errorHandler.current = handleError; }, [handleError]);
  useEffect(() => {
    const controller = new AbortController(); life.current = controller;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const { jobs } = await api.list(controller.signal);
        if (controller.signal.aborted) return;
        setJobs(jobs); setLoading(false); setCheckedAt(Date.now()); setRefreshError(false);
        setPendingUpload(previous => jobs.find(job => job.id === previous && job.status === 'uploading')?.id || jobs.find(job => job.status === 'uploading')?.id || '');
        timer = setTimeout(poll, jobs.some(job => !terminal(job)) ? 10_000 : 30_000);
      } catch (error) { if (!controller.signal.aborted) { if (error instanceof TrainingApiError && error.status === 401) errorHandler.current(error); setLoading(false); setRefreshError(true); timer = setTimeout(poll, 30_000); } }
    }
    void poll();
    return () => { controller.abort(); operation.current?.abort(); clearTimeout(timer); };
  }, [api, formVersion]);

  const refresh = async () => {
    setError(''); setRefreshing(true);
    try {
      const { jobs } = await api.list(life.current?.signal);
      if (!life.current?.signal.aborted) {
        setJobs(jobs); setCheckedAt(Date.now()); setRefreshError(false);
        setPendingUpload(previous => jobs.find(job => job.id === previous && job.status === 'uploading')?.id || jobs.find(job => job.status === 'uploading')?.id || '');
      }
    } catch (error) { if (!life.current?.signal.aborted) { if (error instanceof TrainingApiError && error.status === 401) handleError(error); setRefreshError(true); } }
    finally { setRefreshing(false); }
  };
  function replaceJob(job: Job) {
    setJobs(previous => previous.some(other => other.id === job.id) ? previous.map(other => other.id === job.id ? job : other) : [job, ...previous]);
    if (job.status !== 'uploading') setPendingUpload(previous => previous === job.id ? '' : previous);
  }
  async function selectJob(job: Job) {
    if (selectedId === job.id) { setSelectedId(''); return; }
    setSelectedId(job.id); setDownloads([]); setError('');
    try { const { job: updated } = await api.get(job.id, life.current?.signal); if (!life.current?.signal.aborted) replaceJob(updated); } catch (error) { if (!life.current?.signal.aborted) handleError(error); }
  }
  async function create(input: Submission, datasets: Record<Split, File>) {
    setError(''); setDownloads([]); setFiles(datasets);
    if (pendingUpload) { setError('Resume or cancel the saved job before submitting a new one.'); return; }
    const parsed = submissionSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setCancellable(true); setProgress('Validating files locally…');
    let createdId = '';
    try {
      await validateDatasets(datasets, controller.signal);
      setProgress('Preparing your training run…');
      const { job, uploads } = await api.create(parsed.data, controller.signal);
      createdId = job.id; setPendingUpload(job.id); replaceJob(job); setSelectedId(job.id);
      for (const split of SPLITS) {
        setProgress(`Uploading ${split} directly to private storage…`);
        const slot = uploads[split];
        if (!('uploaded' in slot)) await api.upload(split, slot, datasets[split], controller.signal);
      }
      setProgress('Submitting for validation…');
      const submitted = await api.submit(job.id, controller.signal);
      replaceJob(submitted.job); setProgress('');
      setFiles({}); setPendingUpload(''); setFormVersion(v => v + 1);
      focusSubmitted.current = true; setPanelOpen(false);
      requestAnimationFrame(() => statusMessage.current?.focus());
    } catch (error) {
      if (controller.signal.aborted) setProgress('Stopped locally. Any created job and completed uploads remain in your workspace.');
      else { handleError(error); setProgress(createdId ? 'Your job is saved. Retry submission if all uploads finished, or resume missing uploads using the original files.' : 'No successful submission confirmed. Refresh the job list before creating another job.'); }
    } finally { if (!life.current?.signal.aborted) setBusy(false); setCancellable(false); operation.current = null; }
  }
  async function resumeUploads(job: Job) {
    const { train, calibration, test } = files;
    if (!train || !calibration || !test) { setPanelOpen(true); setError('Prepare the same CSV with its original settings, or choose the three original files using prepared-file setup. Then close this panel and resume the saved upload.'); return; }
    const datasets = { train, calibration, test };
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setCancellable(true); setError(''); setProgress('Checking original files…');
    try {
      await validateDatasets(datasets, controller.signal);
      const { uploads } = await api.resume(job.id, controller.signal);
      for (const split of SPLITS) {
        const slot = uploads[split];
        if ('uploaded' in slot) continue;
        setProgress(`Resuming ${split} upload…`);
        await api.upload(split, slot, datasets[split], controller.signal);
      }
      const result = await api.submit(job.id, controller.signal);
      replaceJob(result.job); setFiles({}); setPendingUpload(''); setFormVersion(v => v + 1);
      setProgress('');
      focusSubmitted.current = true; setPanelOpen(false);
      requestAnimationFrame(() => statusMessage.current?.focus());
    } catch (error) { if (controller.signal.aborted) setProgress('Stopped locally. Saved uploads remain.'); else handleError(error); }
    finally { setBusy(false); setCancellable(false); operation.current = null; }
  }
  async function cancelJob(job: Job) {
    setBusy(true); setError(''); setDownloads([]); setProgress('');
    try { const result = await api.cancel(job.id, life.current?.signal); replaceJob(result.job); if (job.id === pendingUpload) setPendingUpload(''); }
    catch (error) { if (!life.current?.signal.aborted) handleError(error); }
    finally { setBusy(false); }
  }
  async function retrySubmit(job: Job) {
    setBusy(true); setError(''); setDownloads([]);
    try { const result = await api.submit(job.id, life.current?.signal); replaceJob(result.job); setPendingUpload(''); setFiles({}); setFormVersion(v => v + 1); setProgress(''); requestAnimationFrame(() => statusMessage.current?.focus()); }
    catch (error) { if (!life.current?.signal.aborted) handleError(error); }
    finally { setBusy(false); }
  }
  async function getDownloads(job: Job) {
    setBusy(true); setError(''); setDownloads([]); setDownloadJobId(job.id);
    try { const items = await api.downloads(job, life.current?.signal); if (!life.current?.signal.aborted) setDownloads(items); }
    catch (error) { if (!life.current?.signal.aborted) handleError(error); }
    finally { setBusy(false); }
  }
  function runDetails(job: Job) {
    return <>
      <TrainingRunStatus job={job} />
      {job.error && <p role="alert" className={styles.error}>{job.error}</p>}
      {job.status === 'uploading' && <div className={styles.actions}>
        <button className={styles.secondary} disabled={busy} onClick={() => retrySubmit(job)}>Retry submission</button>
        <button className={styles.secondary} disabled={busy} onClick={() => resumeUploads(job)}>Resume missing uploads</button>
        <button className={styles.textButton} disabled={busy} onClick={() => cancelJob(job)}>Cancel this run</button>
      </div>}
      {canDownload(job) && <div className={styles.modelDownloads}>
        {job.workflow?.state === 'ready' && job.workflow.model_id && <>
          <p><strong>API model ID</strong></p>
          <p className={styles.hash}><code>{job.workflow.model_id}</code></p>
          <p className={styles.help}>Set your request’s model to this ID. Your existing API key gives access to models owned by your account.</p>
        </>}
        <button disabled={busy} className={styles.button} onClick={() => getDownloads(job)}>Get model files</button>
        <p className={styles.help}>Optional: download a private copy of the accepted adapter.</p>
        {downloadJobId === job.id && downloads.length > 0 && <ul className={styles.downloads}>{downloads.map(file => <li key={file.name}><a href={file.url} target="_blank" rel="noreferrer">{file.name}</a></li>)}</ul>}
      </div>}
      <details className={styles.details}>
        <summary>{job.result ? 'Evaluation and technical details' : 'Technical details'}</summary>
        <p className={styles.id}>Run ID: {job.id}</p>
        {job.created_at && <p>Submitted {new Date(job.created_at).toLocaleString()}</p>}
        {job.model && <p>Starting model: <strong>{job.model.name}</strong></p>}
        {job.status === 'completed' && !job.result && <p>Result details are not available yet. Refresh to try again.</p>}
        {job.result && <>
          <p className={styles.help}>Measured on examples held aside from training. Results are not a guarantee on future inputs.</p>
          <div className={styles.metrics}><div><span>Base model accuracy</span><strong>{metric(job.result.baseline.accuracy, true)}</strong></div><div><span>Base model Brier loss</span><strong>{metric(job.result.baseline.brier)}</strong></div></div>
          <p className={styles.help}>Required: {metric(job.result.delivery.acceptance.min_accuracy, true)} accuracy; {metric(job.result.delivery.acceptance.min_brier_improvement)} absolute Brier improvement.</p>
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Candidate evaluations"><table><thead><tr><th>Candidate</th><th>Status</th><th>Accuracy</th><th>Brier loss</th></tr></thead><tbody>{job.result.miners.map(miner => <tr key={miner.uid}><th>{miner.uid}{job.result?.delivery.uid === miner.uid ? ' · selected' : ''}</th><td>{miner.status}</td><td>{metric(miner.accuracy, true)}</td><td>{metric(miner.brier)}</td></tr>)}</tbody></table></div>
          {job.result.delivery.sha256 && <p className={styles.hash}>Checkpoint SHA-256<br /><code>{job.result.delivery.sha256}</code></p>}
          {canDownload(job) && <p className={styles.help}>Download links expire. Files: {downloadFiles(job).join(', ')}.</p>}
        </>}
      </details>
    </>;
  }
  function runRows(items: Job[], title: string) {
    if (!items.length) return null;
    return <section className={styles.runHistory} aria-label={title}><h2>{title}</h2><ul>{items.map(job => <li key={job.id}>
      <button className={styles.historyRow} aria-expanded={selectedId === job.id} aria-controls={`run-${job.id}`} disabled={busy} onClick={() => selectJob(job)}>
        <span><strong>{job.name}</strong>{job.created_at && <time dateTime={job.created_at}>{new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}</span>
        <span className={styles.historyStatus}>{trainingProgress(job).label}<ChevronDown size={16} aria-hidden="true" /></span>
      </button>
      <div id={`run-${job.id}`} hidden={selectedId !== job.id} className={styles.historyDetail}>{selectedId === job.id && runDetails(job)}</div>
    </li>)}</ul></section>;
  }
  return <Sheet open={panelOpen} onOpenChange={open => { if (open) focusSubmitted.current = false; setPanelOpen(open); }}>
    <div className={styles.workspaceHeading}>
      <div><h1>Training</h1><p>Follow your runs and train a new model.</p></div>
      <div className={styles.workspaceActions}>
        <ApiKeysPanel client={client} apiUrl={config.decisionApiUrl} onExpired={onExpired} />
        <SheetTrigger asChild><button className={styles.button} disabled={busy}><Plus size={16} aria-hidden="true" />Train a model</button></SheetTrigger>
      </div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {progress && <p role="status" className={styles.notice}>{progress}</p>}
    {busy && cancellable && <button type="button" className={styles.secondary} onClick={() => operation.current?.abort()}>Stop upload</button>}
    <div className={styles.workspace}>
      {loading ? <p role="status" className={styles.empty}>Loading your training runs…</p> : !selected ? <section className={styles.emptyWorkspace}>
        <h2>{refreshError ? 'Your runs could not be loaded.' : 'Train your first model.'}</h2>
        <p>{refreshError ? 'Try checking again in a moment.' : 'Bring a decision and a few reviewed examples. Zils will guide you through the rest.'}</p>
        {refreshError ? <button className={styles.secondary} onClick={refresh} disabled={refreshing}>Try again</button> : <SheetTrigger asChild><button className={styles.secondary}>Get started</button></SheetTrigger>}
      </section> : <div>
        <div className={styles.currentLabel}><span>{terminal(selected) ? 'Latest run' : 'Current run'}</span><button className={styles.textButton} onClick={refresh} disabled={busy || refreshing}>{refreshing ? 'Checking…' : 'Refresh status'}</button></div>
        <section className={`${styles.panel} ${styles.currentRun}`} aria-labelledby="current-run-title">
          <div className={styles.currentRunHeader}><h2 id="current-run-title" ref={statusMessage} tabIndex={-1}>{selected.name}</h2><span className={styles.runBadge} data-tone={trainingProgress(selected).tone}>{trainingProgress(selected).label}</span></div>
          {runDetails(selected)}
          <p className={styles.statusFreshness} data-stale={refreshError}>{refreshError ? 'Connection interrupted. Showing the last known status; we’ll retry automatically.' : <>Last checked {checkedAt ? new Date(checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'just now'}. {!terminal(selected) && 'Updates automatically.'}</>}</p>
        </section>
      </div>}
      {runRows(jobs.filter(job => job.id !== selected?.id && !terminal(job)), 'Other active runs')}
      {runRows(jobs.filter(job => job.id !== selected?.id && terminal(job)), 'Past runs')}
    </div>
    <TrainingIntake key={formVersion} busy={busy} onSubmit={create} onFiles={setFiles} pending={Boolean(pendingUpload)} pendingName={jobs.find(job => job.id === pendingUpload)?.name} submissionError={error} progress={progress} onStopUpload={busy && cancellable ? () => operation.current?.abort() : undefined} onCloseAutoFocus={event => {
      if (focusSubmitted.current) { event.preventDefault(); focusSubmitted.current = false; statusMessage.current?.focus(); }
    }} />
  </Sheet>;
}

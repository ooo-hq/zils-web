'use client';

import type { StorageLocations } from '@/lib/storage';

import { type SupabaseClient } from '@supabase/supabase-js';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { canDownload, downloadFiles, SPLITS, submissionSchema, terminal, trainingApi, TrainingApiError, validateDatasets, type Job, type Split, type Submission } from '@/lib/training';
import Link from 'next/link';
import { WorkspaceLoading, LinkLoading } from '@/components/workspace-loading';
import { TrainingGuide } from '@/components/training-guide';
import { TrainingIntake } from '@/components/training-intake';
import { ApiKeysPanel } from '@/components/api-keys-panel';
import { TrainedModelQuickstart } from '@/components/trained-model-quickstart';
import { TrainedModelLibrary } from '@/components/trained-model-library';
import { Plus, ArrowUpRight, ArrowRight, ImageIcon, MessageSquareText } from 'lucide-react';
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { TrainingRunStatus } from '@/components/training-run-status';
import { useAuthSession } from '@/components/auth-session';
import { signInWithGoogle } from '@/lib/training-auth';
import { currentTrainingJob, trainingProgress } from '@/lib/training-status';
import { ImageDecisionPanel } from '@/components/image-decision-panel';
import { imageApi, type ImageModels } from '@/lib/images';
import { ImageTrainingResults, PrivateImageTest } from '@/components/image-training-results';
import { ImageTrainingIntake } from '@/components/image-training-intake';
import onboardingStyles from '@/components/training-onboarding.module.css';
import imageStyles from '@/components/image-decision-panel.module.css';
import styles from '@/app/(home)/train/train.module.css';

type Config = { assistantConfigured?: boolean; storage: StorageLocations; url: string; key: string; apiUrl: string; decisionApiUrl: string | null };
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const metric = (value: number | undefined, percent = false) => value === undefined ? '—' : percent ? `${(value * 100).toFixed(2)}%` : value.toFixed(4);

export function TrainingDashboard({ config, runId }: { config: Config; runId?: string }) {
  const { client, session, error: sessionError } = useAuthSession(config);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy('email'); setError(''); setNotice('');
    if (!client) { setError('Sign-in is unavailable. Please refresh and try again.'); setBusy(null); return; }
    try {
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/train` } });
      if (error?.code === 'otp_disabled' || error?.code === 'signup_disabled') {
        setError('Workspace access is by invitation. Join the early-access list below, or use the email address that was invited.');
        return;
      }
      if (error) throw error;
      setNotice('Check your email for a sign-in link. Open it to return to your training workspace.');
    } catch (error) { setError(message(error)); } finally { setBusy(null); }
  }
  async function googleSignIn() {
    if (!client || busy) return;
    setBusy('google'); setError(''); setNotice('');
    try {
      const { error } = await signInWithGoogle(client, window.location.origin);
      if (error) throw error;
    } catch {
      setError('Google sign-in could not start. Please try again or use email.');
    } finally { setBusy(null); }
  }
  const signOut = useCallback(async () => {
    if (!client) return;
    setError('');
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) setError(error.message);
  }, [client]);
  if (session === undefined) return <WorkspaceLoading label="Opening your training workspace" />;
  return <>
    {(error || sessionError) && <p role="alert" className={styles.error}>{error || sessionError}</p>}
    {session && client ? <div id="training-workspace">
      <SignedInDashboard key={`${session.user.id}:${runId || "index"}`} runId={runId} owner={session.user.id} client={client} config={config} onExpired={signOut} />
    </div> : <>
      <div className={styles.workspaceHeading}><h1>Training</h1><p>Teach Zils a decision using examples your team has reviewed.</p></div>
      <section id="training-workspace" className={`${styles.panel} ${styles.signIn}`}>
        <h2>Sign in to Zils</h2><p>Workspace access is by invitation. Sign in with the email address that was invited.</p>
        <p>New to Zils? <Link href="/early-access" className="underline underline-offset-4">Join the early-access list</Link>. Joining the list does not create an account.</p>
        {process.env.NEXT_PUBLIC_ZILS_GOOGLE_AUTH_ENABLED === 'true' && <>
          <button type="button" className={styles.googleButton} onClick={googleSignIn} disabled={!client || Boolean(busy)} aria-label="Sign in with Google" aria-busy={busy === 'google'}>
            <Image src="/google-sign-in.png" alt="" width={180} height={40} unoptimized />
          </button>
          <p className={styles.signInDivider}>or use email</p>
        </>}
        <form onSubmit={signIn}><label htmlFor="training-email">Email address</label><input id="training-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" disabled={Boolean(busy)} /><button className={styles.button} disabled={Boolean(busy)}>{busy === 'email' ? 'Sending link…' : 'Email me a sign-in link'}</button></form>
        {busy === 'google' && <p role="status" className={styles.notice}>Opening Google…</p>}
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
      </section>
      <details className={styles.signInGuide}><summary>What examples should I bring?</summary><TrainingGuide /></details>
    </>}
  </>;
}

function SignedInDashboard({ owner, client, config, onExpired, runId }: { runId?: string; owner: string; client: SupabaseClient; config: Config; onExpired: () => Promise<void> }) {
  const [intakeMode, setIntakeMode] = useState<'choose' | 'text' | 'images'>('choose');
  const [imagesAvailable, setImagesAvailable] = useState(false);
  const [imageProfile, setImageProfile] = useState<ImageModels['training_profile']>();
  const imageToken = useCallback(async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session?.user.id === owner ? data.session.access_token : '';
  }, [client, owner]);
  useEffect(() => {
    if (!config.decisionApiUrl) return;
    const controller = new AbortController();
    imageApi(config.decisionApiUrl, config.storage, imageToken).models(controller.signal)
      .then(data => { if (!controller.signal.aborted) { setImagesAvailable(data.models.some(model => model.stock)); setImageProfile(data.training_enabled ? data.training_profile : undefined); } })
      .catch(() => { if (!controller.signal.aborted) setImagesAvailable(false); });
    return () => controller.abort();
  }, [config.decisionApiUrl, config.storage, imageToken]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [availableModels, setAvailableModels] = useState<Job[]>([]);
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
  const [needsCredit, setNeedsCredit] = useState(false);
  const [cancellable, setCancellable] = useState(false);
  const [files, setFiles] = useState<Partial<Record<Split, File>>>({});
  const [downloads, setDownloads] = useState<{ name: string; url: string }[]>([]);
  const [formVersion, setFormVersion] = useState(0);
  const [pendingUpload, setPendingUpload] = useState('');
  const statusMessage = useRef<HTMLHeadingElement>(null);
  const life = useRef<AbortController | null>(null);
  const operation = useRef<AbortController | null>(null);
  const selected = runId ? jobs[0] : currentTrainingJob(jobs.filter(job => !terminal(job)));
  const imageService = useMemo(() => config.decisionApiUrl ? imageApi(config.decisionApiUrl, config.storage, imageToken) : null, [config.decisionApiUrl, config.storage, imageToken]);
  const api = useMemo(() => trainingApi(config.apiUrl, config.storage, imageToken), [config.apiUrl, config.storage, imageToken]);
  const history = [...jobs, ...availableModels.filter(model => !jobs.some(job => job.id === model.id))];
  const loadJobs = useCallback(async (signal?: AbortSignal) => {
    if (!runId) return api.list(signal);
    const { job } = await api.get(runId, signal);
    if (job.id !== runId) throw new Error('The service returned a different run. Please refresh.');
    return { jobs: [job], models: [] as Job[] };
  }, [api, runId]);
  const handleError = useCallback((error: unknown) => {
    if (error instanceof TrainingApiError && error.status === 401) { void onExpired(); return; }
    setNeedsCredit(error instanceof TrainingApiError && error.status === 402);
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
        const { jobs, models } = await loadJobs(controller.signal);
        if (controller.signal.aborted) return;
        setJobs(jobs); setAvailableModels(models ?? jobs); if (runId) setError(''); setLoading(false); setCheckedAt(Date.now()); setRefreshError(false);
        setPendingUpload(previous => jobs.find(job => job.id === previous && job.status === 'uploading' && job.model?.id !== 'imajev-4b-v1')?.id || jobs.find(job => job.status === 'uploading' && job.model?.id !== 'imajev-4b-v1')?.id || '');
        timer = setTimeout(poll, jobs.some(job => !terminal(job)) ? 10_000 : 30_000);
      } catch (error) { if (!controller.signal.aborted) { if (error instanceof TrainingApiError && error.status === 401) errorHandler.current(error); if (runId) { setJobs([]); setError(error instanceof TrainingApiError && [403, 404].includes(error.status) ? 'This run is not available to this account.' : message(error)); } setLoading(false); setRefreshError(true); timer = setTimeout(poll, 30_000); } }
    }
    void poll();
    return () => { controller.abort(); operation.current?.abort(); clearTimeout(timer); };
  }, [loadJobs, formVersion, runId]);

  const refresh = async () => {
    setError(''); setRefreshing(true);
    try {
      const { jobs, models } = await loadJobs(life.current?.signal);
      if (!life.current?.signal.aborted) {
        setJobs(jobs); setAvailableModels(models ?? jobs); setCheckedAt(Date.now()); setRefreshError(false);
        setPendingUpload(previous => jobs.find(job => job.id === previous && job.status === 'uploading' && job.model?.id !== 'imajev-4b-v1')?.id || jobs.find(job => job.status === 'uploading' && job.model?.id !== 'imajev-4b-v1')?.id || '');
      }
    } catch (error) { if (!life.current?.signal.aborted) { if (error instanceof TrainingApiError && error.status === 401) handleError(error); if (runId) { setJobs([]); setError(error instanceof TrainingApiError && [403, 404].includes(error.status) ? 'This run is not available to this account.' : message(error)); } setRefreshError(true); } }
    finally { setRefreshing(false); }
  };
  function replaceJob(job: Job) {
    setJobs(previous => previous.some(other => other.id === job.id) ? previous.map(other => other.id === job.id ? job : other) : [job, ...previous]);
    if (job.status !== 'uploading') setPendingUpload(previous => previous === job.id ? '' : previous);
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
      createdId = job.id; setPendingUpload(job.id); replaceJob(job);
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
    if (!train || !calibration || !test) { setIntakeMode('text'); setPanelOpen(true); setError('Prepare the same CSV with its original settings, or choose the three original files using prepared-file setup. Then close this panel and resume the saved upload.'); return; }
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
      {canDownload(job) && <Link className={styles.secondary} href={`/train/models/${job.id}`}>View model stats and access</Link>}
      {job.model?.id === 'imajev-4b-v1' && <>
        {job.data_expires_at && <p>Training photos expire {new Date(job.data_expires_at).toLocaleString()}. Saved evaluation results remain available.</p>}
        <ImageTrainingResults job={job} />
        {job.status === 'uploading' && imageProfile && <button className={styles.secondary} onClick={() => { setIntakeMode('images'); setPanelOpen(true); }}>Continue image setup</button>}
        {config.decisionApiUrl && <div id={`use-model-${job.id}`} tabIndex={-1}><PrivateImageTest key={`${owner}:${job.id}`} job={job} owner={owner} token={imageToken} apiUrl={config.decisionApiUrl} storage={config.storage} /></div>}
      </>}
      {job.error && <p role="alert" className={styles.error}>{job.error}</p>}
      {job.status === 'uploading' && job.model?.id !== 'imajev-4b-v1' && <div className={styles.actions}>
        <button className={styles.secondary} disabled={busy} onClick={() => retrySubmit(job)}>Retry submission</button>
        <button className={styles.secondary} disabled={busy} onClick={() => resumeUploads(job)}>Resume missing uploads</button>
        <button className={styles.textButton} disabled={busy} onClick={() => cancelJob(job)}>Cancel this run</button>
      </div>}
      {job.model?.id !== 'imajev-4b-v1' && canDownload(job) && job.workflow?.state === 'ready' && job.workflow.model_id && <div id={`use-model-${job.id}`} tabIndex={-1}><TrainedModelQuickstart
        key={job.workflow.model_id}
        modelId={job.workflow.model_id}
        modelName={job.workflow.model_name}
        apiUrl={config.decisionApiUrl}
        apiKeys={<ApiKeysPanel client={client} apiUrl={config.decisionApiUrl} onExpired={onExpired} />}
      /></div>}
      {canDownload(job) && <details className={styles.details}>
        <summary>Model files (optional)</summary>
        <p className={styles.help}>Optional: download a private copy of the accepted adapter.</p>
        <button disabled={busy} className={styles.secondary} onClick={() => getDownloads(job)}>Get model files</button>
        {downloadJobId === job.id && downloads.length > 0 && <ul className={styles.downloads}>{downloads.map(file => <li key={file.name}><a href={file.url} target="_blank" rel="noreferrer">{file.name}</a></li>)}</ul>}
      </details>}
      <details className={styles.details}>
        <summary>{job.result ? 'Evaluation and technical details' : 'Technical details'}</summary>
        <p className={styles.id}>Run ID: {job.id}</p>
        {job.workflow?.state === 'ready' && job.workflow.model_id && <p className={styles.hash}>Full API model ID<br /><code>{job.workflow.model_id}</code></p>}
        {job.created_at && <p>Submitted {new Date(job.created_at).toLocaleString()}</p>}
        {job.model && <p>Starting model: <strong>{job.model.name}</strong></p>}
        {job.status === 'completed' && !job.result && <p>Result details are not available yet. Refresh to try again.</p>}
        {job.result && job.model?.id !== 'imajev-4b-v1' && <>
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
    return <section className={styles.runHistory} aria-label={title}><div className={styles.historyHeading}><h2>{title}</h2>{title === 'Run history' && <button className={styles.textButton} onClick={refresh} disabled={busy || refreshing}>{refreshing ? 'Checking…' : 'Refresh runs'}</button>}</div><ul>{items.map(job => <li key={job.id}>
      <Link className={styles.historyRow} href={`/train?run=${job.id}`}>
        <span><strong>{job.name}</strong>{job.created_at && <time dateTime={job.created_at}>{new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}</span>
        <span className={styles.historyStatus}>{trainingProgress(job).label}<LinkLoading /><ArrowUpRight size={16} aria-hidden="true" /></span>
      </Link>
    </li>)}</ul></section>;
  }
  return <Sheet open={panelOpen} onOpenChange={open => { if (open) focusSubmitted.current = false; setPanelOpen(open); }}>
    {runId && <Link href="/train" className={styles.textButton}>Back to Training<LinkLoading /></Link>}
    <div className={styles.workspaceHeading}>
      <div><h1>{runId ? 'Training run' : 'Training'}</h1><p>{runId ? 'The progress, evaluation, and files for this run.' : 'Your examples. Your models. Your way of deciding.'}</p></div>
      <div className={styles.workspaceActions}>
        <Link href="/billing#usage" className={styles.secondary}>Usage & billing</Link>
        <ApiKeysPanel client={client} apiUrl={config.decisionApiUrl} onExpired={onExpired} />
        {!runId && <SheetTrigger asChild><button className={styles.button} disabled={busy}><Plus size={16} aria-hidden="true" />Train a model</button></SheetTrigger>}
      </div>
    </div>
    {process.env.NEXT_PUBLIC_ZILS_BILLING_PREVIEW === 'test' && <p className={styles.notice}>Billing test preview. Submitting a standard run reserves one included run or $2 in test credit. <Link href="/billing" className={styles.textButton}>View credit and billing</Link>.</p>}
    {error && <p className={styles.error} role="alert">{error}{needsCredit && <> <Link href="/billing" className={styles.textButton}>Add credit</Link>.</>}</p>}
    {progress && <p role="status" className={styles.notice}>{progress}</p>}
    {busy && cancellable && <button type="button" className={styles.secondary} onClick={() => operation.current?.abort()}>Stop upload</button>}
    {refreshError && !runId && history.length > 0 && !selected && <p role="status" className={styles.notice}>Connection interrupted. Showing your last loaded runs; we’ll retry automatically.</p>}
    {!runId && !loading && <TrainedModelLibrary jobs={availableModels} />}
    <div className={styles.workspace}>
      {loading ? <WorkspaceLoading label={runId ? "Loading your training run" : "Loading your models and runs"} /> : !selected && (runId || !history.length) ? <section className={styles.emptyWorkspace}>
        <h2>{runId ? 'Run unavailable' : refreshError ? 'Your runs could not be loaded.' : 'Train your first model.'}</h2>
        <p>{runId ? 'Return to Training to choose a run, or try loading it again.' : refreshError ? 'Try checking again in a moment.' : 'Bring a decision and a few reviewed examples. Zils will guide you through the rest.'}</p>
        {refreshError || runId ? <button className={styles.secondary} onClick={refresh} disabled={refreshing}>Try again</button> : <SheetTrigger asChild><button className={styles.secondary}>Get started</button></SheetTrigger>}
      </section> : selected ? <div>
        <div className={styles.currentLabel}><span>{runId ? 'Run details' : 'Current run'}</span><button className={styles.textButton} onClick={refresh} disabled={busy || refreshing}>{refreshing ? 'Checking…' : 'Refresh status'}</button></div>
        <section className={`${styles.panel} ${styles.currentRun}`} aria-labelledby="current-run-title">
          <div className={styles.currentRunHeader}><h2 id="current-run-title" ref={statusMessage} tabIndex={-1}>{selected.name}</h2><span className={styles.runBadge} data-tone={trainingProgress(selected).tone}>{trainingProgress(selected).label}</span></div>
          {runId || selected.status === 'uploading' ? runDetails(selected) : <TrainingRunStatus job={selected} />}
          {!runId && <Link className={styles.textButton} href={`/train?run=${selected.id}`}>View full run<LinkLoading /></Link>}
          <p className={styles.statusFreshness} data-stale={refreshError}>{refreshError ? 'Connection interrupted. Showing the last known status; we’ll retry automatically.' : <>Last checked {checkedAt ? new Date(checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'just now'}. {!terminal(selected) && 'Updates automatically.'}</>}</p>
        </section>
      </div> : null}
      {!runId && runRows(jobs.filter(job => job.id !== selected?.id && !terminal(job)), 'Other active runs')}
      {!runId && runRows(history.filter(job => terminal(job)), 'Run history')}
    </div>
    {!runId && imagesAvailable && config.decisionApiUrl && <details className={imageStyles.stockTest}><summary>Test images with the starting model</summary><p>Try a batch or a single photo. For a trained model, choose View model above.</p><ImageDecisionPanel owner={owner} token={imageToken} apiUrl={config.decisionApiUrl} storage={config.storage} /></details>}
    {intakeMode === 'choose' && <SheetContent className={`${styles.page} ${styles.trainingSheet}`}>
      <div className={styles.sheetHeader}><SheetTitle>Train a model</SheetTitle><SheetDescription>Start with one decision. We’ll guide you through the rest.</SheetDescription></div>
      <div className={`${styles.sheetBody} ${onboardingStyles.chooserBody}`}><h3 className={styles.stepTitle}>What will your model learn from?</h3><p className={onboardingStyles.intro}>Choose the examples you have. Both paths help you define a decision, review your data and test a trained model.</p>
        <div className={onboardingStyles.typeChoices}>
          <button type="button" aria-label="Text examples" className={onboardingStyles.typeChoice} onClick={() => setIntakeMode('text')}><MessageSquareText className={onboardingStyles.typeIcon} size={26} aria-hidden="true" /><span><strong>Text examples</strong><span>Route tickets, classify feedback, or make decisions from written information.</span><small>Bring an Excel spreadsheet or CSV</small></span><ArrowRight size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Images" className={onboardingStyles.typeChoice} disabled={!imageProfile || !imageService} onClick={() => setIntakeMode('images')}><ImageIcon className={onboardingStyles.typeIcon} size={26} aria-hidden="true" /><span><strong>Images</strong><span>Spot damage, sort photos, or make decisions from what’s visible.</span><small>{imageProfile ? 'Bring photos with correct answers' : 'Image training is unavailable right now'}</small></span><ArrowRight size={18} aria-hidden="true" /></button>
        </div><p className={styles.localNote}>Your examples are uploaded only when you start training.</p>
      </div>
    </SheetContent>}
    {imageProfile && imageService && <ImageTrainingIntake active={intakeMode === 'images'} onChooseType={() => setIntakeMode('choose')} assistantConfigured={config.assistantConfigured} owner={owner} token={imageToken} trainingApi={api} imageApi={imageService} profile={imageProfile} resumeJob={jobs.find(job => job.model?.id === 'imajev-4b-v1' && job.status === 'uploading')} onSubmitted={replaceJob} />}
    <TrainingIntake active={intakeMode === 'text'} onChooseType={() => setIntakeMode('choose')} assistantConfigured={config.assistantConfigured} key={formVersion} busy={busy} onSubmit={create} onFiles={setFiles} pending={Boolean(pendingUpload)} pendingName={jobs.find(job => job.id === pendingUpload)?.name} submissionError={error} needsCredit={needsCredit} progress={progress} onStopUpload={busy && cancellable ? () => operation.current?.abort() : undefined} onCloseAutoFocus={event => {
      if (focusSubmitted.current) { event.preventDefault(); focusSubmitted.current = false; statusMessage.current?.focus(); }
    }} />
  </Sheet>;
}

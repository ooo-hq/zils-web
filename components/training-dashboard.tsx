'use client';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { canDownload, DOWNLOAD_FILES, SPLITS, STATUS_COPY, submissionSchema, terminal, trainingApi, TrainingApiError, validateDatasets, type Job, type Split, type Submission } from '@/lib/training';
import { TrainingGuide } from '@/components/training-guide';
import { TrainingIntake } from '@/components/training-intake';
import styles from '@/app/(home)/train/train.module.css';

type Config = { url: string; key: string; apiUrl: string };
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const label = (status: string) => status.replaceAll('_', ' ');
const metric = (value: number | undefined, percent = false) => value === undefined ? '—' : percent ? `${(value * 100).toFixed(2)}%` : value.toFixed(4);

export function TrainingDashboard({ config }: { config: Config }) {
  const [client] = useState(() => createClient(config.url, config.key, { auth: { storageKey: 'fez-training-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }));
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const { data } = client.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setNotice(''); } });
    client.auth.getSession().then(({ data, error }) => { if (active) { setSession(data.session); if (error) setError(error.message); } }).catch(error => { if (active) { setError(message(error)); setSession(null); } });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [client]);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/train` } });
      if (error) throw error;
      setNotice('Check your email for a sign-in link. Open it to return to your training dashboard.');
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function signOut() {
    setError('');
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) setError(error.message);
  }
  if (session === undefined) return <><TrainingGuide /><p role="status" className={styles.panel}>Checking your session…</p></>;
  return <>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {session ? <>
      <div id="training-workspace" className={styles.account}><span>Signed in as <strong>{session.user.email || 'your account'}</strong></span><button className={styles.secondary} onClick={signOut}>Sign out</button></div>
      <SignedInDashboard key={session.user.id} client={client} config={config} onExpired={signOut} />
    </> : <><TrainingGuide /><section id="training-workspace" className={`${styles.panel} ${styles.signIn}`}><span className={styles.badge}>Private workspace</span><h2>Start your training workspace.</h2><p>Log in to define your decision, prepare a CSV, and review the examples before submitting. You can also return to existing training jobs here.</p><form onSubmit={signIn}><label htmlFor="training-email">Email address</label><input id="training-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" disabled={busy} /><button className={styles.button} disabled={busy}>{busy ? 'Sending link…' : 'Email me a sign-in link'}</button></form>{notice && <p role="status" className={styles.notice}>{notice}</p>}</section></>}
  </>;
}

function SignedInDashboard({ client, config, onExpired }: { client: SupabaseClient; config: Config; onExpired: () => Promise<void> }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [cancellable, setCancellable] = useState(false);
  const [files, setFiles] = useState<Partial<Record<Split, File>>>({});
  const [downloads, setDownloads] = useState<{ name: string; url: string }[]>([]);
  const [formVersion, setFormVersion] = useState(0);
  const [pendingUpload, setPendingUpload] = useState('');
  const statusMessage = useRef<HTMLParagraphElement>(null);
  const life = useRef<AbortController | null>(null);
  const operation = useRef<AbortController | null>(null);
  const selected = jobs.find(job => job.id === selectedId);
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
        setJobs(jobs); setLoading(false);
        setPendingUpload(previous => jobs.some(job => job.id === previous && job.status !== 'uploading') ? '' : previous);
        if (jobs.some(job => !terminal(job) && job.status !== 'uploading')) timer = setTimeout(poll, 10_000);
      } catch (error) { if (!controller.signal.aborted) { errorHandler.current(error); setLoading(false); timer = setTimeout(poll, 30_000); } }
    }
    void poll();
    return () => { controller.abort(); operation.current?.abort(); clearTimeout(timer); };
  }, [api, formVersion]);

  const refresh = async () => {
    setError('');
    try {
      const { jobs } = await api.list(life.current?.signal);
      if (!life.current?.signal.aborted) {
        setJobs(jobs);
        setPendingUpload(previous => jobs.some(job => job.id === previous && job.status !== 'uploading') ? '' : previous);
      }
    } catch (error) { if (!life.current?.signal.aborted) handleError(error); }
  };
  function replaceJob(job: Job) {
    setJobs(previous => [job, ...previous.filter(other => other.id !== job.id)]);
    if (job.status !== 'uploading') setPendingUpload(previous => previous === job.id ? '' : previous);
  }
  async function selectJob(job: Job) {
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
      setProgress('Creating your job…');
      const { job, uploads } = await api.create(parsed.data, controller.signal);
      createdId = job.id; setPendingUpload(job.id); replaceJob(job); setSelectedId(job.id);
      for (const split of SPLITS) {
        setProgress(`Uploading ${split} directly to private storage…`);
        const slot = uploads[split];
        if (!('uploaded' in slot)) await api.upload(split, slot, datasets[split], controller.signal);
      }
      setProgress('Submitting for validation…');
      const submitted = await api.submit(job.id, controller.signal);
      replaceJob(submitted.job); setProgress('Submitted. The coordinator will validate the data before worker approval.');
      setFiles({}); setPendingUpload(''); setFormVersion(v => v + 1);
      requestAnimationFrame(() => statusMessage.current?.focus());
    } catch (error) {
      if (controller.signal.aborted) setProgress('Stopped locally. Any created job and completed uploads remain in your workspace.');
      else { handleError(error); setProgress(createdId ? 'Your job is saved. Retry submission if all uploads finished, or resume missing uploads using the original files.' : 'No successful submission confirmed. Refresh the job list before creating another job.'); }
    } finally { if (!life.current?.signal.aborted) setBusy(false); setCancellable(false); operation.current = null; }
  }
  async function resumeUploads(job: Job) {
    const { train, calibration, test } = files;
    if (!train || !calibration || !test) { setError('Prepare the same CSV with its original settings, or select the three original JSONL files in advanced upload. Completed uploads will be skipped.'); return; }
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
      setProgress('Uploads complete. Submitted for validation.');
    } catch (error) { if (controller.signal.aborted) setProgress('Stopped locally. Saved uploads remain.'); else handleError(error); }
    finally { setBusy(false); setCancellable(false); operation.current = null; }
  }
  async function cancelJob(job: Job) {
    setBusy(true); setError(''); setDownloads([]);
    try { const result = await api.cancel(job.id, life.current?.signal); replaceJob(result.job); if (job.id === pendingUpload) setPendingUpload(''); }
    catch (error) { if (!life.current?.signal.aborted) handleError(error); }
    finally { setBusy(false); }
  }
  async function retrySubmit(job: Job) {
    setBusy(true); setError(''); setDownloads([]);
    try { const result = await api.submit(job.id, life.current?.signal); replaceJob(result.job); setPendingUpload(''); setFiles({}); setFormVersion(v => v + 1); }
    catch (error) { if (!life.current?.signal.aborted) handleError(error); }
    finally { setBusy(false); }
  }
  async function getDownloads(job: Job) {
    setBusy(true); setError(''); setDownloads([]);
    try { const items = await api.downloads(job, life.current?.signal); if (!life.current?.signal.aborted) setDownloads(items); }
    catch (error) { if (!life.current?.signal.aborted) handleError(error); }
    finally { setBusy(false); }
  }
  return <>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.grid}>
      <div>
        <TrainingIntake key={formVersion} busy={busy} onSubmit={create} onFiles={setFiles} pending={Boolean(pendingUpload)} />
        {progress && <p ref={statusMessage} tabIndex={-1} role="status" className={styles.notice}>{progress}</p>}
        {busy && cancellable && <button type="button" className={styles.secondary} onClick={() => operation.current?.abort()}>Stop upload</button>}
      </div>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Your training jobs</h2></div><button className={styles.secondary} onClick={refresh} disabled={busy}>Refresh</button></div>
        {loading ? <p role="status">Loading your jobs…</p> : jobs.length === 0 ? <p className={styles.empty}>Your first training job will appear here after submission. Prepare and submit your examples to get started.</p> : <ul className={styles.jobs}>{jobs.map(job => <li key={job.id}><button disabled={busy} className={styles.jobButton} aria-pressed={selectedId === job.id} onClick={() => selectJob(job)}><strong>{job.name}</strong><span className={styles.badge}>{label(job.status)}</span></button></li>)}</ul>}
        {selected && <div className={styles.jobDetail}><h3>{selected.name}</h3><p className={styles.id}>{selected.id}</p>{selected.created_at && <p className={styles.help}>Created {new Date(selected.created_at).toLocaleString()}</p>}<p className={styles.notice} role="status">{STATUS_COPY[selected.status]}</p>{selected.error && <p role="alert" className={styles.error}>{selected.error}</p>}
          {selected.status === 'uploading' && <><p className={styles.help}>If all three uploads completed, retry submission. To resume a failed upload, prepare the same CSV with the original settings, or choose the original files in advanced JSONL upload. Completed uploads are skipped; existing files are not overwritten.</p><button className={styles.secondary} disabled={busy} onClick={() => retrySubmit(selected)}>Retry submission</button><button className={styles.secondary} disabled={busy} onClick={() => resumeUploads(selected)}>Resume missing uploads</button><button className={styles.secondary} disabled={busy} onClick={() => cancelJob(selected)}>Cancel this job</button></>}
          {selected.status === 'completed' && !selected.result && <p>Result details are not available yet. Refresh to try again.</p>}
          {selected.result && <><h3 className={styles.resultTitle}>{selected.result.delivery.status === 'accepted' ? 'A model met your criteria.' : 'No model met your criteria.'}</h3><p className={styles.help}>Measured on this job’s held-out data; not a guarantee on future inputs. Artifact delivery does not deploy an inference endpoint.</p><div className={styles.metrics}><div><span>Baseline accuracy</span><strong>{metric(selected.result.baseline.accuracy, true)}</strong></div><div><span>Baseline Brier loss</span><strong>{metric(selected.result.baseline.brier)}</strong></div></div><p className={styles.help}>Required: {metric(selected.result.delivery.acceptance.min_accuracy, true)} accuracy; {metric(selected.result.delivery.acceptance.min_brier_improvement)} absolute Brier improvement.</p>
            <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Candidate evaluations"><table><thead><tr><th>Candidate</th><th>Status</th><th>Accuracy</th><th>Brier ↓</th></tr></thead><tbody>{selected.result.miners.map(miner => <tr key={miner.uid}><th>{miner.uid}{selected.result?.delivery.uid === miner.uid ? ' · selected' : ''}</th><td>{miner.status}</td><td>{metric(miner.accuracy, true)}</td><td>{metric(miner.brier)}</td></tr>)}</tbody></table></div>
            {selected.result.delivery.sha256 && <p className={styles.hash}>Checkpoint SHA-256<br /><code>{selected.result.delivery.sha256}</code></p>}
            {canDownload(selected) && <><button disabled={busy} className={styles.button} onClick={() => getDownloads(selected)}>Get private download links</button><p className={styles.help}>Links expire. Generate fresh links when needed. Files: {DOWNLOAD_FILES.join(', ')}.</p>{downloads.length > 0 && <ul className={styles.downloads}>{downloads.map(file => <li key={file.name}><a href={file.url} target="_blank" rel="noreferrer">{file.name} ↗</a></li>)}</ul>}</>}
          </>}
        </div>}
      </section>
    </div>
  </>;
}

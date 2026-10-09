'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuthSession } from '@/components/auth-session';
import { ApiKeysPanel } from '@/components/api-keys-panel';
import { TrainedModelQuickstart } from '@/components/trained-model-quickstart';
import { ImageTrainingResults, PrivateImageTest } from '@/components/image-training-results';
import { canDownload, trainingApi, TrainingApiError, type Job } from '@/lib/training';
import { trainingProgress } from '@/lib/training-status';
import { billingApi, formatCredit, type BillingSummary } from '@/lib/billing';
import type { TrainingConfig } from '@/lib/training-config';
import training from '@/app/(home)/train/train.module.css';
import styles from './trained-model-detail.module.css';

const percent = (value?: number) => value === undefined ? 'Not recorded' : `${(value * 100).toFixed(2)}%`;
const decimal = (value?: number) => value === undefined ? 'Not recorded' : value.toFixed(4);
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
type Props = { jobId: string; config: TrainingConfig };

export function TrainedModelDetail(props: Props) {
  const { client, session, error } = useAuthSession(props.config);
  if (session === undefined) return <p role="status" className={styles.loading}>Checking your session…</p>;
  if (!session || !client) return <section className={`${training.panel} ${styles.empty}`}>
    <h1>Sign in to view this model</h1><p>Model results and access details are private to the account that trained it.</p>
    {error && <p role="alert" className={training.error}>{error}</p>}
    <Link href="/train" className={training.button}>Sign in to Zils</Link>
  </section>;
  return <AccountModel key={`${session.user.id}:${props.jobId}`} {...props} owner={session.user.id} client={client} />;
}

function AccountModel({ jobId, config, owner, client }: Props & { owner: string; client: SupabaseClient }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const token = useCallback(async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session?.user.id === owner ? data.session.access_token : '';
  }, [client, owner]);
  const api = useMemo(() => trainingApi(config.apiUrl, config.storage, token), [config.apiUrl, config.storage, token]);
  const signOut = useCallback(async () => {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) setError(error.message);
  }, [client]);
  useEffect(() => {
    const controller = new AbortController();
    api.get(jobId, controller.signal).then(({ job }) => {
      if (controller.signal.aborted) return;
      if (job.id !== jobId) throw new Error('The service returned a different model. Please try again.');
      if (!canDownload(job)) throw new Error('This run does not have an approved model yet. Check its progress in your training workspace.');
      setJob(job);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setError(error instanceof TrainingApiError && [403, 404].includes(error.status)
        ? 'This model is not available to this account.'
        : error instanceof Error ? error.message : 'Model details could not be loaded. Please try again.');
      if (error instanceof TrainingApiError && error.status === 401) void signOut();
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, jobId, revision, signOut]);
  function refresh() { setJob(null); setError(''); setLoading(true); setRevision(value => value + 1); }
  if (loading) return <p role="status" className={styles.loading}>Loading your model…</p>;
  if (!job) return <section className={`${training.panel} ${styles.empty}`}>
    <h1>Model unavailable</h1><p role="alert">{error}</p>
    <button className={training.secondary} onClick={refresh}>Try again</button>
  </section>;

  const result = job.result!;
  const selected = result.miners.find(candidate => candidate.uid === result.delivery.uid);
  const ready = job.workflow?.state === 'ready' && Boolean(job.workflow.model_id);
  const image = job.model?.id === 'imajev-4b-v1';
  const baselineLabel = job.selection?.previous ? 'Previous version' : 'Starting model';
  const progress = trainingProgress(job);
  return <div className={styles.detail}>
    <header className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>Your {image ? 'image' : 'text'} model <span>{ready ? 'Ready to use' : progress.label}</span></p>
        <h1>{job.name}</h1>
        <p>Private to your account{job.created_at && <> · Created {date(job.created_at)}</>}.</p>
      </div>
      <div className={styles.actions}>
        <button className={training.secondary} onClick={refresh}>Refresh</button>
        {ready && <a href="#model-access" className={training.button}>Use this model</a>}
      </div>
    </header>
    {error && <p role="alert" className={training.error}>{error}</p>}
    {!ready && <section className={training.notice} aria-label="Model activation"><strong>{progress.title}</strong><p>{progress.detail} {progress.next}</p></section>}

    <section className={styles.section} aria-labelledby="model-results-heading">
      <div className={styles.sectionHeading}><div><h2 id="model-results-heading">How this model performed</h2><p>Evaluation on examples held out from training.</p></div><span>Selected version</span></div>
      <dl className={styles.stats}>
        <div><dt>Accuracy</dt><dd>{percent(selected?.accuracy)}</dd><p>{baselineLabel}: {percent(result.baseline.accuracy)}</p></div>
        <div><dt>Probability error</dt><dd>{decimal(selected?.brier)}</dd><p>Brier loss · Lower is better. {baselineLabel}: {decimal(result.baseline.brier)}</p></div>
        <div><dt>Test examples</dt><dd>{selected?.count ?? selected?.cases ?? 'Not recorded'}</dd><p>For the selected model</p></div>
      </dl>
      {!selected && <p className={training.notice}>The selected model’s detailed scores were not included in this result. No other candidate’s scores are substituted.</p>}
      <p className={styles.note}>Approval targets: at least {percent(result.delivery.acceptance.min_accuracy)} accuracy and {decimal(result.delivery.acceptance.min_brier_improvement)} improvement in Brier loss. These results do not guarantee accuracy on future inputs.</p>
      {image && <details className={training.details}><summary>Image evaluation details</summary><ImageTrainingResults job={job} /></details>}
    </section>

    {ready && job.workflow?.model_id && <>
      <ModelUsage key={job.workflow.model_id} modelId={job.workflow.model_id} apiUrl={config.decisionApiUrl} token={token} />
      <section id="model-access" className={styles.section} aria-labelledby="model-access-heading">
        <h2 id="model-access-heading">Access this model</h2>
        {image ? <>
          <p>Your API model ID: <code className={styles.identifier}>{job.workflow.model_id}</code></p>
          {config.decisionApiUrl ? <>
            <p>Use your account’s API key. Open the image tester below for the saved question and an API request example.</p>
            <ApiKeysPanel client={client} apiUrl={config.decisionApiUrl} onExpired={signOut} />
            <div className={styles.imageTest}><PrivateImageTest job={job} owner={owner} token={token} apiUrl={config.decisionApiUrl} storage={config.storage} /></div>
          </> : <p>The API address is not configured here. Contact Zils for connection details.</p>}
        </> : <TrainedModelQuickstart modelId={job.workflow.model_id} modelName={job.workflow.model_name} apiUrl={config.decisionApiUrl} apiKeys={<ApiKeysPanel client={client} apiUrl={config.decisionApiUrl} onExpired={signOut} />} />}
      </section>
    </>}

    <details className={`${training.details} ${styles.technical}`}>
      <summary>Model version and technical details</summary>
      <dl>
        {job.workflow?.model_id && <div><dt>Full API model ID</dt><dd><code>{job.workflow.model_id}</code></dd></div>}
        {job.workflow?.model_name && <div><dt>API model name</dt><dd><code>{job.workflow.model_name}</code></dd></div>}
        {job.model && <div><dt>Starting model</dt><dd>{job.model.name}</dd></div>}
        <div><dt>Training run</dt><dd><code>{job.id}</code></dd></div>
        {job.selection?.previous && <div><dt>Previous version</dt><dd><Link href={`/train/models/${job.selection.previous.job_id}`}>{job.selection.previous.model_id}</Link></dd></div>}
        {result.delivery.sha256 && <div><dt>Checkpoint SHA-256</dt><dd><code>{result.delivery.sha256}</code></dd></div>}
      </dl>
    </details>
  </div>;
}

function ModelUsage({ modelId, apiUrl, token }: { modelId: string; apiUrl: string | null; token: () => Promise<string> }) {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(apiUrl));
  useEffect(() => {
    if (!apiUrl) return;
    const controller = new AbortController();
    billingApi(apiUrl, token).summary(controller.signal)
      .then(data => { if (!controller.signal.aborted) setSummary(data); })
      .catch(() => { if (!controller.signal.aborted) setError('Usage could not be loaded. Your model and API instructions are still available.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiUrl, token]);
  const usage = summary?.usage;
  const model = usage?.models.find(row => row.model_id === modelId);
  const count = (value: string) => BigInt(value).toLocaleString();
  return <section className={styles.section} aria-labelledby="model-usage-heading">
    <div className={styles.sectionHeading}><div><h2 id="model-usage-heading">API usage</h2><p>For this model version only{summary?.mode === 'test' ? ' · Test mode' : ''}.</p></div><Link href="/billing#usage" className={training.textButton}>Account billing ↗</Link></div>
    {loading ? <p role="status">Loading usage…</p> : error ? <p role="status">{error}</p> : !usage ? <p>Usage reporting is not available for this model yet.</p> : <>
      <p className={styles.note}>{date(usage.since)} – {date(usage.until)}</p>
      {!model ? <p>No recorded API usage for this model in this period.</p> : <dl className={styles.stats}>
        <div><dt>Completed calls</dt><dd>{count(model.calls)}</dd><p>{count(model.failed_calls)} failed · {count(model.active_calls)} in progress</p></div>
        <div><dt>Billable input tokens</dt><dd>{count(model.input_tokens)}</dd><p>Recorded token usage</p></div>
        <div><dt>API spend</dt><dd>{formatCredit(model.spend_nanos)}</dd><p>{summary?.mode === 'test' ? 'Test credit' : 'Excludes training and top-ups'}</p></div>
      </dl>}
      <p className={styles.note}>Calls are grouped by when they started; spend by when it was charged. Each batch item counts as one call. Earlier calls without a recorded model or token count remain in account totals.</p>
    </>}
  </section>;
}

'use client';

import { modelDisplayName } from '@/lib/model-name';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { WorkspaceLoading, LinkLoading } from '@/components/workspace-loading';
import { useAuthSession } from '@/components/auth-session';
import { ApiKeysPanel } from '@/components/api-keys-panel';
import { TrainedModelQuickstart } from '@/components/trained-model-quickstart';
import { ImageTrainingResults, PrivateImageTest } from '@/components/image-training-results';
import { PageHero, Section, workspacePage } from '@/components/workspace-page';
import { canDownload, canDownloadFiles, downloadFiles, isImageJob, trainingApi, TrainingApiError, type Job } from '@/lib/training';
import { trainingProgress } from '@/lib/training-status';
import { newerBase, trainingBase, type BaseConfig } from '@/lib/base-model';
import { billingApi, formatBalance, formatCredit, type BillingSummary } from '@/lib/billing';
import type { TrainingConfig } from '@/lib/training-config';
import training from '@/app/(home)/train/train.module.css';
import styles from './trained-model-detail.module.css';

const percent = (value?: number) => value === undefined ? 'Not recorded' : `${(value * 100).toFixed(2)}%`;
const decimal = (value?: number) => value === undefined ? 'Not recorded' : value.toFixed(4);
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
type Props = { jobId: string; config: TrainingConfig };
const BACK = <Link href="/models" className={training.textButton}>Back to models<LinkLoading /></Link>;

export function TrainedModelDetail(props: Props) {
  const { client, session, error } = useAuthSession(props.config);
  if (session === undefined) return <WorkspaceLoading label="Loading your model" />;
  if (!session || !client) return <div className={styles.model}>
    <PageHero back={BACK} title="Sign in to view this model" intro="Model results and access details are private to the account that trained it." action={<Link href="/train" className={training.button}>Sign in to Zils</Link>} />
    {error && <p role="alert" className={workspacePage.notice}>{error}</p>}
  </div>;
  return <AccountModel key={`${session.user.id}:${props.jobId}`} {...props} owner={session.user.id} client={client} />;
}

function AccountModel({ jobId, config, owner, client }: Props & { owner: string; client: SupabaseClient }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [bases, setBases] = useState<BaseConfig | null>(null);
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]), [fetching, setFetching] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    trainingBase(config.apiUrl, controller.signal).then(value => { if (!controller.signal.aborted) setBases(value); })
      .catch(() => { if (!controller.signal.aborted) setBases(null); });
    return () => controller.abort();
  }, [config.apiUrl, revision]);
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
    let timer: ReturnType<typeof setTimeout>;
    function load() { return api.get(jobId, controller.signal).then(({ job }) => {
      if (controller.signal.aborted) return;
      if (job.id !== jobId) throw new Error('The service returned a different model. Please try again.');
      if (!canDownload(job)) throw new Error('This run does not have an approved model yet. Check its progress in your training workspace.');
      setJob(job);
      setError('');
      // Keep checking while something on the page is still on its way: the JEV comparison, or API access being prepared.
      if ((job.jev_comparison && ['pending', 'running'].includes(job.jev_comparison.status)) || job.workflow?.state === 'activating') timer = setTimeout(load, 10_000);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setJob(null);
      setError(error instanceof TrainingApiError && [403, 404].includes(error.status)
        ? 'This model is not available to this account.'
        : error instanceof Error ? error.message : 'Model details could not be loaded. Please try again.');
      if (error instanceof TrainingApiError && error.status === 401) void signOut();
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [api, jobId, revision, signOut]);
  function refresh() { setJob(null); setError(''); setLoading(true); setRevision(value => value + 1); }
  if (loading) return <WorkspaceLoading label="Loading your model" />;
  if (!job) return <div className={styles.model}>
    <PageHero back={BACK} title="Model unavailable" action={<button className={training.secondary} onClick={refresh}>Try again</button>} />
    <p role="alert" className={workspacePage.notice}>{error}</p>
  </div>;
  async function getFiles(job: Job) {
    setFetching(true); setError('');
    try { setFiles(await api.downloads(job)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The model files could not be prepared. Please try again.'); }
    finally { setFetching(false); }
  }

  const result = job.result!;
  const selected = result.miners.find(candidate => candidate.uid === result.delivery.uid);
  const ready = job.workflow?.state === 'ready' && Boolean(job.workflow.model_id);
  const image = isImageJob(job);
  const baselineLabel = job.selection?.previous ? 'Previous version' : 'Starting model';
  const jev = job.jev_comparison;
  const comparison = !image && jev?.status === 'completed' && jev.checkpoint_sha256 === result.delivery.sha256 && jev.trained_accuracy === selected?.accuracy ? jev : null;
  const comparing = !image && (jev?.status === 'pending' || jev?.status === 'running');
  const referenceAccuracy = image ? result.baseline.accuracy : comparison?.accuracy;
  const difference = comparison ? (comparison.trained_accuracy - comparison.accuracy) * 100 : null;
  const progress = trainingProgress(job);
  const migration = bases && newerBase(bases, job);
  return <div className={styles.model}>
    <PageHero back={BACK} title={job.name}
      intro={<><span className={workspacePage.status} data-tone={ready ? undefined : 'busy'}>{ready ? 'Ready to use' : progress.label}</span>{' '}{image ? 'Image' : 'Text'} model, private to your account.{job.created_at && ` Trained ${date(job.created_at)}.`}</>}
      action={ready && <div className={styles.heroActions}>
        <a href="#model-access" className={training.button}>Use this model</a>
        {!image && <Link className={training.secondary} href={`/train?upgrade=${job.id}`}>Train a replacement<LinkLoading /></Link>}
      </div>} />
    <nav aria-label="Model sections" className={styles.sectionNav}><a href="#model-results">Results</a>{ready && <><a href="#model-access">Access</a><a href="#model-usage">Usage</a></>}<a href="#model-details">Files and details</a></nav>
    {error && <p role="alert" className={workspacePage.notice}>{error}</p>}
    {!ready && <section className={workspacePage.notice} aria-label="Model activation"><strong>{progress.title}</strong> {progress.detail} {progress.next}</section>}
    {migration && <section id="model-migration" className={`${workspacePage.notice} ${styles.migration}`} aria-label="Newer base available">
      <div><strong>Newer base available</strong><p>{modelDisplayName(migration.name)} is available for this model. Reuse your saved examples and settings. Your current model stays live until the replacement passes your success criteria.</p></div>
      <Link className={training.secondary} href={{ pathname: '/train', query: { upgrade: job.id, migrate: migration.selection.model } }}>Migrate<LinkLoading /></Link>
    </section>}

    <section className={styles.section} aria-labelledby="model-results">
      <Section label="How this model performed" id="model-results" action={<button onClick={refresh}>Refresh</button>} />
      <div className={workspacePage.split}>
        <div>
          <p className={workspacePage.label}>Your trained model</p>
          <span className={workspacePage.amount}>{percent(selected?.accuracy)}</span>
          <p className={workspacePage.sub}>{comparison ? `Both models evaluated on the same ${comparison.count.toLocaleString()} held-out examples.` : 'Accuracy on examples held out from training.'}</p>
          <p className={workspacePage.fine}>{difference === null ? 'Selected version' : `${difference > 0 ? '+' : ''}${difference.toFixed(2)} percentage points vs JEV`}</p>
        </div>
        <div>
          <dl className={styles.comparison} aria-label="Accuracy">
            <div data-trained="true"><dt>This model</dt><dd><span className={styles.track} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, (selected?.accuracy ?? 0) * 100))}%` }} /></span></dd></div>
            <div><dt>{image ? baselineLabel : 'TypeSafe JEV'}</dt><dd><strong>{referenceAccuracy === undefined ? (comparing ? 'Evaluating…' : 'Not evaluated') : percent(referenceAccuracy)}</strong>{referenceAccuracy !== undefined && <span className={styles.track} aria-hidden="true"><span style={{ width: `${referenceAccuracy * 100}%` }} /></span>}</dd></div>
          </dl>
          <dl className={styles.supportingStats}>
            <div><dt>Probability error</dt><dd>{decimal(selected?.brier)}</dd><p>Brier loss. Lower is better.<br />{baselineLabel}: {decimal(result.baseline.brier)}</p></div>
            <div><dt>Test examples</dt><dd>{comparison?.count ?? selected?.count ?? selected?.cases ?? 'Not recorded'}</dd><p>{comparison ? 'Same examples for both models' : 'For the selected model'}</p></div>
          </dl>
        </div>
      </div>
      <div className={styles.notes}>
        {!image && <p role={comparing ? 'status' : undefined}>{comparison ? `${comparison.model} · Evaluated ${date(comparison.evaluated_at)}. Saved once; viewing this page makes no JEV calls.` : comparing ? `Comparing with TypeSafe JEV${jev?.status === 'running' && jev.count ? `: ${jev.completed_cases ?? 0} of ${jev.count} examples` : ' after training'}. Your model is ready to use while this runs.` : jev?.status === 'failed' ? 'The JEV comparison could not be completed. Your trained model’s results are still available.' : jev?.status === 'skipped' ? 'This test set exceeds the automatic JEV comparison limit. Your trained model’s full evaluation is shown.' : 'No JEV comparison is recorded for this run.'}</p>}
        {!image && <p>{baselineLabel} accuracy: {percent(result.baseline.accuracy)}. Model approval uses this baseline; JEV is a separate comparison.</p>}
        {!selected && <p className={training.notice}>The selected model’s detailed scores were not included in this result. No other candidate’s scores are substituted.</p>}
        {result.delivery.acceptance && <p>Approval targets: at least {percent(result.delivery.acceptance.min_accuracy)} accuracy; {result.delivery.acceptance.migration === 'no_regression' ? 'Brier score must match or improve on your previous model' : result.delivery.acceptance.migration ? 'at most 0.005 increase in Brier loss' : `${decimal(result.delivery.acceptance.min_brier_improvement)} improvement in Brier loss`}. These results do not guarantee accuracy on future inputs.</p>}
        {job.model?.id === 'imajev-4b-v1' && <details className={training.details}><summary>Image evaluation details</summary><ImageTrainingResults job={job} /></details>}
      </div>
    </section>

    {ready && job.workflow?.model_id && <>
      <section className={styles.section} aria-labelledby="model-access">
        <Section label="Access this model" id="model-access" />
        <div className={styles.body}>{image ? <>
          <p>Your API model ID: <code className={styles.identifier}>{job.workflow.model_id}</code></p>
          {config.decisionApiUrl ? <>
            <p>Use your account’s API key. Open the image tester below for the saved question and an API request example.</p>
            <ApiKeysPanel client={client} apiUrl={config.decisionApiUrl} onExpired={signOut} />
            <div className={styles.imageTest}><PrivateImageTest job={job} owner={owner} token={token} apiUrl={config.decisionApiUrl} storage={config.storage} /></div>
          </> : <p>The API address is not configured here. Contact Zils for connection details.</p>}
        </> : <TrainedModelQuickstart modelId={job.workflow.model_id} modelName={job.workflow.model_name} modelAlias={job.workflow.model_alias} apiUrl={config.decisionApiUrl} apiKeys={<ApiKeysPanel client={client} apiUrl={config.decisionApiUrl} onExpired={signOut} />} />}</div>
      </section>
      <ModelUsage key={job.workflow.model_id} modelId={job.workflow.model_id} apiUrl={config.decisionApiUrl} token={token} />
    </>}

    {/* Everything about where this model came from, which the run page also held: its files, its run and each candidate's scores. */}
    <section className={styles.section} aria-labelledby="model-details">
      <Section label="Files and details" id="model-details" />
      <div className={workspacePage.split}>
        <div>
          <p className={workspacePage.label}>Model files</p>
          {canDownloadFiles(job) ? <>
            <p className={workspacePage.sub}>Optional: download a private copy of the accepted adapter. Zils serves the model either way.</p>
            <div className={workspacePage.actions}><button className={training.secondary} disabled={fetching} onClick={() => void getFiles(job)}>{fetching ? 'Preparing…' : 'Get model files'}</button></div>
            {files.length > 0 && <ul className={styles.files}>{files.map(file => <li key={file.name}><a href={file.url} target="_blank" rel="noreferrer">{file.name}</a></li>)}</ul>}
            <p className={workspacePage.fine}>Download links expire. Files: {downloadFiles(job).join(', ')}.</p>
          </> : <p className={workspacePage.sub}>This model was trained on the open tier, so Zils serves it: use it through the API. Model files come with private training.</p>}
        </div>
        <div>
          <p className={workspacePage.label}>This version</p>
          <dl className={styles.technical}>
            {job.workflow?.model_name && <div><dt>API model name</dt><dd><code>{job.workflow.model_name}</code></dd></div>}
            {job.workflow?.model_alias && <div><dt>Task alias</dt><dd><code>{job.workflow.model_alias}</code> · follows this task across replacements</dd></div>}
            {job.workflow?.model_id && <div><dt>Full API model ID</dt><dd><code>{job.workflow.model_id}</code></dd></div>}
            {job.model && <div><dt>Starting model</dt><dd>{modelDisplayName(job.model.name)}</dd></div>}
            {job.selection?.previous && <div><dt>Previous version</dt><dd><Link href={`/models/${job.selection.previous.job_id}`}>{job.selection.previous.model_id}</Link></dd></div>}
            {result.delivery.sha256 && <div><dt>Checkpoint SHA-256</dt><dd><code>{result.delivery.sha256}</code></dd></div>}
          </dl>
          <p className={workspacePage.fine}>Run ID: {job.id}</p>
        </div>
      </div>
      {job.model?.id !== 'imajev-4b-v1' && <div className={styles.body}>
        <p className={workspacePage.label}>Every candidate from this run</p>
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Candidate evaluations"><table className={styles.table}>
          <thead><tr><th scope="col">Candidate</th><th scope="col">Status</th><th scope="col">Accuracy</th><th scope="col">Brier loss</th></tr></thead>
          <tbody>{result.miners.map(miner => <tr key={miner.uid} data-selected={result.delivery.uid === miner.uid || undefined}><th scope="row">{miner.uid}{result.delivery.uid === miner.uid ? ' · selected' : ''}</th><td>{miner.status}</td><td>{percent(miner.accuracy)}</td><td>{decimal(miner.brier)}</td></tr>)}</tbody>
        </table></div>
        <p className={workspacePage.fine}>Measured on examples held aside from training. The selected candidate is the model you call.</p>
      </div>}
    </section>
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
  return <section className={styles.section} aria-labelledby="model-usage">
    <Section label="API usage" id="model-usage" action={<Link href="/usage">Account usage</Link>} />
    <div className={styles.body}>
    <p>For this model version only{summary?.mode === 'test' ? ' (Test mode)' : ''}.</p>
    {loading ? <p role="status">Loading usage…</p> : error ? <p role="status">{error}</p> : !usage ? <p>Usage reporting is not available for this model yet.</p> : <>
      <p className={styles.note}>{date(usage.since)} – {date(usage.until)}</p>
      {!model ? <p>No recorded API usage for this model in this period.</p> : <dl className={styles.stats}>
        <div><dt>Completed calls</dt><dd>{count(model.calls)}</dd><p>{count(model.failed_calls)} failed · {count(model.active_calls)} in progress</p></div>
        <div><dt>Billable input tokens</dt><dd>{count(model.input_tokens)}</dd><p>Recorded token usage</p></div>
        <div><dt>API spend</dt><dd title={formatCredit(model.spend_nanos)}>{formatBalance(model.spend_nanos)}</dd><p>{summary?.mode === 'test' ? 'Test credit' : 'Excludes training and top-ups'}</p></div>
      </dl>}
      <p className={styles.note}>Calls are grouped by when they started; spend by when it was charged. Each batch item counts as one call. Earlier calls without a recorded model or token count remain in account totals.</p>
    </>}
    </div>
  </section>;
}

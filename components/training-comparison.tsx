'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { canDownload, TrainingApiError, type Comparison, type Job, type trainingApi } from '@/lib/training';
import { correctCount, percent, points, trainingComparison, validateComparisonFile } from '@/lib/training-comparison';
import styles from './training-comparison.module.css';

type Api = ReturnType<typeof trainingApi>;
const failure = (error: unknown) => error instanceof Error ? error.message : 'Comparison could not finish. Try again.';

function Score({ name, accuracy, count }: { name: string; accuracy: number; count?: number }) {
  return <div className={styles.score}><span>{name}</span><strong>{percent(accuracy)}</strong><small>{correctCount(accuracy, count) || 'Accuracy'}</small><div className={styles.track} aria-hidden="true"><span style={{ width: `${accuracy * 100}%` }} /></div></div>;
}

export function TrainingComparison({ job, api }: { job: Job; api: Api }) {
  const result = trainingComparison(job);
  if (!result) return null;
  return <section className={styles.comparison} aria-label="Model accuracy comparison">
    <p className={styles.eyebrow}>Your training result</p>
    <h3>{result.title}</h3>
    <div className={styles.scores}><Score name="Your trained model" accuracy={result.selected.accuracy} count={result.count} /><Score name={result.baseline.name} accuracy={result.baseline.accuracy} count={result.count} /></div>
    <p className={styles.change}><strong>{points(result.difference)} percentage points</strong>{result.probabilityImproved && <span> · Better probability estimates</span>}</p>
    <p className={styles.note}>These examples helped select your model. This result compares it with {result.baseline.name}, not TypeSafe’s hosted Jev. A fresh test is needed to measure performance against Jev.</p>
    {result.probabilityImproved && <details className={styles.method}><summary>What improved?</summary><p>Probability error fell from {result.baseline.brier.toFixed(3)} to {result.selected.brier.toFixed(3)}. Lower is better. This can improve even when the number of correct answers stays the same.</p></details>}
    {canDownload(job) && job.model?.id === 'jevk5-4b-v0.3' && <JevComparison job={job} api={api} />}
  </section>;
}

function JevComparison({ job, api }: { job: Job; api: Api }) {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [revision, setRevision] = useState(0);
  const life = useRef<AbortController | null>(null);
  const id = useId();
  useEffect(() => {
    const controller = new AbortController(); life.current = controller;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const data = await api.comparison(job.id, controller.signal);
        if (controller.signal.aborted) return;
        setComparison(data.comparison); setAvailable(data.available);
        if (['queued', 'running'].includes(data.comparison?.status || '')) timer = setTimeout(poll, 10_000);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof TrainingApiError && error.status === 404) { setAvailable(false); return; }
        setError(failure(error));
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [api, job.id, revision]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent || !unseen || !file || busy) return;
    const signal = life.current?.signal;
    setBusy(true); setError(''); setProgress('Checking the new test file…');
    try {
      await validateComparisonFile(file);
      signal?.throwIfAborted();
      const created = await api.createComparison(job.id, signal);
      setComparison(created.comparison);
      if (created.upload && !('uploaded' in created.upload)) {
        setProgress('Saving the new examples to private storage…');
        await api.upload('comparison', created.upload, file, signal);
      }
      const submitted = await api.submitComparison(job.id, signal);
      if (signal?.aborted) return;
      setComparison(submitted.comparison); setOpen(false); setFile(null); setProgress(''); setRevision(value => value + 1);
    } catch (error) { if (!signal?.aborted) { setError(failure(error)); setProgress(''); } }
    finally { if (!signal?.aborted) setBusy(false); }
  }
  const result = comparison?.status === 'completed' ? comparison.result : null;
  const different = result?.rows.filter(row => row.trained !== row.jev) || [];
  if (result && comparison) return <div className={styles.jev}>
    <p className={styles.eyebrow}>Independent test · {comparison.jev_model}</p>
    <h3>{result.verdict === 'more_accurate' ? 'More accurate than Jev on this test' : result.verdict === 'less_accurate' ? 'Less accurate than Jev on this test' : 'No clear accuracy difference yet'}</h3>
    <div className={styles.scores}><Score name="Your trained model" accuracy={result.trained.accuracy} count={result.cases} /><Score name="Jev" accuracy={result.jev.accuracy} count={result.cases} /></div>
    <p className={styles.change}><strong>{points(result.accuracy_difference)} percentage points</strong> across {result.cases} new examples.</p>
    <p className={styles.note}>95% estimated range: {points(result.accuracy_difference_95_ci[0])} to {points(result.accuracy_difference_95_ci[1])} points. {result.groups} independent source groups.{result.groups < 30 ? ' This sample is too small to declare either model more accurate.' : ' Results apply to this test; they do not guarantee future accuracy.'}</p>
    <p className={styles.note}>Your model alone was correct on {result.wins}; Jev alone was correct on {result.losses}.</p>
    <details className={styles.method}><summary>See answers and test details</summary>
      <p>{result.method}</p>
      <p>Probability error: your model {result.trained.brier.toFixed(3)} · Jev {result.jev.brier.toFixed(3)}. Lower is better. Jev’s rounded probabilities are normalized before this calculation. Accuracy uses Jev’s returned choice; yes/no and score questions use the highest-probability label.</p>
      <p>Known training and model-selection examples are excluded. This relies on your confirmation that these examples were never used for other training or tuning.</p>
      {different.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Different model answers"><table><caption>All {different.length} disagreements</caption><thead><tr><th>Example</th><th>Expected</th><th>Your model</th><th>Jev</th></tr></thead><tbody>{different.map(row => <tr key={row.id}><td>{row.id}</td><td>{row.expected}</td><td>{row.trained}{row.trained_correct ? ' · correct' : ''}</td><td>{row.jev}{row.jev_correct ? ' · correct' : ''}</td></tr>)}</tbody></table></div> : <p>Both models gave the same answer on every example.</p>}
      <p className={styles.identity}>Model: {comparison.model_id}<br />Test file: {comparison.input_sha256}<br />Completed: {comparison.finished_at ? new Date(comparison.finished_at).toLocaleString() : '—'}</p>
    </details>
  </div>;
  return <div className={styles.jev}>
    <h4>Compare with Jev</h4>
    {comparison?.status === 'failed' ? <p role="alert">{comparison.error || 'No complete comparison is available. Contact support.'}</p> : comparison?.status === 'queued' || comparison?.status === 'running' ? <p role="status">{comparison.status === 'queued' ? 'Comparison queued.' : 'Testing both models on the same new examples.'} This page updates automatically.</p> : <>
      <p className={styles.note}>Test the selected model against Jev using new, reviewed examples. Results can show an improvement, a regression, or no clear difference.</p>
      {available === false ? <p className={styles.note}>Jev comparison is not enabled on this service yet.</p> : available === null ? <p role="status" className={styles.note}>Checking comparison availability…</p> : <>
        <button className={styles.button} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls={id}>{comparison?.status === 'uploading' ? 'Resume comparison setup' : 'Set up comparison'}</button>
        {open && <form id={id} onSubmit={submit} className={styles.form}>
          <label htmlFor={`${id}-file`}>New test examples (.jsonl)</label>
          <input id={`${id}-file`} type="file" accept=".jsonl,application/jsonl" disabled={busy} onChange={event => setFile(event.target.files?.[0] || null)} required />
          <p className={styles.note}>Up to 500 examples, 5 MiB. Use at least 30 unrelated source groups for a meaningful comparison. Include id, group_id, family, state, question and the reviewed label on each line. Keep the same decision question used during training.</p>
          {comparison?.status === 'uploading' && <p className={styles.note}>Choose the original comparison file to resume. A saved file cannot be replaced.</p>}
          <label className={styles.check}><input type="checkbox" checked={unseen} disabled={busy} onChange={event => setUnseen(event.target.checked)} required /><span>These examples and related conversations have never been used to train, select or tune this model.</span></label>
          <label className={styles.check}><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} required /><span>I approve sending this file’s inputs and questions to TypeSafe to run Jev. Zils keeps the answer labels for scoring.</span></label>
          <p className={styles.note}>One fixed test per trained model. The result is saved even if Jev performs better.</p>
          <button className={styles.button} disabled={busy || !file || !consent || !unseen}>{busy ? 'Preparing comparison…' : 'Run comparison'}</button>
        </form>}
      </>}
    </>}
    {progress && <p role="status">{progress}</p>}
    {error && <p role="alert">{error} <button className={styles.retry} disabled={busy} onClick={() => { setError(''); setRevision(value => value + 1); }}>Refresh comparison</button></p>}
  </div>;
}

'use client';

import type { StorageLocations } from '@/lib/storage';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Job } from '@/lib/training';
import { isImageReady } from '@/lib/training-status';
import { imageApi, type ImageQuestion } from '@/lib/images';
import { ImageDecisionPanel } from './image-decision-panel';
import styles from '@/app/(home)/train/train.module.css';

const percent = (value: number | null | undefined) => value == null ? 'Not measured' : `${Number((value * 100).toFixed(1))}%`;
const decimal = (value: number | undefined) => value === undefined ? 'Not measured' : value.toFixed(3);
export function ImageTrainingResults({ job }: { job: Job }) {
  if (!job.result) return null;
  const result = job.result, policy = result.delivery.acceptance;
  const previous = job.selection?.previous;
  const baselineLabel = previous ? 'Previous client model' : 'Stock Imajev';
  const rows = [{ ...result.baseline, uid: 'baseline', status: 'evaluated' }, ...result.miners];
  return <section role="region" aria-label="Image evaluation results">
    <h3>Image results</h3>
    {previous && <p>Compared with your previously accepted model: <code>{previous.model_id}</code>.</p>}
    <p className={styles.help}>Measured on held-out photos. Future photos can produce different results. “Needs review” counts as an incorrect answer in these scores.</p>
    <p>Saved targets: accuracy at least {percent(policy.min_accuracy)}; Brier improvement at least {policy.min_brier_improvement}.</p>
    {policy.positive_class && <p>For {policy.positive_class}: recall at least {percent(policy.min_positive_recall)}; false alarms at most {percent(policy.max_false_positive_rate)}.</p>}
    {Object.entries(policy.min_class_recall || {}).map(([label, target]) => <p key={label}>{label}: recall at least {percent(target)}.</p>)}
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Image model comparison"><table>
      <thead><tr><th>Model</th><th>Photos</th><th>Accuracy</th><th>Needs review</th><th>Brier loss</th><th>Log loss</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.uid}><th>{row.uid === 'baseline' ? baselineLabel : `Candidate ${row.uid}`}</th><td>{row.count ?? row.cases ?? '—'}</td><td>{percent(row.accuracy)}</td><td>{percent(row.unknown_rate)} ({row.unknown_count ?? '—'}/{row.count ?? row.cases ?? '—'})</td><td>{decimal(row.brier)}</td><td>{decimal(row.nll)}</td></tr>)}</tbody>
    </table></div>
    {rows.map(row => <div key={row.uid}>
      <h4>{row.uid === 'baseline' ? baselineLabel : `Candidate ${row.uid}`} — {row.status}</h4>
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={`${row.uid} recall and false alarms`}><table><thead><tr><th>Answer</th><th>Recall</th><th>False alarms</th></tr></thead><tbody>{Object.entries(row.per_class || {}).map(([label, value]) => <tr key={label}><th>{label}</th><td>{percent(value.recall)} ({value.true_positives}/{value.support})</td><td>{percent(value.false_positive_rate)} ({value.false_positives}/{value.negatives})</td></tr>)}</tbody></table></div>
      {row.confusion && <details><summary>Answer counts</summary><div className={styles.tableWrap} tabIndex={0}><table><thead><tr><th>Actual answer</th>{[...(row.outcome_order || []), '__unknown__'].map(key => <th key={key}>{key === '__unknown__' ? 'Needs review' : key}</th>)}</tr></thead><tbody>{Object.entries(row.confusion).map(([label, counts]) => <tr key={label}><th>{label}</th>{[...(row.outcome_order || []), '__unknown__'].map(key => <td key={key}>{counts[key] ?? 0}</td>)}</tr>)}</tbody></table></div></details>}
    </div>)}
  </section>;
}

export function PrivateImageTest({ job, owner, token, apiUrl, storage }: { job: Job; owner: string; token: () => Promise<string>; apiUrl: string; storage: StorageLocations }) {
  const api = useMemo(() => imageApi(apiUrl, storage, token), [apiUrl, storage, token]);
  const [question, setQuestion] = useState<ImageQuestion | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (!isImageReady(job)) return null;
  async function open() {
    controller.current?.abort(); const current = new AbortController(); controller.current = current; setBusy(true); setError('');
    try {
      const catalog = await api.models(current.signal);
      const model = catalog.models.find(row => row.name === job.workflow!.model_id && !row.stock);
      if (!model?.task || model.task.outcome_order.length !== Object.keys(model.task.question.criteria).length || !model.task.outcome_order.every(key => Object.hasOwn(model.task!.question.criteria, key))) throw new Error('Your model is not available yet. Refresh and retry.');
      if (!current.signal.aborted) setQuestion({ ...model.task.question, criteria: Object.fromEntries(model.task.outcome_order.map(key => [key, model.task!.question.criteria[key]])) });
    } catch (error) { if (!current.signal.aborted) setError(error instanceof Error ? error.message : 'Model details are unavailable.'); }
    finally { if (!current.signal.aborted) setBusy(false); }
  }
  return <div>
    {job.workflow?.model_alias && <p>Task alias: <code>{job.workflow.model_alias}</code></p>}
    <button className={styles.button} disabled={busy} onClick={() => void open()}>{busy ? 'Checking model…' : 'Use your model'}</button>
    {error && <p role="alert">{error}</p>}
    {question && <ImageDecisionPanel owner={owner} token={token} apiUrl={apiUrl} storage={storage} modelId={job.workflow!.model_id} question={question} />}
    {question && <details><summary>Use from your application</summary><p>Upload and finalize a private photo through /v1/image-assets, then send its asset ID with your existing API key.</p><pre className={styles.hash}>{`POST ${apiUrl}/v1/systemone\nAuthorization: Bearer YOUR_API_KEY\nContent-Type: application/json\n\n${JSON.stringify({ model: job.workflow!.model_id, state: {}, questions: { inspection: question }, images: [{ asset_id: 'YOUR_FINALIZED_ASSET_ID' }] }, null, 2)}`}</pre></details>}
  </div>;
}

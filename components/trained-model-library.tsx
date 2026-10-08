'use client';

import { useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { canDownload, type Job } from '@/lib/training';
import training from '@/app/(home)/train/train.module.css';
import styles from './trained-model-library.module.css';

function ModelRow({ job, onUse }: { job: Job; onUse: (job: Job) => void }) {
  const name = job.workflow!.model_name || job.workflow!.model_id!;
  const field = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  async function copy() {
    setNotice(''); setCopied(false);
    try { await navigator.clipboard.writeText(name); setCopied(true); setNotice('Copied.'); }
    catch {
      if (field.current) {
        field.current.focus();
        const range = document.createRange(); range.selectNodeContents(field.current);
        const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      }
      setNotice('Text selected. Press ⌘C or Ctrl+C to copy.');
    }
  }
  return <li className={styles.model}>
    <div className={styles.identity}>
      <h3>{job.name}</h3>
      <code ref={field} tabIndex={0} aria-label={`API name for ${job.name}`}>{name}</code>
      <span className={styles.ready}>Ready to use{job.created_at && <> · Trained {new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>}</span>
    </div>
    <div className={styles.controls}>
      <button type="button" className={training.secondary} onClick={copy}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied' : job.workflow!.model_name ? 'Copy name' : 'Copy ID'}</button>
      <button type="button" className={training.button} onClick={() => onUse(job)}>Use model</button>
      <span role="status" className={styles.notice}>{notice}</span>
    </div>
  </li>;
}

export function TrainedModelLibrary({ jobs, onUse }: { jobs: Job[]; onUse: (job: Job) => void }) {
  const models = jobs.filter(job => canDownload(job) && job.workflow?.state === 'ready' && job.workflow.model_id);
  if (!models.length) return null;
  return <section className={styles.library} aria-labelledby="your-models-title">
    <header><h2 id="your-models-title">Your models <span>{models.length}</span></h2><p>Choose a model for your task. One API key works with all models in your account.</p></header>
    <ul>{models.map(job => <ModelRow key={job.workflow!.model_id + (job.workflow!.model_name || '')} job={job} onUse={onUse} />)}</ul>
  </section>;
}

'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Copy, Check } from 'lucide-react';
import { ZilsDecisionMark } from '@/components/zils-decision-mark';
import { LinkLoading } from '@/components/workspace-loading';
import { canDownload, type Job } from '@/lib/training';
import { newerBase, type BaseConfig } from '@/lib/base-model';
import training from '@/app/(home)/train/train.module.css';
import styles from './trained-model-library.module.css';

function ModelRow({ job, bases }: { job: Job; bases?: BaseConfig | null }) {
  const name = job.workflow!.model_alias || job.workflow!.model_name || job.workflow!.model_id!;
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
      <h3><Link href={`/models/${job.id}`}>{job.name}<LinkLoading /></Link></h3>
      <code ref={field} tabIndex={0} aria-label={`API name for ${job.name}`}>{name}</code>
      {job.selection?.previous && <span className={styles.ready}>Replaces an earlier version</span>}
      <span className={styles.ready}>Ready to use{job.created_at && <time dateTime={job.created_at}>Trained {new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}</span>
      {bases && newerBase(bases, job) && <Link className={styles.upgrade} href={`/models/${job.id}#model-migration`}>Newer base available<LinkLoading /></Link>}
    </div>
    <div className={styles.controls}>
      <button type="button" className={training.secondary} onClick={copy}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied' : job.workflow!.model_alias ? 'Copy alias' : job.workflow!.model_name ? 'Copy name' : 'Copy ID'}</button>
      <Link className={training.button} href={`/models/${job.id}`}>View model<LinkLoading /></Link>
      <span role="status" className={styles.notice}>{notice}</span>
    </div>
  </li>;
}

export const readyModels = (jobs: Job[]) => jobs.filter(job => canDownload(job) && job.workflow?.state === 'ready' && job.workflow.model_id);

export function TrainedModelLibrary({ jobs, bare = false, bases }: { jobs: Job[]; bare?: boolean; bases?: BaseConfig | null }) {
  const models = readyModels(jobs);
  if (!models.length) return null;
  if (bare) return <section className={`${styles.library} ${styles.bare}`} aria-label="Your models"><ul>{models.map(job => <ModelRow key={job.id} job={job} bases={bases} />)}</ul></section>;
  return <section className={styles.library} aria-labelledby="your-models-title">
    <header><div><h2 id="your-models-title">Your models <span>{models.length}</span></h2><p>Trained on your examples. Ready for your next decision.</p></div><ZilsDecisionMark className={styles.mark} /></header>
    <ul>{models.map(job => <ModelRow key={job.id} job={job} bases={bases} />)}</ul>
  </section>;
}

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { LinkLoading } from '@/components/workspace-loading';
import { Section, workspacePage } from '@/components/workspace-page';
import { canDownload, tierLabel, type Job } from '@/lib/training';
import { trainingProgress } from '@/lib/training-status';
import styles from '@/app/(home)/train/train.module.css';

/** A titled list of runs, each with its state. A run that produced a model opens the model's page; any other opens the run. */
export function RunRows({ items, title, action }: { items: Job[]; title: string; action?: ReactNode }) {
  if (!items.length) return null;
  return <section className={styles.runHistory} aria-label={title}><Section label={title} action={action} /><ul>{items.map(job => <li key={job.id}>
    <Link className={styles.historyRow} href={canDownload(job) ? `/models/${job.id}` : `/train?run=${job.id}`}>
      <span><strong>{job.name}</strong>{job.created_at && <time dateTime={job.created_at}>{new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}{tierLabel(job) && <small>{tierLabel(job)}</small>}</span>
      <span className={`${styles.historyStatus} ${workspacePage.status}`} data-tone={trainingProgress(job).tone}>{trainingProgress(job).label}<LinkLoading /><ArrowUpRight size={16} aria-hidden="true" /></span>
    </Link>
  </li>)}</ul></section>;
}

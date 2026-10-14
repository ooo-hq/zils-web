import type { Job } from './training';
import { trainingProgress } from './training-status';

export type RunToast = { id: string; jobId: string; name: string; title: string; tone: 'active' | 'waiting' | 'done' | 'stopped'; sticky: boolean };

const key = (job: Job) => `${job.status}|${job.workflow?.state || ''}|${job.result?.delivery.status || ''}`;

/** Toasts for jobs whose state changed between two polls. First load and brand-new jobs stay silent. */
export function runToasts(previous: Job[] | null, next: Job[]): RunToast[] {
  if (!previous) return [];
  const before = new Map(previous.map(job => [job.id, key(job)]));
  return next.filter(job => before.has(job.id) && before.get(job.id) !== key(job)).map(job => {
    const state = trainingProgress(job);
    return { id: `${job.id}:${key(job)}`, jobId: job.id, name: job.name, title: state.title, tone: state.tone, sticky: state.tone === 'done' || state.tone === 'stopped' };
  });
}

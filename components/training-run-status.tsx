import type { Job } from '@/lib/training';
import { TRAINING_STAGES, trainingProgress } from '@/lib/training-status';
import styles from '@/app/(home)/train/train.module.css';

export function TrainingRunStatus({ job }: { job: Job }) {
  const status = trainingProgress(job);
  return <div className={styles.runStatus} data-tone={status.tone}>
    <div className={styles.runMessage} role="status" aria-atomic="true">
      <h3 className={styles.runHeadline}>{status.title}</h3>
      <p className={styles.runExplanation}>{status.detail}</p>
      <p className={styles.runNext}>{status.next}</p>
    </div>
    {status.stage !== null && <ol className={styles.runStages} aria-label="Training run progress">
      {TRAINING_STAGES.map((title, index) => {
        const state = index < status.stage! ? 'done' : index === status.stage ? (status.tone === 'waiting' ? 'waiting' : 'current') : 'next';
        return <li key={title} data-state={state} aria-current={index === status.stage ? 'step' : undefined}>
          <span className={styles.stageMarker} aria-hidden="true">{state === 'done' ? '✓' : index + 1}</span>
          <span><strong>{title}</strong><small>{state === 'done' ? 'Done' : state === 'current' ? 'In progress' : state === 'waiting' ? 'Waiting' : 'Next'}</small></span>
        </li>;
      })}
    </ol>}
  </div>;
}

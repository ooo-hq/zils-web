import type { Job } from './training';

export const TRAINING_STAGES = ['Send examples', 'Check examples', 'Assign worker', 'Train model', 'Check results'];
type Progress = { label: string; title: string; detail: string; next: string; stage: number | null; tone: 'active' | 'waiting' | 'done' | 'stopped' };
const progress: Record<Job['status'], Progress> = {
  uploading: { label: 'Sending examples', title: 'Your examples are being sent.', detail: 'Your run is saved. All three files must finish uploading before we can check them.', next: 'If an upload stopped, use “Resume missing uploads” below.', stage: 0, tone: 'active' },
  validating: { label: 'Checking examples', title: 'We’re checking your examples.', detail: 'We check the file format, answers, and that related cases stay together.', next: 'Once the checks pass, Zils can assign a training worker. No action needed from you.', stage: 1, tone: 'active' },
  awaiting_approval: { label: 'Waiting for a worker', title: 'Examples checked. Waiting for a worker.', detail: 'Your examples passed validation. Zils needs to approve and assign a training worker before training can begin.', next: 'No action needed from you. Zils handles worker approval.', stage: 2, tone: 'waiting' },
  queued: { label: 'Ready to train', title: 'Worker assigned. Waiting to start.', detail: 'A worker has permission to train on your examples. Training begins when it picks up the run.', next: 'No action needed from you. This page updates when training starts.', stage: 3, tone: 'waiting' },
  running: { label: 'Training', title: 'Your model is being trained.', detail: 'The assigned workers are processing the training run. Results are checked after their attempts finish.', next: 'Next, we’ll compare the result with the starting model using examples kept aside.', stage: 3, tone: 'active' },
  evaluating: { label: 'Checking results', title: 'We’re checking the results.', detail: 'Training attempts have ended. We compare the submitted models with the starting model and your success targets.', next: 'You’ll see whether a model qualified when these checks finish.', stage: 4, tone: 'active' },
  completed: { label: 'Finished', title: 'Your training run has finished.', detail: 'The result determines whether a model met your targets.', next: 'Review the result below.', stage: 5, tone: 'done' },
  failed: { label: 'Stopped', title: 'This run stopped before it could finish.', detail: 'The run ended without a completed evaluation. See the reason below.', next: 'Resolve the reported issue before starting another run. Processing errors need Zils to investigate.', stage: null, tone: 'stopped' },
};

export function trainingProgress(job: Job): Progress {
  if (job.status !== 'completed' || !job.result) return progress[job.status];
  return job.result.delivery.status === 'accepted'
    ? { ...progress.completed, label: 'Model ready', title: 'Your model is ready to download.', detail: 'A trained model improved on the starting model and met your targets on the test examples.', next: 'Get your private download links below. This does not create a live prediction API.' }
    : { ...progress.completed, label: 'No qualifying model', title: 'Finished. No model met your targets.', detail: 'The run completed, but no model passed every required check. No model download was released.', next: 'Review the results below before deciding whether to try more varied, reviewed examples.' };
}

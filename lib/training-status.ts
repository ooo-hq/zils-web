import { terminal, type Job } from './training';

export const TRAINING_STAGES = ['Examples', 'Training', 'Evaluation', 'Result'];

/** Keep unfinished work in focus when returning to the workspace. */
export const currentTrainingJob = (jobs: Job[]) => jobs.find(job => !terminal(job)) || jobs[0];
type Progress = { label: string; title: string; detail: string; next: string; stage: number | null; tone: 'active' | 'waiting' | 'done' | 'stopped' };
const progress: Record<Job['status'], Progress> = {
  uploading: { label: 'Sending examples', title: 'Your examples are being sent.', detail: 'Your run is saved. All three files must finish uploading before we can check them.', next: 'If an upload stopped, use “Resume missing uploads” below.', stage: 0, tone: 'active' },
  validating: { label: 'Checking examples', title: 'We’re checking your examples.', detail: 'We check the file format, answers, and that related cases stay together.', next: 'Once the checks pass, Zils can assign a training worker. No action needed from you.', stage: 0, tone: 'active' },
  awaiting_approval: { label: 'Waiting to start', title: 'Your examples are ready.', detail: 'Zils needs to approve and assign a training worker before training can begin.', next: 'No action needed from you. There’s nothing else to upload.', stage: 1, tone: 'waiting' },
  queued: { label: 'Waiting to start', title: 'Worker assigned. Waiting to start.', detail: 'A worker has permission to train on your examples. Training begins when it picks up the run.', next: 'No action needed from you. This page updates when training starts.', stage: 1, tone: 'waiting' },
  running: { label: 'Training', title: 'Your model is being trained.', detail: 'The assigned workers are processing the training run. Results are checked after their attempts finish.', next: 'Next, we’ll compare the result with the starting model using examples kept aside.', stage: 1, tone: 'active' },
  evaluating: { label: 'Checking results', title: 'We’re checking the results.', detail: 'Training attempts have ended. We compare the submitted models with the starting model and your success targets.', next: 'You’ll see whether a model qualified when these checks finish.', stage: 2, tone: 'active' },
  completed: { label: 'Finished', title: 'Your training run has finished.', detail: 'The result determines whether a model met your targets.', next: 'Review the result below.', stage: 4, tone: 'done' },
  failed: { label: 'Stopped', title: 'This run stopped before it could finish.', detail: 'The run ended without a completed evaluation. See the reason below.', next: 'Resolve the reported issue before starting another run. Processing errors need Zils to investigate.', stage: null, tone: 'stopped' },
};

export function trainingProgress(job: Job): Progress {
  const workflow = job.workflow?.state;
  if (job.status === 'awaiting_approval') {
    if (workflow === 'waiting_capacity') return { ...progress.awaiting_approval, label: 'Waiting for capacity', title: 'Waiting for training capacity.', detail: 'Your examples passed the checks and are saved. The training GPU is currently in use.', next: 'Training will start automatically when capacity is available. No need to resubmit.' };
    if (workflow === 'waiting_worker') return { ...progress.awaiting_approval, title: 'Waiting for a training worker.', detail: 'Your examples are ready. An approved worker will pick up this run when it is available.', next: 'No need to resubmit. This page updates automatically.' };
    if (workflow === 'needs_review') return { ...progress.awaiting_approval, label: 'Needs review', title: 'Zils needs to review this run.', detail: 'The run needs an operator check before it can be assigned safely.', next: 'Your examples are saved. Zils needs to resolve this before training can start.' };
  }
  if (job.status !== 'completed' || !job.result) return progress[job.status];
  if (job.result.delivery.status === 'accepted' && workflow === 'needs_review') return { ...progress.completed, stage: 3, tone: 'waiting', label: 'Needs review', title: 'Training passed. This version needs review.', detail: 'Another version or an activation check prevents this run from replacing the current model.', next: 'Your accepted result is saved. Zils must review it before API access is confirmed.' };
  if (job.result.delivery.status === 'accepted' && workflow === 'ready' && job.workflow?.model_id) return { ...progress.completed, label: 'API ready', title: 'Your model is ready to use.', detail: 'Your trained model passed evaluation and is available through the Zils API.', next: `Copy your model ${job.workflow.model_name ? 'name' : 'ID'} below, or follow the code example to make a request with your API key.` };
  if (job.result.delivery.status === 'accepted' && ['activating', 'activation_failed'].includes(workflow || '')) return { ...progress.completed, stage: 3, tone: 'waiting', label: 'Activating API access', title: 'Training passed. Preparing API access.', detail: 'Your adapter met the evaluation targets. Zils is connecting it to your account.', next: workflow === 'activation_failed' ? 'Activation hit a temporary issue and will retry automatically. Your accepted model is saved.' : 'This page will show your model ID once activation is verified.' };
  return job.result.delivery.status === 'accepted'
    ? { ...progress.completed, label: 'Training passed', title: 'Your model is ready to download.', detail: 'A trained model improved on the starting model and met your targets on the test examples.', next: 'API access has not been confirmed yet. Activation status will appear here when available.' }
    : { ...progress.completed, label: 'No qualifying model', title: 'Finished. No model met your targets.', detail: 'The run completed, but no model passed every required check. No model download was released.', next: 'Review the results below before deciding whether to try more varied, reviewed examples.' };
}

export function isImageReady(job: Job): boolean {
 return job.model?.id === 'imajev-4b-v1' && job.status === 'completed' && job.result?.delivery.status === 'accepted' && job.workflow?.state === 'ready' && Boolean(job.workflow.model_id);
}

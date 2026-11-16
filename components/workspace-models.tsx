'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuthSession } from '@/components/auth-session';
import { SignInPrompt } from '@/components/signed-in-only';
import { RunRows } from '@/components/run-rows';
import { readyModels, TrainedModelLibrary } from '@/components/trained-model-library';
import { WorkspaceLoading } from '@/components/workspace-loading';
import { Section, workspacePage } from '@/components/workspace-page';
import { canDownload, terminal, trainingApi, type Job } from '@/lib/training';
import { trainingBase, type BaseConfig } from '@/lib/base-model';
import type { TrainingConfig } from '@/lib/training-config';
import training from '@/app/(home)/train/train.module.css';

/** The signed-in session plus the account's ready models and its recent runs (null while loading). */
export function useWorkspaceModels(config: TrainingConfig) {
  const { client, session } = useAuthSession(config);
  const owner = session?.user.id;
  const [models, setModels] = useState<Job[] | null>(null);
  const [runs, setRuns] = useState<Job[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!client || !owner) return;
    const controller = new AbortController();
    const token = async () => { const { data } = await client.auth.getSession(); return data.session?.user.id === owner ? data.session.access_token : ''; };
    trainingApi(config.apiUrl, config.storage, token).list(controller.signal)
      .then(({ jobs, models }) => { setRuns(jobs); setModels(readyModels(models ?? jobs)); })
      .catch(() => { if (!controller.signal.aborted) setError('Your models could not be loaded. Refresh to try again.'); });
    return () => controller.abort();
  }, [client, owner, config.apiUrl, config.storage]);
  return { client, session, models, runs, error };
}

export function WorkspaceModels({ config }: { config: TrainingConfig }) {
  const { session, models, runs, error } = useWorkspaceModels(config);
  const [bases, setBases] = useState<BaseConfig | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    trainingBase(config.apiUrl, controller.signal).then(value => { if (!controller.signal.aborted) setBases(value); })
      .catch(() => { if (!controller.signal.aborted) setBases(null); });
    return () => controller.abort();
  }, [config.apiUrl]);
  if (session === undefined) return <WorkspaceLoading label="Loading your models" />;
  if (!session) return <SignInPrompt title="Sign in to see your models">Models you train on your own examples appear here, ready to call from your app.</SignInPrompt>;
  if (error) return <p role="alert" className={training.error}>{error}</p>;
  if (!models) return <WorkspaceLoading label="Loading your models" />;
  // Everything made here, by where it stands: still on its way, ready to call, or finished without a model.
  const ready = new Set(models.map(job => job.id));
  const progress = runs.filter(job => !ready.has(job.id) && (!terminal(job) || canDownload(job)));
  const none = runs.filter(job => terminal(job) && !canDownload(job));
  if (!models.length && !runs.length) return <>
    <Section label="No models yet" />
    <div className={workspacePage.split}>
      <div><p className={workspacePage.sub}>Train a model on examples your team has reviewed. When it passes evaluation, it appears here with its API name.</p></div>
      <div><p className={workspacePage.fine}>Bring a spreadsheet with the right answer in one column.</p><div className={workspacePage.actions}><Link href="/train" className={training.button}><Plus size={16} aria-hidden="true" />Train a model</Link></div></div>
    </div>
  </>;
  return <>
    <RunRows items={progress} title="In progress" />
    {models.length > 0 && <><Section label="Ready to call" /><TrainedModelLibrary jobs={models} bases={bases} bare /></>}
    <RunRows items={none} title="No model" />
  </>;
}

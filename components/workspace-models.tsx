'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuthSession } from '@/components/auth-session';
import { SignInPrompt } from '@/components/signed-in-only';
import { readyModels, TrainedModelLibrary } from '@/components/trained-model-library';
import { WorkspaceLoading } from '@/components/workspace-loading';
import { trainingApi, type Job } from '@/lib/training';
import type { TrainingConfig } from '@/lib/training-config';
import training from '@/app/(home)/train/train.module.css';

/** The signed-in session plus the account's ready models (null while loading). */
export function useWorkspaceModels(config: TrainingConfig) {
  const { client, session } = useAuthSession(config);
  const owner = session?.user.id;
  const [models, setModels] = useState<Job[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!client || !owner) return;
    const controller = new AbortController();
    const token = async () => { const { data } = await client.auth.getSession(); return data.session?.user.id === owner ? data.session.access_token : ''; };
    trainingApi(config.apiUrl, config.storage, token).list(controller.signal)
      .then(({ jobs, models }) => setModels(readyModels(models ?? jobs)))
      .catch(() => { if (!controller.signal.aborted) setError('Your models could not be loaded. Refresh to try again.'); });
    return () => controller.abort();
  }, [client, owner, config.apiUrl, config.storage]);
  return { client, session, models, error };
}

export function WorkspaceModels({ config }: { config: TrainingConfig }) {
  const { session, models, error } = useWorkspaceModels(config);
  if (session === undefined) return <WorkspaceLoading label="Loading your models" />;
  if (!session) return <SignInPrompt title="Sign in to see your models">Models you train on your own examples appear here, ready to call from your app.</SignInPrompt>;
  if (error) return <p role="alert" className={training.error}>{error}</p>;
  if (!models) return <WorkspaceLoading label="Loading your models" />;
  if (!models.length) return <section className={training.panel}>
    <h2>No models yet</h2>
    <p>Train a model on examples your team has reviewed. When it passes evaluation, it appears here with its API name.</p>
    <div className={training.actions}><Link href="/train/teach" className={training.button}><Plus size={16} aria-hidden="true" />Train a model</Link></div>
  </section>;
  return <TrainedModelLibrary jobs={models} bare />;
}

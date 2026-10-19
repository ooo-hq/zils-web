import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/console-shell';
import { WorkspaceHome } from '@/components/workspace-home';
import { playgroundConfig } from '@/lib/playground-server';
import { trainingConfig } from '@/lib/training-config';
import { currentBase } from '@/lib/base-model';
import styles from '../train/train.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Zils — home',
  description: 'Your Zils workspace: quickstart, latest models, and usage.',
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const config = trainingConfig();
  const base = await currentBase();
  const shared = playgroundConfig();
  return <ConsoleShell className={styles.page}>
    {config ? <WorkspaceHome config={config} baseName={base?.channels.stable.name ?? null} sharedModel={shared.configured ? shared.models[0]?.id ?? null : null} />
      : <section className={styles.panel}><h1>The workspace is not configured here yet.</h1><p>This environment is not connected to the training service.</p></section>}
  </ConsoleShell>;
}

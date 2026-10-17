import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/console-shell';
import { WorkspaceHome } from '@/components/workspace-home';
import { playgroundConfig } from '@/lib/playground-server';
import { trainingConfig } from '@/lib/training-config';
import styles from '../train/train.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Zils — home',
  description: 'Your Zils workspace: quickstart, latest models, and usage.',
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  const config = trainingConfig();
  const shared = playgroundConfig();
  return <ConsoleShell className={styles.page}>
    <div className={styles.workspaceHeading}><div><h1>Home</h1><p>Call Zils from your app, check your models, and keep an eye on usage.</p></div></div>
    {config ? <WorkspaceHome config={config} sharedModel={shared.configured ? shared.models[0]?.id ?? null : null} />
      : <section className={styles.panel}><h2>The workspace is not configured here yet.</h2><p>This environment is not connected to the training service.</p></section>}
  </ConsoleShell>;
}

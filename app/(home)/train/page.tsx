import { setupConfigured } from '@/lib/decision-setup-server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConsoleShell } from '@/components/console-shell';
import { TrainingGuide } from '@/components/training-guide';
import { TrainingDashboard } from '@/components/training-dashboard';
import { trainingConfig } from '@/lib/training-config';
import { jobSchema, modelProfileIdSchema } from '@/lib/training';
import styles from './train.module.css';

export const metadata: Metadata = {
  title: 'zils — training dashboard',
  description: 'Train models from reviewed examples, follow your runs, and access your approved models.',
  robots: { index: false, follow: false },
};

export default async function TrainPage({ searchParams }: { searchParams: Promise<{ run?: string | string[]; setup?: string | string[]; upgrade?: string | string[]; migrate?: string | string[] }> }) {
  const { run, setup, upgrade, migrate } = await searchParams;
  if (run !== undefined && !jobSchema.shape.id.safeParse(run).success) notFound();
  if (upgrade !== undefined && !jobSchema.shape.id.safeParse(upgrade).success) notFound();
  if (migrate !== undefined && (!upgrade || run !== undefined || !modelProfileIdSchema.safeParse(migrate).success)) notFound();
  const config = trainingConfig();
  return <ConsoleShell className={styles.page}>
      {config ? <TrainingDashboard runId={typeof run === 'string' ? run : undefined} bulkImport={run === undefined && setup === 'bulk'} upgradeOf={run === undefined && typeof upgrade === 'string' ? upgrade : undefined} migrateTo={typeof migrate === 'string' ? migrate : undefined} config={{ ...config, assistantConfigured: setupConfigured() }} /> : <><div className={styles.workspaceHeading}><h1>Training</h1></div><section id="training-workspace" className={styles.panel} aria-labelledby="offline-title"><h2 id="offline-title">Training is not configured here yet.</h2><p>Sign-in, uploads, and job submission become available once this environment is connected to Supabase and the training coordinator. No jobs are simulated.</p><div className={styles.actions}><Link href="/" className={styles.button}>Back to Zils</Link><Link href="/model" className={styles.secondary}>Explore the research</Link></div></section><details className={styles.signInGuide}><summary>What examples should I bring?</summary><TrainingGuide /></details></>}
  </ConsoleShell>;
}

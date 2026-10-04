import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { TrainingGuide } from '@/components/training-guide';
import { TrainingDashboard } from '@/components/training-dashboard';
import { serviceUrl } from '@/lib/training';
import styles from './train.module.css';

export const metadata: Metadata = {
  title: 'zils — training dashboard',
  description: 'Prepare examples of your decisions, review your data, and follow an evaluated training experiment. Development preview.',
  robots: { index: false, follow: false },
};

export default function TrainPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const apiUrl = process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL || '';
  let configured = Boolean(url && key && apiUrl && !key.startsWith('sb_secret_'));
  try { if (configured) { serviceUrl(url); serviceUrl(apiUrl); } } catch { configured = false; }
  return <div className={styles.page}><div className={styles.container}>
    <SiteHeader tone="light" current="train" />
    <main id="main-content" tabIndex={-1}>
      <div className={styles.hero}><span className={styles.badge}>Training preview</span><h1>Teach Zils how your team decides.</h1><p>Turn past cases and reviewed answers into a training experiment. We’ll help you prepare the data and measure whether a model improves.</p><p className={styles.help}>Experimental workflow. Training requires operator approval and may produce no qualifying model.</p></div>
      {configured ? <TrainingDashboard config={{ url, key, apiUrl }} /> : <><TrainingGuide /><section id="training-workspace" className={styles.panel} aria-labelledby="offline-title"><span className={styles.badge}>Not connected</span><h2 id="offline-title">Training is not configured here yet.</h2><p>Sign-in, uploads, and job submission become available once this environment is connected to Supabase and the training coordinator. No jobs are simulated.</p><div className={styles.actions}><Link href="/" className={styles.button}>Back to Zils</Link><Link href="/model" className={styles.secondary}>Explore the research ↗</Link></div></section></>}
    </main>
    <footer className={styles.footer}><span>Zils training · Experimental</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
  </div></div>;
}

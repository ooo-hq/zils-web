import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { TrainingGuide } from '@/components/training-guide';
import { TrainingDashboard } from '@/components/training-dashboard';
import { serviceUrl } from '@/lib/training';
import { storageLocations, type StorageLocations } from '@/lib/storage';
import { decisionApiUrl } from '@/lib/api-keys';
import { discordUrl } from '@/lib/shared';
import styles from './train.module.css';

export const metadata: Metadata = {
  title: 'zils — training dashboard',
  description: 'Prepare examples of your decisions, review your data, and follow an evaluated training experiment. Development preview.',
  robots: { index: false, follow: false },
};

export default function TrainPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const apiUrl = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL ?? '';
  let configured = Boolean(url && key && apiUrl && !key.startsWith('sb_secret_'));
  let storage: StorageLocations | null = null;
  try { if (configured) { serviceUrl(url); serviceUrl(apiUrl); storage = storageLocations(url, process.env.NEXT_PUBLIC_ZILS_SPACES_URL); } } catch { configured = false; }
  let keysApiUrl: string | null = null;
  try { if (configured) keysApiUrl = decisionApiUrl(apiUrl, process.env.NEXT_PUBLIC_ZILS_API_URL); } catch { /* Keep training available if the optional key-service URL is invalid. */ }
  return <div className={styles.page}><div className={styles.container}>
    <SiteHeader tone="light" current="train" />
    <main id="main-content" tabIndex={-1}>
      {configured && storage ? <TrainingDashboard config={{ url, key, apiUrl, decisionApiUrl: keysApiUrl, storage }} /> : <><div className={styles.workspaceHeading}><h1>Training</h1></div><section id="training-workspace" className={styles.panel} aria-labelledby="offline-title"><h2 id="offline-title">Training is not configured here yet.</h2><p>Sign-in, uploads, and job submission become available once this environment is connected to Supabase and the training coordinator. No jobs are simulated.</p><div className={styles.actions}><Link href="/" className={styles.button}>Back to Zils</Link><Link href="/model" className={styles.secondary}>Explore the research</Link></div></section><details className={styles.signInGuide}><summary>What examples should I bring?</summary><TrainingGuide /></details></>}
    </main>
    <footer className={styles.footer}><span>Zils training · Experimental</span><nav aria-label="Community and policies" className="flex flex-wrap items-center gap-x-6 gap-y-2"><a href={discordUrl} target="_blank" rel="noopener noreferrer">Discord</a><a href="https://x.com/zils_ai" target="_blank" rel="noopener noreferrer">X</a><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
  </div></div>;
}

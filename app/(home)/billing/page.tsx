import type { Metadata } from 'next';
import Link from 'next/link';
import { ConsoleShell } from '@/components/console-shell';
import { PageHero, Section, workspacePage } from '@/components/workspace-page';
import { BillingDashboard } from '@/components/billing-dashboard';
import { decisionApiUrl } from '@/lib/api-keys';
import { serviceUrl } from '@/lib/training';
import styles from './billing.module.css';

export const metadata: Metadata = {
  title: 'Zils — billing',
  description: 'Your Zils credit, top-ups, and payment history.',
  robots: { index: false, follow: false },
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string | string[] }> }) {
  const query = await searchParams;
  const checkoutReturn = query.checkout === 'success' ? 'success' : query.checkout === 'cancelled' ? 'cancelled' : null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const trainingUrl = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL ?? '';
  let apiUrl: string | null = null;
  try {
    if (url && key && !key.startsWith('sb_secret_')) {
      serviceUrl(url);
      apiUrl = decisionApiUrl(trainingUrl, process.env.NEXT_PUBLIC_ZILS_API_URL);
    }
  } catch { /* Unconfigured environments keep billing unavailable. */ }
  return <ConsoleShell bleed className={styles.page}>
        <PageHero title="Billing" intro="Your shared credit balance, top-ups, and receipts." />
        {apiUrl ? <BillingDashboard config={{ url, key, apiUrl }} testPreview={process.env.NEXT_PUBLIC_ZILS_BILLING_PREVIEW === 'test'} checkoutReturn={checkoutReturn} />
          : <><Section label="Billing is not configured here yet" /><p className={workspacePage.sub}>Account balances and top-ups are unavailable in this environment. Real payments are not open.</p><div className={workspacePage.actions}><Link href="/pricing" className={styles.button}>View planned pricing</Link></div></>}
  </ConsoleShell>;
}

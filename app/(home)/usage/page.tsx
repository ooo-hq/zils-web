import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/console-shell';
import { BillingDashboard } from '@/components/billing-dashboard';
import { decisionApiUrl } from '@/lib/api-keys';
import { serviceUrl } from '@/lib/training';
import styles from '../billing/billing.module.css';

export const metadata: Metadata = {
  title: 'Zils — usage',
  description: 'Your Zils API calls, training runs, and spend by model.',
  robots: { index: false, follow: false },
};

export default function UsagePage() {
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
  return <ConsoleShell className={styles.page}>
        <header className={styles.heading}><div><h1>Usage</h1><p>API calls, training runs, and spend across your models.</p></div></header>
        {apiUrl ? <BillingDashboard config={{ url, key, apiUrl }} testPreview={process.env.NEXT_PUBLIC_ZILS_BILLING_PREVIEW === 'test'} checkoutReturn={null} view="usage" />
          : <section className={styles.empty}><h2>Usage is not available here yet.</h2><p>This environment is not connected to the billing service.</p></section>}
  </ConsoleShell>;
}

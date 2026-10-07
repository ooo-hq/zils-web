import type { Metadata } from 'next';
import Link from 'next/link';
import { EarlyAccessForm } from '@/components/early-access-form';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import home from '../home.module.css';
import styles from '../contact/contact.module.css';

export const metadata: Metadata = {
  title: 'Zils — request early access',
  description: 'Build small decision models for your app. Tell us what you want to train and request early access to Zils.',
  alternates: { canonical: 'https://zils.ai/early-access' },
};

export default function EarlyAccessPage() {
  return <div className={`${home.home} ${styles.page}`}><div className={styles.container}>
    <SiteHeader tone="light" /><main id="main-content" tabIndex={-1} className={styles.main}>
      <div className={styles.intro}><h1>A Zil for<br />your next idea.</h1><p>Train a decision model on your examples. Give it a job in your app.</p><p className={styles.detail}>We’re opening access to a small group of builders. One account can have several Zils, each trained for a different decision.</p><p className={styles.detail}>Already invited? <Link href="/train">Sign in to your workspace.</Link></p></div>
      <EarlyAccessForm />
    </main></div><SiteFooter /></div>;
}

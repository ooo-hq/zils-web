import type { Metadata } from 'next';
import Link from 'next/link';
import { EmailSignup } from '@/components/email-signup';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import home from '../home.module.css';
import styles from '../contact/contact.module.css';

export const metadata: Metadata = {
  title: 'Zils — early access',
  description: 'Join the Zils early-access email list for specialized decision models.',
  alternates: { canonical: 'https://zils.ai/early-access' },
};

export default function EarlyAccessPage() {
  return <div className={`${home.home} ${styles.page}`}>
    <div className={styles.container}><SiteHeader tone="light" />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <div className={styles.intro}><h1>Get early access.</h1><p>Be first to hear when there’s room for your next decision model.</p><p className={styles.detail}>Already have access? <Link href="/train" className="underline underline-offset-4">Sign in to your workspace.</Link></p></div>
        <EmailSignup earlyAccess />
      </main>
    </div><SiteFooter />
  </div>;
}

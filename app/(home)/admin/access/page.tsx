import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { AccessAdmin } from '@/components/access-admin';
import { accessAuthConfig } from '@/lib/early-access-config';
import styles from './access.module.css';

export const metadata: Metadata = { title: 'Zils — early access administration', robots: { index: false, follow: false } };

export default function AccessAdminPage() {
  const config = accessAuthConfig();
  return <div className={styles.page}><div className={styles.container}><SiteHeader tone="light" />
    <main id="main-content" tabIndex={-1}><header className={styles.heading}><h1>Early access.</h1><p>Review applications, invite builders, and manage available spots.</p></header>
      {config ? <AccessAdmin config={config} /> : <p role="status">Administrator sign-in is not configured in this environment yet.</p>}
    </main>
  </div></div>;
}

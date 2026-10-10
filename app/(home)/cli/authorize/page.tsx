import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { TrainingFooter } from '@/components/training-footer';
import { CliAuthorization } from '@/components/cli-authorization';
import styles from '../../train/train.module.css';

export const metadata: Metadata = {
  title: 'Connect the Zils CLI',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function CliAuthorizePage({ searchParams }: { searchParams: Promise<{ authorization_id?: string | string[] }> }) {
  const { authorization_id } = await searchParams;
  return <div className={`${styles.page} ${styles.workspacePage}`}><div className={`${styles.container} ${styles.workspaceContainer}`}>
    <SiteHeader tone="light" current="train" />
    <main id="main-content" tabIndex={-1} className={styles.workspaceMain}>
      <div className={styles.workspaceHeading}><h1>Connect the Zils CLI</h1></div>
      <CliAuthorization authorizationId={typeof authorization_id === 'string' ? authorization_id : null} />
    </main>
    <TrainingFooter />
  </div></div>;
}

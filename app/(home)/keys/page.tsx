import type { Metadata } from 'next';
import { ApiKeysPage } from '@/components/api-keys-panel';
import { ConsoleShell } from '@/components/console-shell';
import { trainingConfig } from '@/lib/training-config';
import styles from '../train/train.module.css';

export const metadata: Metadata = {
  title: 'Zils — API keys',
  description: 'Create and revoke the keys your apps use to call Zils.',
  robots: { index: false, follow: false },
};

export default function KeysPage() {
  const config = trainingConfig();
  return <ConsoleShell className={styles.page}>
    <div className={styles.workspaceHeading}><div><h1>API keys</h1><p>Connect your app to Zils.</p></div></div>
    {config ? <ApiKeysPage auth={{ url: config.url, key: config.key }} apiUrl={config.decisionApiUrl} />
      : <section className={styles.panel}><h2>API keys are not configured here yet.</h2><p>This environment is not connected to the key service.</p></section>}
  </ConsoleShell>;
}

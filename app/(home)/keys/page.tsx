import type { Metadata } from 'next';
import { ApiKeysPage } from '@/components/api-keys-panel';
import { ConsoleShell } from '@/components/console-shell';
import { PageHero } from '@/components/workspace-page';
import { trainingConfig } from '@/lib/training-config';
import styles from '../train/train.module.css';

export const metadata: Metadata = {
  title: 'Zils — API keys',
  description: 'Create and revoke the keys your apps use to call Zils.',
  robots: { index: false, follow: false },
};

export default function KeysPage() {
  const config = trainingConfig();
  return <ConsoleShell bleed className={styles.page}>
    {config ? <ApiKeysPage auth={{ url: config.url, key: config.key }} apiUrl={config.decisionApiUrl} />
      : <PageHero title="API keys" intro="API keys are not configured here yet. This environment is not connected to the key service." />}
  </ConsoleShell>;
}

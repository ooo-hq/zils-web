import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/console-shell';
import { GatewayReportPage } from '@/components/gateway-report';
import { PageHero } from '@/components/workspace-page';
import { trainingConfig } from '@/lib/training-config';
import styles from '../train/train.module.css';

export const metadata: Metadata = {
  title: 'Zils — Gateway',
  description: 'What your app sent through the Zils gateway, and how closely your Zils model matches your provider.',
  robots: { index: false, follow: false },
};

export default function GatewayPage() {
  const config = trainingConfig();
  return <ConsoleShell bleed className={styles.page}>
    {config?.decisionApiUrl ? <GatewayReportPage auth={{ url: config.url, key: config.key }} apiUrl={config.decisionApiUrl} />
      : <PageHero title="Gateway" intro="The gateway report is not configured here yet. This environment is not connected to the Zils API." />}
  </ConsoleShell>;
}

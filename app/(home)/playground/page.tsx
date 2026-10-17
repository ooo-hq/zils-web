import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/console-shell';
import { Playground } from '@/components/playground';
import { SignedInOnly } from '@/components/signed-in-only';
import { playgroundConfig, userApiUrl } from '@/lib/playground-server';
import { trainingConfig } from '@/lib/training-config';
import styles from '../train/train.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Zils — playground',
  description: 'Send a request to a Zils model and see the answers it returns.',
  robots: { index: false, follow: false },
};

export default function PlaygroundPage() {
  const config = trainingConfig();
  return <ConsoleShell className={styles.page}>
    <div className={styles.workspaceHeading}><div><h1>Playground</h1><p>Send a request to a Zils model and see the answers it returns.</p></div></div>
    <SignedInOnly auth={config ? { url: config.url, key: config.key } : undefined}>
      <Playground {...playgroundConfig()} apiUrl={userApiUrl()} />
      <p className="mt-10 border-t border-edge pt-6 text-xs leading-6 text-subtle">Answers come only from the selected Zils model; there is no fallback model. One example is not an evaluation.</p>
    </SignedInOnly>
  </ConsoleShell>;
}

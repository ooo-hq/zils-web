import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/console-shell';
import { GuidedPlayground } from '@/components/guided-playground';
import { SignedInOnly } from '@/components/signed-in-only';
import { playgroundConfig } from '@/lib/playground-server';
import { setupConfigured } from '@/lib/decision-setup-server';
import { STARTERS } from '@/lib/decision-setup';
import { trainingConfig } from '@/lib/training-config';
import styles from '../train/train.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Zils — playground',
  description: 'Describe a task, turn it into questions, and try an example on a Zils model.',
  robots: { index: false, follow: false },
};

export default async function PlaygroundPage({ searchParams }: PageProps<'/playground'>) {
  const query = await searchParams;
  const initialStarterId = STARTERS.find(starter => starter.id === query.starter)?.id;
  const config = trainingConfig();
  return <ConsoleShell className={styles.page}>
    <div className={styles.workspaceHeading}><div><h1>Playground</h1><p>Describe a task, turn it into questions, and try an example on a Zils model.</p></div></div>
    <SignedInOnly auth={config ? { url: config.url, key: config.key } : undefined}>
      <GuidedPlayground key={initialStarterId ?? 'blank'} {...playgroundConfig()} assistantConfigured={setupConfigured()} initialStarterId={initialStarterId} />
      <p className="mt-10 border-t border-edge pt-6 text-xs leading-6 text-subtle">Answers come only from the connected Zils checkpoint; there is no fallback model. Examples here are illustrative, not an evaluation benchmark.</p>
    </SignedInOnly>
  </ConsoleShell>;
}

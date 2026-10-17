import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ConsoleShell } from '@/components/console-shell';
import { WorkspaceModels } from '@/components/workspace-models';
import { trainingConfig } from '@/lib/training-config';
import styles from '../train/train.module.css';

export const metadata: Metadata = {
  title: 'Zils — models',
  description: 'The models trained on your examples and ready to call.',
  robots: { index: false, follow: false },
};

export default function ModelsPage() {
  const config = trainingConfig();
  return <ConsoleShell className={styles.page}>
    <div className={styles.workspaceHeading}>
      <div><h1>Models</h1><p>Models trained on your examples. Call them by API name from your app.</p></div>
      <Link className={styles.button} href="/train/teach"><Plus size={16} aria-hidden="true" />Train a model</Link>
    </div>
    {config ? <WorkspaceModels config={config} /> : <section className={styles.panel}><h2>Models are not available here.</h2><p>This environment is not connected to the training service.</p></section>}
  </ConsoleShell>;
}

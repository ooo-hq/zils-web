import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ConsoleShell } from '@/components/console-shell';
import { WorkspaceModels } from '@/components/workspace-models';
import { PageHero, Section, workspacePage } from '@/components/workspace-page';
import { trainingConfig } from '@/lib/training-config';
import styles from '../train/train.module.css';

export const metadata: Metadata = {
  title: 'Zils — models',
  description: 'The models trained on your examples and ready to call.',
  robots: { index: false, follow: false },
};

export default function ModelsPage() {
  const config = trainingConfig();
  return <ConsoleShell bleed className={styles.page}>
    <PageHero title="Models" intro="Everything you have trained: models ready to call by API name, runs still in progress, and runs that gave no model." action={<Link className={styles.button} href="/train"><Plus size={16} aria-hidden="true" />Train a model</Link>} />
    {config ? <WorkspaceModels config={config} /> : <><Section label="Not available" /><p className={workspacePage.sub}>This environment is not connected to the training service.</p></>}
  </ConsoleShell>;
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConsoleShell } from '@/components/console-shell';
import { LinkLoading } from '@/components/workspace-loading';
import { TrainedModelDetail } from '@/components/trained-model-detail';
import { PageHero } from '@/components/workspace-page';
import { trainingConfig } from '@/lib/training-config';
import { jobSchema } from '@/lib/training';
import styles from '../../train/train.module.css';

export const metadata: Metadata = {
  title: 'Zils — your model',
  description: 'Private model evaluation, usage, and API access for your Zils account.',
  robots: { index: false, follow: false },
};

export default async function ModelPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!jobSchema.shape.id.safeParse(jobId).success) notFound();
  const config = trainingConfig();
  return <ConsoleShell bleed className={styles.page}>
        {config ? <TrainedModelDetail jobId={jobId} config={config} /> : <PageHero back={<Link href="/models" className={styles.textButton}>Back to models<LinkLoading /></Link>} title="Model details are unavailable here." intro="This environment is not connected to the training service." />}
  </ConsoleShell>;
}

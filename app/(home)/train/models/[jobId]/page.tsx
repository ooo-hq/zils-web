import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { LinkLoading } from '@/components/workspace-loading';
import { TrainingFooter } from '@/components/training-footer';
import { TrainedModelDetail } from '@/components/trained-model-detail';
import { trainingConfig } from '@/lib/training-config';
import { jobSchema } from '@/lib/training';
import styles from '../../train.module.css';

export const metadata: Metadata = {
  title: 'Zils — your model',
  description: 'Private model evaluation, usage, and API access for your Zils account.',
  robots: { index: false, follow: false },
};

export default async function ModelPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!jobSchema.shape.id.safeParse(jobId).success) notFound();
  const config = trainingConfig();
  return <div className={`${styles.page} ${styles.workspacePage}`}>
    <div className={`${styles.container} ${styles.workspaceContainer}`}>
      <SiteHeader tone="light" current="train" />
      <main id="main-content" tabIndex={-1} className={styles.workspaceMain}>
        <Link href="/train" className={styles.textButton}>Back to Training<LinkLoading /></Link>
        {config ? <TrainedModelDetail jobId={jobId} config={config} /> : <section className={styles.panel}>
          <h1>Model details are unavailable here.</h1><p>This environment is not connected to the training service.</p>
        </section>}
      </main>
      <TrainingFooter />
    </div>
  </div>;
}

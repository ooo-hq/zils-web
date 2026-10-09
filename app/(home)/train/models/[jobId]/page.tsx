import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
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
  return <div className={styles.page}>
    <div className={styles.container}>
      <SiteHeader tone="light" current="train" />
      <main id="main-content" tabIndex={-1}>
        <Link href="/train" className={styles.textButton}>← Your training workspace</Link>
        {config ? <TrainedModelDetail jobId={jobId} config={config} /> : <section className={styles.panel}>
          <h1>Model details are unavailable here.</h1><p>This environment is not connected to the training service.</p>
        </section>}
      </main>
    </div>
    <SiteFooter />
  </div>;
}

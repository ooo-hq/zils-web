import type { Metadata } from 'next';
import Link from 'next/link';
import { FlightStudyDetails } from '@/components/flight-study';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  title: 'zils — archived flight study',
  description: 'The earlier flight-delay experiment, with its original results, methodology, and limitations preserved.',
  alternates: { canonical: 'https://zils.ai/model/flight-study' },
};

export default function FlightStudyArchivePage() {
  return (
    <div className="min-h-screen bg-page font-sans text-ink antialiased">
      <div className="mx-auto max-w-6xl px-6 sm:px-8"><SiteHeader tone="light" current="model" /></div>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-6 sm:px-8">
        <header className="pb-10 pt-8">
          <Link href="/model#support-study" className="text-sm underline decoration-edge-strong underline-offset-4 hover:text-accent">Back to the ABCD support study</Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">Earlier research: flight delays.</h1>
          <p className="mt-4 max-w-[65ch] text-sm leading-7 text-muted">This experiment remains part of the research record. The adapter improved over its base model but did not beat the historical-rate baseline. ABCD support workflows are now the featured training example.</p>
        </header>
        <FlightStudyDetails />
      </main>
      <SiteFooter tone="light" />
    </div>
  );
}

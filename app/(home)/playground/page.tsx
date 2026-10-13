import type { Metadata } from 'next';
import Link from 'next/link';
import { GuidedPlayground } from '@/components/guided-playground';
import { LightBackdrop, SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { playgroundConfig } from '@/lib/playground-server';
import { setupConfigured } from '@/lib/decision-setup-server';
import { STARTERS } from '@/lib/decision-setup';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'zils — playground',
  description: 'Describe your task, build editable decision questions, and try an example with Zils. No special wording or code required.',
  alternates: { canonical: 'https://zils.ai/playground' },
};

export default async function PlaygroundPage({ searchParams }: PageProps<'/playground'>) {
  const query = await searchParams;
  const initialStarterId = STARTERS.find(starter => starter.id === query.starter)?.id;
  return <div className="min-h-screen bg-page font-sans text-ink antialiased selection:bg-[#FF6A00] selection:text-black">
    <div className="relative overflow-hidden">
      <LightBackdrop />
      <div className="relative mx-auto max-w-6xl px-6 sm:px-8"><SiteHeader tone="light" current="playground" /></div>
      <header className="relative mx-auto max-w-6xl px-6 pb-6 pt-4 sm:px-8 sm:pt-5">
        <p className="flex items-center gap-2 text-[12px] font-medium"><span aria-hidden="true" className="text-base">✳</span> Playground · Experimental</p>
        <h1 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.06] tracking-[-0.055em]">What would you like Zils to decide?</h1>
        <p className="mt-3 max-w-[70ch] text-base leading-7 text-muted">Start with a task you already do. Turn it into questions, make them yours, and try an example.</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <Link href="/model#quality" className="underline decoration-edge-strong underline-offset-4 hover:text-accent">Model &amp; methodology</Link>
          <a href="https://github.com/ooo-hq/zils" className="underline decoration-edge-strong underline-offset-4 hover:text-accent">Zils on GitHub</a>
        </div>
      </header>
    </div>
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-6 pb-20 pt-6 sm:px-8">
      <section aria-labelledby="ranking-heading" className="mb-8 grid gap-5 rounded-md border border-edge bg-[var(--zils-surface)] p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-medium text-accent">Available in SDK 0.3.0 · Experimental</p>
          <h2 id="ranking-heading" className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Rank options</h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted">Give Zils 2–10 options and describe what should come first. Get an ordered list with relative scores.</p>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted">SDK 0.3.0 adds optional grouped comparisons: ten options use 10 judgments instead of 90. Pairwise stays the default. Fewer comparisons can produce a worse order, so test the full list on your task.</p>
          <p className="mt-2 text-xs leading-5 text-subtle">Ranking works through the SDK. An interactive ranking demo is not available in this playground yet.</p>
        </div>
        <div className="flex flex-col items-start gap-3 text-sm">
          <a href="https://docs.zils.ai/sdks/ranking" className="inline-flex min-h-11 items-center rounded-md bg-action px-4 py-2 font-medium text-on-action hover:bg-action-hover">Use ranking in your app</a>
          <a href="https://docs.zils.ai/changelog#sdk-0-3-0" className="underline decoration-edge-strong underline-offset-4 hover:text-accent">What’s new in 0.3.0</a>
        </div>
      </section>
      <GuidedPlayground key={initialStarterId ?? 'blank'} {...playgroundConfig()} assistantConfigured={setupConfigured()} initialStarterId={initialStarterId} />
      <p className="mt-10 border-t border-edge pt-6 text-xs leading-6 text-subtle">Playground examples are illustrative, not an evaluation benchmark. Answers come only from the connected Zils checkpoint; there is no fallback model.</p>
    </main>
    <SiteFooter />
  </div>;
}

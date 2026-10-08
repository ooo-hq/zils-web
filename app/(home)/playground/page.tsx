import type { Metadata } from 'next';
import Link from 'next/link';
import { GuidedPlayground } from '@/components/guided-playground';
import { LightBackdrop, SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { playgroundConfig } from '@/lib/playground-server';
import { setupConfigured } from '@/lib/decision-setup-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'zils — playground',
  description: 'Describe your task, build editable decision questions, and try an example with Zils. No special wording or code required.',
  alternates: { canonical: 'https://zils.ai/playground' },
};

export default function PlaygroundPage() {
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
      <GuidedPlayground {...playgroundConfig()} assistantConfigured={setupConfigured()} />
      <p className="mt-10 border-t border-edge pt-6 text-xs leading-6 text-subtle">Playground examples are illustrative, not an evaluation benchmark. Answers come only from the connected Zils checkpoint; there is no fallback model.</p>
    </main>
    <SiteFooter />
  </div>;
}

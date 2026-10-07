import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export function PolicyPage({ title, children, updated = '6 October 2026' }: { title: string; children: ReactNode; updated?: string }) {
  return (
    <div className="min-h-screen bg-page font-sans text-ink antialiased">
      <div className="mx-auto max-w-6xl px-6 sm:px-8"><SiteHeader tone="light" /></div>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-6 pb-20 pt-10 sm:px-8">
        <h1 className="text-[clamp(2.4rem,6vw,3.5rem)] font-semibold leading-tight tracking-[-0.05em]">{title}</h1>
        <p className="mb-10 mt-4 text-sm text-muted">Updated {updated} · Zils at zils.ai</p>
        <div className="space-y-9 text-sm leading-7 text-muted">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-[-0.025em] text-ink">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

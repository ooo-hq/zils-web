import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { HeroBackdrop } from '@/components/hero-backdrop';
import { HomeDecisionStory } from '@/components/home-decision-story';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { SupportStudySummary } from '@/components/support-study';
import s from './home.module.css';

const TITLE = 'Teach AI to make decisions your way.';
const DESCRIPTION = 'Show Zils examples with the right answers. It trains a small model your app can use to sort requests, flag problems, or score matches.';

export const metadata: Metadata = {
  title: `zils — ${TITLE}`,
  description: DESCRIPTION,
  alternates: { canonical: 'https://zils.ai' },
  openGraph: {
    title: `zils — ${TITLE}`,
    description: DESCRIPTION,
    url: 'https://zils.ai',
    siteName: 'Zils',
    type: 'website',
  },
  twitter: { card: 'summary', title: `zils — ${TITLE}`, description: DESCRIPTION },
};

const USE_CASES = [
  { title: 'Sort requests.', body: 'Teach it which team, topic, or queue a request belongs in. Your app uses the answer to send it to the right place.', question: '“Which team should handle this?”' },
  { title: 'Flag problems.', body: 'Show it examples that need attention and examples that can wait. Your app can use the result to ask someone to review.', question: '“Does this need a closer look?”' },
  { title: 'Score matches.', body: 'Provide pairs with scores you have checked. Teach it how well a product, article, or result fits a request.', question: '“How well does this fit?”' },
] as const;

const DELIVERABLES = [
  { title: 'A model for your task.', body: 'Trained on your examples, with the training run and model version saved in your workspace.' },
  { title: 'Results you can check.', body: 'See how it performs on examples kept out of training, including the mistakes. Review the results before relying on it.' },
  { title: 'A way to use it in your app.', body: 'Once your model passes evaluation, Zils hosts it. Your app sends a request through the API and gets an answer back.' },
] as const;

export default function HomePage() {
  return (
    <div className={`${s.home} min-h-screen bg-page font-sans text-[var(--zils-ink)] antialiased`}>
      <div className="mx-auto max-w-6xl px-6 sm:px-8"><SiteHeader tone="light" /></div>
      <main id="main-content" tabIndex={-1}>
        <div className="relative isolate overflow-hidden">
          <HeroBackdrop variant="home" />
          <section aria-labelledby="home-heading" className="relative mx-auto max-w-5xl px-6 pb-16 pt-4 text-center sm:px-8 sm:pb-20 sm:pt-8">
            <ZilsWordmark className="text-[80px] text-[var(--zils-accent)] sm:text-[112px]" />
            <h1 id="home-heading" className="mx-auto mt-8 max-w-[18ch] text-balance text-[clamp(2.8rem,6.5vw,5.1rem)] font-semibold leading-[1.02] tracking-[-0.055em]">
              {TITLE}
            </h1>
            <p className="mx-auto mt-6 max-w-[35rem] text-[17px] leading-7 text-muted sm:text-[18px]">{DESCRIPTION}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              <Link href="/early-access" className={s.primary}>Request early access</Link>
              <a href="#workflow" className={s.textLink}>See how it works</a>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">Start with a spreadsheet of examples and answers you trust.</p>
          </section>
        </div>

        <section id="workflow" aria-labelledby="workflow-h" className="scroll-mt-8 bg-[var(--zils-surface)] px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-5xl"><HomeDecisionStory /></div>
        </section>

        <section aria-labelledby="cases" className="mx-auto max-w-5xl px-6 py-16 sm:px-8 sm:py-20">
          <Heading id="cases" aside="Pick one repeatable task where you can show what a good answer looks like. Start there, then test how well the model learns it.">
            One task.<br />Done your way.
          </Heading>
          <div className="mt-10 grid gap-9 md:grid-cols-3 md:gap-0 md:divide-x md:divide-edge">
            {USE_CASES.map(({ title, body, question }) => (
              <article key={title} className="flex flex-col md:px-7 first:md:pl-0 last:md:pr-0">
                <h3 className="text-[22px] font-semibold tracking-[-0.035em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
                <p className="mt-5 text-sm leading-6 text-[var(--zils-accent)]">{question}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="deliver" className="mx-auto max-w-5xl border-t border-edge px-6 py-16 sm:px-8 sm:py-20">
          <Heading id="deliver" aside="You bring the examples. Zils handles training, evaluation, and hosting for accepted models.">What you get.</Heading>
          <div className="mt-10 grid gap-9 md:grid-cols-3 md:gap-8">
            {DELIVERABLES.map(({ title, body }) => (
              <article key={title} className="border-t-2 border-[var(--zils-accent)]/30 pt-5">
                <h3 className="text-[22px] font-semibold tracking-[-0.035em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-9 grid gap-2 rounded-md bg-[var(--zils-surface)] p-5 text-sm md:grid-cols-[10rem_1fr] sm:p-6">
            <h3 className="font-semibold">Before you upload.</h3>
            <p className="leading-6 text-muted">
              Training examples are copied to approved workers, whose operators can read and retain them. This is not confidential computing. Use only data you are authorized to share.{' '}
              <Link href="/privacy" className="underline decoration-edge-strong underline-offset-4 hover:text-accent">Read how data is handled</Link>.
            </p>
          </div>
        </section>

        <SupportStudySummary />

        <section aria-labelledby="cta" className="px-6 pb-16 sm:px-8 sm:pb-24">
          <div className="mx-auto max-w-5xl rounded-md bg-[#15151a] px-6 py-14 text-center sm:px-12 sm:py-16">
            <h2 id="cta" className="text-balance text-[clamp(2.1rem,5vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.055em] text-white">
              Start with a decision<br />you know how to make.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-7 text-neutral-300">
              Bring examples and their right answers. The training workspace helps you prepare your data and start a run.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              <Link href="/early-access" className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-3 text-[13px] font-medium text-black hover:bg-[#eceafa]">Request early access</Link>
              <Link href="/playground?starter=customer-routing" className="inline-flex min-h-11 items-center text-[13px] text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">Try the shared model</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Heading({ id, aside, children }: { id: string; aside: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_22rem] md:items-end">
      <h2 id={id} className="text-[clamp(2.1rem,4.4vw,3.3rem)] font-semibold leading-[1.04] tracking-[-0.055em]">{children}</h2>
      <p className="max-w-[55ch] text-[15px] leading-7 text-muted">{aside}</p>
    </div>
  );
}
